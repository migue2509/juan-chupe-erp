import { useEffect, useRef, useState, useCallback } from 'react'

// Medellín center
const MED_LAT = 6.2442
const MED_LNG = -75.5812
const DEFAULT_ZOOM = 14

// ── Leaflet CDN loader (idempotente) ────────────────────────────────────────
let leafletReady = null
function loadLeaflet() {
  if (leafletReady) return leafletReady
  leafletReady = new Promise((resolve) => {
    if (window.L) { resolve(window.L); return }

    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve(window.L)
    document.head.appendChild(script)
  })
  return leafletReady
}

// ── Nominatim search ─────────────────────────────────────────────────────────
async function searchAddress(query) {
  if (!query.trim()) return []
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Medellín, Colombia')}&countrycodes=co&limit=6&addressdetails=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
  return res.ok ? await res.json() : []
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
  if (!res.ok) return null
  const data = await res.json()
  return data.display_name || null
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function MapPickerModal({ onConfirm, onClose, initialLat, initialLng, initialAddress }) {
  const mapRef     = useRef(null)
  const mapObjRef  = useRef(null)
  const markerRef  = useRef(null)
  const [mapReady, setMapReady]       = useState(false)
  const [search,   setSearch]         = useState(initialAddress || '')
  const [results,  setResults]        = useState([])
  const [searching, setSearching]     = useState(false)
  const [selected, setSelected]       = useState(
    initialLat && initialLng
      ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng), address: initialAddress || '' }
      : null
  )
  const [reverseLoading, setReverseLoading] = useState(false)
  const searchTimer = useRef(null)

  // Inicializar mapa
  useEffect(() => {
    loadLeaflet().then((L) => {
      if (!mapRef.current || mapObjRef.current) return

      const map = L.map(mapRef.current, {
        center: [initialLat || MED_LAT, initialLng || MED_LNG],
        zoom: initialLat ? 16 : DEFAULT_ZOOM,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Ícono personalizado
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:40px;
          background:linear-gradient(135deg,#FF0099,#ff5cc8);
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 3px 10px rgba(255,0,153,0.5);
          border:2px solid white;
        "></div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -44],
      })

      // Marker inicial si hay coords
      if (initialLat && initialLng) {
        markerRef.current = L.marker([initialLat, initialLng], { icon: pinIcon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
      }

      // Clic en mapa para poner pin
      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
          markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
        }
        handleMarkerMove(L, { lat, lng })
      })

      mapObjRef.current = map
      setMapReady(true)
    })

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove()
        mapObjRef.current = null
        markerRef.current = null
      }
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
  }, [])

  // Búsqueda con debounce
  const handleSearchInput = (val) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    if (val.length < 3) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchAddress(val)
      setResults(res)
      setSearching(false)
    }, 500)
  }

  const selectResult = useCallback((item) => {
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)
    const L   = window.L
    if (!L || !mapObjRef.current) return

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:32px;height:40px;
        background:linear-gradient(135deg,#FF0099,#ff5cc8);
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 10px rgba(255,0,153,0.5);
        border:2px solid white;
      "></div>`,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    })

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(mapObjRef.current)
      markerRef.current.on('dragend', () => handleMarkerMove(L, markerRef.current.getLatLng()))
    }

    mapObjRef.current.flyTo([lat, lng], 17, { duration: 1 })

    const shortAddr = item.display_name
      ? item.display_name.split(',').slice(0, 3).join(',').trim()
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`

    setSelected({ lat, lng, address: shortAddr })
    setSearch(shortAddr)
    setResults([])
  }, [handleMarkerMove])

  const handleConfirm = () => {
    if (selected) onConfirm(selected)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/50">
      <div className="flex flex-col bg-white w-full h-full max-w-3xl mx-auto shadow-2xl md:my-4 md:rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Seleccionar ubicación</h2>
            <p className="text-xs text-gray-400 mt-0.5">Busca la dirección o haz clic en el mapa</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">✕</button>
        </div>

        {/* Search bar */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0 relative">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="input pl-9 pr-4 text-sm w-full"
              placeholder="Busca calle, barrio, lugar en Medellín..."
              value={search}
              onChange={e => handleSearchInput(e.target.value)}
              autoFocus
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Resultados */}
          {results.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-10 overflow-hidden">
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
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-5 h-5 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Cargando mapa...</span>
              </div>
            </div>
          )}
          {/* Instrucción flotante */}
          {mapReady && !selected && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow text-xs text-gray-600 pointer-events-none">
              Haz clic en el mapa para marcar la ubicación
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
              <p className="text-sm text-gray-400">Selecciona un punto en el mapa o busca la dirección</p>
              <button onClick={onClose} className="btn-secondary">Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
