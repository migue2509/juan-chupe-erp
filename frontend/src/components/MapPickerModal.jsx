import { useEffect, useRef, useState, useCallback } from 'react'
import { loadLeaflet } from '../utils/leafletLoader'

const MED_LAT      = 6.2442
const MED_LNG      = -75.5812
const DEFAULT_ZOOM = 14

async function searchAddress(query, signal) {
  const params = new URLSearchParams({ q: query.trim(), lat: String(MED_LAT), lon: String(MED_LNG), limit: '6', countrycode: 'CO' })
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!response.ok) throw new Error('search_unavailable')
  const data = await response.json()
  if (!Array.isArray(data.features)) throw new Error('invalid_response')
  return data.features.flatMap(feature => {
    const p = feature?.properties || {}
    const coordinates = feature?.geometry?.coordinates
    if (!Array.isArray(coordinates)) return []
    const [lng, lat] = coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return []
    if (String(p.countrycode || '').toUpperCase() !== 'CO') return []
    const parts = [p.name, p.street !== p.name ? p.street : null,
      typeof p.housenumber === 'string' ? `# ${p.housenumber}` : null,
      p.locality || p.suburb || p.district, p.city || p.town || p.village, p.state]
      .filter(value => typeof value === 'string' && value.trim())
    return [{ lat, lng, display_name: [...new Set(parts)].join(', ') || query, approximate: !p.housenumber }]
  })
}

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
  const requestRef = useRef(null)
  const searchRef = useRef(initialAddress || '')

  const [mapReady,       setMapReady]       = useState(false)
  const [mapError,       setMapError]       = useState('')
  const [search,         setSearch]         = useState(initialAddress || '')
  const [results,        setResults]        = useState([])
  const [searching,      setSearching]      = useState(false)
  const [noResults,      setNoResults]      = useState(false)
  const [searchError, setSearchError] = useState('')
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
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 0)
    }).catch((e) => {
      console.error('Selector mapa: error cargando Leaflet', e)
      if (cancelled) return
      setMapError('No se pudo cargar el mapa. Revisa la conexion e intenta de nuevo.')
    })
    return () => {
      cancelled = true
      requestRef.current?.abort()
      requestRef.current = null
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; markerRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarkerMove = useCallback((L, { lat, lng }) => {
    requestRef.current?.abort()
    requestRef.current = null
    setSearching(false)
    setSelected({ lat, lng, address: searchRef.current.trim(), approximate: false })
    setResults([])
    setNoResults(false)
    setSearchError('')
  }, [])

  const handleSearchInput = (val) => {
    requestRef.current?.abort()
    requestRef.current = null
    searchRef.current = val
    setSearch(val)
    setSelected(null)
    markerRef.current?.remove()
    markerRef.current = null
    setResults([])
    setNoResults(false)
    setSearching(false)
    setSearchError('')
  }

  const handleSearch = async () => {
    const query = search.trim()
    if (query.length < 3 || !mapReady || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setSelected(null)
    markerRef.current?.remove()
    markerRef.current = null
    setResults([])
    setNoResults(false)
    setSearchError('')
    setSearching(true)
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const coords = parseCoords(query)
      const found = coords ? [{ ...coords, display_name: query, approximate: false }]
        : await searchAddress(query, controller.signal)
      if (requestRef.current !== controller) return
      if (found.length === 1) selectResult(found[0])
      else setResults(found)
      setNoResults(found.length === 0)
    } catch {
      if (requestRef.current === controller) {
        setSearchError('No se pudo consultar el buscador. Revisa la conexión y vuelve a intentar.')
      }
    } finally {
      clearTimeout(timeout)
      if (requestRef.current === controller) {
        requestRef.current = null
        setSearching(false)
      }
    }
  }

  const selectResult = useCallback((item) => {
    const L = window.L
    if (!L || !mapObjRef.current) return
    const { lat, lng } = item
    const address = searchRef.current.trim() || item.display_name
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon: makePinIcon(L), draggable: true }).addTo(mapObjRef.current)
      markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
    }
    mapObjRef.current.flyTo([lat, lng], 17, { duration: 1 })
    setSelected({ lat, lng, address, approximate: item.approximate, matchedAddress: item.display_name })
    setSearch(address)
    searchRef.current = address
    setResults([])
    setNoResults(false)
  }, [handleMarkerMove])

  const handleConfirm = () => { if (selected?.address && !searching) onConfirm({ lat: selected.lat, lng: selected.lng, address: selected.address }) }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/50">
      <div className="flex flex-col bg-white w-full h-full max-w-3xl mx-auto shadow-2xl md:my-4 md:rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Buscar dirección del domicilio</h2>
            <p className="text-xs text-gray-400 mt-0.5">Escribe la dirección y el municipio para ubicarla en el mapa</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">✕</button>
        </div>

        {/* Barra de búsqueda */}
        <div className="px-4 pt-2 pb-2 flex-shrink-0 relative">
          <label htmlFor="delivery-address-search" className="block text-sm font-medium text-gray-700 mb-2">Dirección y municipio</label>
          <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="delivery-address-search"
              maxLength={250}
              className="input pl-9 pr-4 text-sm w-full"
              placeholder="Ej.: Calle 10 # 43A-25, Medellín"
              value={search}
              onChange={e => handleSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              autoFocus
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <button type="button" onClick={handleSearch} disabled={!mapReady || searching || search.trim().length < 3}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Apartamento, piso e indicaciones van en el campo de referencia del pedido.</p>
          {searchError && <p role="alert" className="text-sm text-red-600 mt-2">{searchError}</p>}
          {results.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-[9999] overflow-hidden max-h-60 overflow-y-auto">
              <p className="px-4 py-2 text-xs font-semibold text-gray-500">Elige la coincidencia correcta</p>
              {results.map((r, i) => (
                <button type="button" key={i} onClick={() => selectResult(r)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-brand-pink mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="text-gray-700">{r.display_name}{r.approximate && <span className="block text-xs text-amber-700">Ubicación aproximada: verifica el punto en el mapa</span>}</span>
                </button>
              ))}
            </div>
          )}
          {noResults && !searching && search.length >= 3 && (
            <div className="absolute left-4 right-4 mt-1 bg-white rounded-xl shadow border border-gray-100 z-[9999] px-4 py-3 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">No se encontró esa dirección</p>
              <p>Revisa la nomenclatura e incluye el municipio. Si la dirección no está registrada, puedes marcar el punto en el mapa.</p>
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
              Escribe la dirección y pulsa Buscar
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
                </div>
                <p className="text-sm text-gray-800 font-medium truncate">{selected.address}</p>
                {selected.matchedAddress && <p className="text-xs text-gray-500">Resultado: {selected.matchedAddress}</p>}
                {selected.approximate && <p className="text-xs text-amber-700 mt-1">Ubicación aproximada. Verifica y ajusta el marcador antes de confirmar.</p>}
                {!selected.address && <p className="text-xs text-amber-700">Escribe primero la dirección del domicilio.</p>}
              </div>
              <button type="button" onClick={handleConfirm} disabled={!selected.address || searching} className="btn-primary flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                Confirmar ubicación
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Busca o haz clic en el mapa para marcar</p>
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
