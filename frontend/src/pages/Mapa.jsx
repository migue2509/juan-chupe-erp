import { useEffect, useRef, useState } from 'react'
import { getDeliveryHeatmap } from '../api'

const MED_LAT    = 6.2442
const MED_LNG    = -75.5812
const ZOOM_INI   = 13
const STORE_LAT  = 6.285462773644746
const STORE_LNG  = -75.57793997784694

// ── Cargar Leaflet + Leaflet.heat desde CDN ──────────────────────────────────
let mapLibsReady = null
function loadMapLibs() {
  if (mapLibsReady) return mapLibsReady
  mapLibsReady = new Promise((resolve) => {
    if (window.L?.heatLayer) { resolve(window.L); return }

    // CSS
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // Leaflet JS
    const s1 = document.createElement('script')
    s1.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s1.onload = () => {
      // Leaflet.heat JS
      const s2 = document.createElement('script')
      s2.src = 'https://leaflet.github.io/Leaflet.heat/dist/leaflet-heat.js'
      s2.onload = () => resolve(window.L)
      document.head.appendChild(s2)
    }
    document.head.appendChild(s1)
  })
  return mapLibsReady
}

const fmt = n => `$${Number(n || 0).toLocaleString('es-CO')}`

export default function Mapa() {
  const mapRef    = useRef(null)
  const mapObjRef = useRef(null)
  const heatRef   = useRef(null)

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [selected, setSelected] = useState(null) // punto seleccionado en el mapa
  const [legendOpen, setLegendOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      const r = await getDeliveryHeatmap(params)
      setData(r.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Cargar datos al montar y al filtrar
  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializar mapa una vez
  useEffect(() => {
    loadMapLibs().then((L) => {
      if (!mapRef.current || mapObjRef.current) return

      const map = L.map(mapRef.current, {
        center: [STORE_LAT, STORE_LNG],
        zoom:   ZOOM_INI,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Marcador del negocio
      const storeIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:36px; height:36px; border-radius:50%;
            background:#FF0099; border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            display:flex; align-items:center; justify-content:center;
            font-size:18px; line-height:1;
          ">🧋</div>
        `,
        iconSize:   [36, 36],
        iconAnchor: [18, 18],
        popupAnchor:[0, -20],
      })
      L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon, zIndexOffset: 9999 })
        .addTo(map)
        .bindPopup('<b>Juan Chupe Granizados</b><br/>Tu negocio', { maxWidth: 180 })

      // Capa de calor vacía
      heatRef.current = L.heatLayer([], {
        radius:  30,
        blur:    20,
        maxZoom: 17,
        gradient: { 0.0: '#3b82f6', 0.3: '#8b5cf6', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#FF0099' },
      }).addTo(map)

      mapObjRef.current = map
    })

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove()
        mapObjRef.current = null
        heatRef.current   = null
      }
    }
  }, [])

  // Actualizar heat map cuando llegan datos
  useEffect(() => {
    if (!data || !heatRef.current) return
    const points = data.points.map(p => [
      parseFloat(p.latitude),
      parseFloat(p.longitude),
      1, // peso uniforme
    ])
    heatRef.current.setLatLngs(points)

    // Markers clickeables (círculos pequeños)
    if (!mapObjRef.current) return
    const L = window.L
    if (!L) return

    // Limpiar markers anteriores
    if (mapObjRef.current._markerLayer) {
      mapObjRef.current._markerLayer.remove()
    }

    const markerLayer = L.layerGroup().addTo(mapObjRef.current)
    mapObjRef.current._markerLayer = markerLayer

    data.points.forEach(p => {
      const isHistorical = p.status === 'historical'
      const circle = L.circleMarker([parseFloat(p.latitude), parseFloat(p.longitude)], {
        radius: isHistorical ? 4 : 5,
        color:       isHistorical ? '#64748b' : '#FF0099',
        fillColor:   isHistorical ? '#94a3b8' : '#FF0099',
        fillOpacity: isHistorical ? 0.5 : 0.7,
        weight: 1.5,
      })
      circle.on('click', () => setSelected(p))
      circle.addTo(markerLayer)
    })
  }, [data])

  const handleFilter = (e) => {
    e.preventDefault()
    fetchData()
  }

  const pct = data
    ? data.total_deliveries > 0
      ? Math.round((data.total_with_coords / data.total_deliveries) * 100)
      : 0
    : 0

  const statusColor = {
    pending:    'text-amber-600 bg-amber-50',
    on_way:     'text-blue-600 bg-blue-50',
    delivered:  'text-green-600 bg-green-50',
    cancelled:  'text-red-500 bg-red-50',
    historical: 'text-slate-500 bg-slate-100',
  }
  const statusLabel = {
    pending:    'Pendiente',
    on_way:     'En camino',
    delivered:  'Entregado',
    cancelled:  'Cancelado',
    historical: 'Histórico',
  }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 64px)' }}>

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mapa de domicilios</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Zonas de calor de entregas en Medellín
            </p>
          </div>

          {/* Stats */}
          {data && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-brand-pink">{data.total_with_coords}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Con ubicación</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-700">{data.total_deliveries}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Mapeados</p>
              </div>
            </div>
          )}
        </div>

        {/* Filtros de fecha */}
        <form onSubmit={handleFilter} className="flex items-center gap-2 mt-3 flex-wrap">
          <label className="text-xs text-gray-500 font-medium">Desde</label>
          <input type="date" className="input text-sm py-1.5 w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <label className="text-xs text-gray-500 font-medium">Hasta</label>
          <input type="date" className="input text-sm py-1.5 w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button type="submit" className="btn-primary text-sm py-1.5 px-4">
            {loading ? 'Cargando...' : 'Aplicar'}
          </button>
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setTimeout(fetchData, 0) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Limpiar filtro
            </button>
          )}
        </form>
      </div>

      {/* Layout mapa + panel */}
      <div className="flex-1 flex overflow-hidden">

        {/* Mapa */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Leyenda colapsable */}
          <div className="absolute bottom-6 left-4 text-xs" style={{ zIndex: 1000 }}>
            {legendOpen ? (
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden" style={{ minWidth: 170 }}>
                {/* Header con botón cerrar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <p className="font-bold text-gray-600 uppercase tracking-wide text-[10px]">Leyenda</p>
                  <button
                    onClick={() => setLegendOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-base leading-none ml-2"
                    title="Cerrar leyenda"
                  >✕</button>
                </div>

                <div className="px-3 py-2.5 space-y-3">
                  {/* Densidad de calor */}
                  <div>
                    <p className="font-bold text-gray-400 uppercase tracking-wide text-[10px] mb-1.5">Densidad de zona</p>
                    <div className="space-y-1">
                      {[
                        { color: '#3b82f6', label: 'Muy pocas entregas' },
                        { color: '#8b5cf6', label: 'Pocas entregas' },
                        { color: '#f59e0b', label: 'Zona media' },
                        { color: '#ef4444', label: 'Zona frecuente' },
                        { color: '#FF0099', label: 'Zona muy frecuente' },
                      ].map(({ color, label }) => (
                        <div key={color} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-gray-600">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de punto */}
                  <div className="border-t border-gray-100 pt-2.5">
                    <p className="font-bold text-gray-400 uppercase tracking-wide text-[10px] mb-1.5">Tipo de punto</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#FF0099' }} />
                        <span className="text-gray-600">Domicilio real</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#94a3b8' }} />
                        <span className="text-gray-600">Histórico</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">🧋</span>
                        <span className="text-gray-600">Tu negocio</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setLegendOpen(true)}
                className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 hover:bg-white transition-colors"
                title="Ver leyenda"
              >
                {/* Mini chips de colores */}
                <div className="flex gap-0.5">
                  {['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#FF0099'].map(c => (
                    <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-gray-600 font-medium">Leyenda</span>
                <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                </svg>
              </button>
            )}
          </div>

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl shadow">
                <div className="w-5 h-5 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Cargando puntos...</span>
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="w-72 flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Detalle del domicilio</p>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Dirección</p>
                  <p className="text-sm text-gray-800">{selected.address || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
                  <p className="text-sm text-gray-800">{selected.four_digits || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Estado</p>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[selected.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabel[selected.status] || selected.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Coordenadas</p>
                  <p className="text-xs font-mono text-gray-500">
                    {parseFloat(selected.latitude).toFixed(6)}, {parseFloat(selected.longitude).toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Fecha</p>
                  <p className="text-sm text-gray-600">
                    {new Date(selected.created_at).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Últimos domicilios</p>
                <p className="text-xs text-gray-400 mt-0.5">Haz clic en un punto del mapa para ver detalles</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {data?.points?.slice().reverse().slice(0, 30).map(p => (
                  <button key={p.id} onClick={() => {
                    setSelected(p)
                    if (mapObjRef.current) {
                      mapObjRef.current.flyTo([parseFloat(p.latitude), parseFloat(p.longitude)], 17, { duration: 1 })
                    }
                  }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.address || 'Sin dirección'}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(p.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short' })}
                          {p.four_digits ? ` · ${p.four_digits}` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusColor[p.status] || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                    </div>
                  </button>
                ))}
                {!data?.points?.length && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                    <svg className="w-10 h-10 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                      <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
                    </svg>
                    <p className="text-sm">No hay domicilios con ubicación</p>
                    <p className="text-xs mt-1 text-center px-6">Los próximos domicilios desde el POS aparecerán aquí</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
