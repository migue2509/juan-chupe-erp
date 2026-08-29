import { useEffect, useRef, useState, useCallback } from 'react'
import { loadLeaflet } from '../utils/leafletLoader'

const MED_LAT      = 6.2442
const MED_LNG      = -75.5812
const DEFAULT_ZOOM = 14

// ── Normalización de direcciones colombianas ──────────────────────────────────
// "Calle 92 #66-65" → "Calle 92 66-65"  (los motores no entienden el #)
function normalizeAddr(q) {
  return q.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Photon (OSM + location bias hacia Medellín) ───────────────────────────────
async function searchPhoton(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${MED_LAT}&lon=${MED_LNG}&limit=6&lang=es`
  try {
    const res  = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || [])
      .filter(f => /colombia/i.test(f.properties?.country || '') || !f.properties?.country)
      .map(f => {
        const p     = f.properties || {}
        const parts = [
          p.name,
          p.housenumber ? `#${p.housenumber}` : null,
          p.street && p.street !== p.name ? p.street : null,
          p.suburb || p.neighbourhood || p.district,
          p.city || p.town || p.village,
        ].filter(Boolean)
        return {
          display_name: parts.join(', ') || query,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        }
      })
  } catch { return [] }
}

// ── Nominatim (fallback) ──────────────────────────────────────────────────────
const MED_VIEWBOX = '-75.72,6.42,-75.44,6.10'
async function searchNominatim(query) {
  const withCity = /medell/i.test(query) ? query : query + ', Medellín, Colombia'
  const base     = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=co&limit=6&addressdetails=1&viewbox=${MED_VIEWBOX}&bounded=0`
  try {
    const r = await fetch(`${base}&q=${encodeURIComponent(withCity)}`, { headers: { 'Accept-Language': 'es' } })
    const d = r.ok ? await r.json() : []
    return d.map(x => ({ display_name: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }))
  } catch { return [] }
}

// ── Búsqueda combinada: Photon → Nominatim → solo calle ──────────────────────
async function searchAddress(rawQuery) {
  const norm = normalizeAddr(rawQuery)

  let res = await searchPhoton(norm)
  if (res.length) return res

  res = await searchNominatim(norm)
  if (res.length) return res

  // Último intento: quitar número de casa y buscar solo la calle
  const street = rawQuery.includes('#') ? rawQuery.split('#')[0].trim() : null
  if (street) {
    res = await searchPhoton(normalizeAddr(street))
    if (res.length) return res
    res = await searchNominatim(street)
  }
  return res
}

// ── Reverse geocoding ─────────────────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
    if (!res.ok) return null
    return (await res.json()).display_name || null
  } catch { return null }
}

// ── Detector de coordenadas pegadas ──────────────────────────────────────────
const COORD_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
function parseCoords(val) {
  const m = val.match(COORD_RE)
  if (!m) return null
  const lat = parseFloat(m[1]), lng = parseFloat(m[2])
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

// ── Pin icon ──────────────────────────────────────────────────────────────────
function makePinIcon(L) {
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:40px;background:linear-gradient(135deg,#FF0099,#ff5cc8);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(255,0,153,.5);border:2px solid white;"></div>`,
    iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -44],
  })
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function MapPickerModal({ onConfirm, onClose, initialLat, initialLng, initialAddress }) {
  const mapRef      = useRef(null)
  const mapObjRef   = useRef(null)
  const markerRef   = useRef(null)
  const searchTimer = useRef(null)

  const [mapReady,       setMapReady]       = useState(false)
  const [mapError,       setMapError]       = useState('')
  const [search,         setSearch]         = useState(initialAddress || '')
  const [results,        setResults]        = useState([])
  const [searching,      setSearching]      = useState(false)
  const [noResults,      setNoResults]      = useState(false)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [selected,       setSelected]       = useState(
    initialLat && initialLng
      ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng), address: initialAddress || '' }
      : null
  )

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current || mapObjRef.current) return
      const map = L.map(mapRef.current, {
        center: [initialLat || MED_LAT, initialLng || MED_LNG],
        zoom:   initialLat ? 16 : DEFAULT_ZOOM,
        zoomControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      if (initialLat && initialLng) {
        markerRef.current = L.marker([initialLat, initialLng], { icon: makePinIcon(L), draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon: makePinIcon(L), draggable: true }).addTo(map)
          markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
        }
        handleMarkerMove(L, { lat, lng })
      })

      mapObjRef.current = map
      setMapReady(true)
      setTimeout(() => map.invalidateSize(), 0)
    }).catch((e) => {
      console.error('Selector mapa: error cargando Leaflet', e)
      setMapError('No se pudo cargar el mapa. Revisa la conexion e intenta de nuevo.')
    })
    return () => {
      cancelled = true
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; markerRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarkerMove = useCallback(async (L, { lat, lng }) => {
    setReverseLoading(true)
    const addr = await reverseGeocode(lat, lng)
    setReverseLoading(false)
    const shortAddr = addr
      ? addr.split(',').slice(0, 3).join(',').trim()
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    setSelected({ lat, lng, address: shortAddr })
    setSearch(shortAddr)
    setResults([])
    setNoResults(false)
  }, [])

  const handleSearchInput = (val) => {
    setSearch(val)
    setNoResults(false)
    clearTimeout(searchTimer.current)
    if (val.length < 3) { setResults([]); return }

    // Coordenadas pegadas desde Google Maps u otro origen
    const coords = parseCoords(val)
    if (coords) {
      const L = window.L
      if (L && mapObjRef.current) {
        if (markerRef.current) {
          markerRef.current.setLatLng([coords.lat, coords.lng])
        } else {
          markerRef.current = L.marker([coords.lat, coords.lng], { icon: makePinIcon(L), draggable: true }).addTo(mapObjRef.current)
          markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
        }
        mapObjRef.current.flyTo([coords.lat, coords.lng], 17, { duration: 1 })
        handleMarkerMove(L, coords)
      }
      return
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchAddress(val)
      setResults(res)
      setNoResults(res.length === 0)
      setSearching(false)
    }, 400)
  }

  const selectResult = useCallback((item) => {
    const L = window.L
    if (!L || !mapObjRef.current) return
    const { lat, lng } = item
    const address = item.display_name.split(',').slice(0, 3).join(',').trim()
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon: makePinIcon(L), draggable: true }).addTo(mapObjRef.current)
      markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
    }
    mapObjRef.current.flyTo([lat, lng], 17, { duration: 1 })
    setSelected({ lat, lng, address })
    setSearch(address)
    setResults([])
    setNoResults(false)
  }, [handleMarkerMove])

  const handleConfirm = () => { if (selected) onConfirm(selected) }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/50">
      <div className="flex flex-col bg-white w-full h-full max-w-3xl mx-auto shadow-2xl md:my-4 md:rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Seleccionar ubicación</h2>
            <p className="text-xs text-gray-400 mt-0.5">Busca el barrio o calle, luego arrastra el pin al punto exacto</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">✕</button>
        </div>

        {/* Tip coordenadas */}
        <div className="px-4 pt-3 pb-1 flex-shrink-0">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
            <span className="text-sm leading-none mt-0.5">📍</span>
            <p className="text-xs text-blue-700 leading-relaxed">
              <span className="font-semibold">Ubicación exacta:</span> en Google Maps, mantén presionado el punto → copia las coordenadas → pégalas en el buscador.
            </p>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="px-4 pt-2 pb-2 flex-shrink-0 relative">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="input pl-9 pr-4 text-sm w-full"
              placeholder="Barrio, calle, o coordenadas: 6.2651, -75.5936"
              value={search}
              onChange={e => handleSearchInput(e.target.value)}
              autoFocus
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {results.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-[9999] overflow-hidden max-h-60 overflow-y-auto">
              {results.map((r, i) => (
                <button key={i} onClick={() => selectResult(r)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-brand-pink mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="line-clamp-2 text-gray-700">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
          {noResults && !searching && search.length >= 3 && (
            <div className="absolute left-4 right-4 mt-1 bg-white rounded-xl shadow border border-gray-100 z-[9999] px-4 py-3 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">No se encontró esa dirección</p>
              <p>• Prueba solo con la calle: <span className="font-mono text-gray-600">"Calle 92"</span> o el barrio</p>
              <p>• O pega coordenadas de Google Maps: <span className="font-mono text-gray-600">6.265, -75.591</span></p>
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-center px-6">
              <div className="max-w-sm">
                <p className="text-sm font-semibold text-red-600">{mapError}</p>
                <p className="text-xs text-gray-400 mt-1">Puedes cerrar e intentar nuevamente cuando la conexion al proveedor del mapa vuelva.</p>
              </div>
            </div>
          )}
          {!mapReady && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-5 h-5 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Cargando mapa...</span>
              </div>
            </div>
          )}
          {mapReady && !selected && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow text-xs text-gray-600 pointer-events-none">
              Haz clic en el mapa o busca el barrio / calle
            </div>
          )}
          {selected && mapReady && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow text-[11px] text-gray-500 pointer-events-none whitespace-nowrap">
              📍 Arrastra el pin para ajustar la ubicación exacta
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          {selected ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <svg className="w-3.5 h-3.5 text-brand-pink flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ubicación seleccionada</span>
                  {reverseLoading && <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />}
                </div>
                <p className="text-sm text-gray-800 font-medium truncate">{selected.address}</p>
                <p className="text-[11px] text-gray-400 font-mono">{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</p>
              </div>
              <button onClick={handleConfirm} className="btn-primary flex-shrink-0">
                Confirmar ubicación
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Busca o haz clic en el mapa para marcar</p>
              <button onClick={onClose} className="btn-secondary">Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
