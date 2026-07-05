import { useEffect, useState, useCallback } from 'react'
import { getPlatformReport } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const fmt  = n => `$${Number(n).toLocaleString('es-CO')}`
const fmtN = n => Number(n).toLocaleString('es-CO')

const localDate = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today        = () => localDate()
const startOfWeek  = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); return localDate(d) }
const startOfMonth = () => { const d = new Date(); d.setDate(1); return localDate(d) }

const PERIODS = [
  { key: 'daily',   label: 'Hoy' },
  { key: 'weekly',  label: 'Esta semana' },
  { key: 'monthly', label: 'Este mes' },
  { key: 'range',   label: 'Rango' },
]

const RAPPI_COLOR = '#FF424D'
const DIDI_COLOR  = '#FF6600'

const platformColor = ch => ch === 'rappi' ? RAPPI_COLOR : ch === 'didi' ? DIDI_COLOR : '#7B2FFF'
const platformLabel = ch => ch === 'rappi' ? 'Rappi' : ch === 'didi' ? 'DiDi' : 'Plataformas'

export default function Platforms() {
  const [channel,  setChannel]  = useState('all')
  const [period,   setPeriod]   = useState('daily')
  const [dateFrom, setDateFrom] = useState(localDate())
  const [dateTo,   setDateTo]   = useState(localDate())
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)

  const getRange = useCallback(() => {
    if (period === 'daily')   return [today(), today()]
    if (period === 'weekly')  return [startOfWeek(), today()]
    if (period === 'monthly') return [startOfMonth(), today()]
    return [dateFrom, dateTo]
  }, [period, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [from, to] = getRange()
      const res = await getPlatformReport(from, to, channel)
      setData(res.data)
    } catch {}
    setLoading(false)
  }, [getRange, channel])

  useEffect(() => {
    if (period !== 'range') load()
  }, [period, channel, load])

  const accentColor = platformColor(channel)
  const { summary = {}, by_promo = [], by_seller = [], by_day = [], top_flavors = [], platform_split = {} } = data || {}
  const maxPromo   = Math.max(...by_promo.map(p => p.orders), 1)
  const maxSeller  = Math.max(...by_seller.map(s => s.net), 1)
  const maxFlavor  = Math.max(...top_flavors.map(f => f.ml), 1)
  const feePct     = summary.gross > 0 ? Math.round((summary.fee / summary.gross) * 100) : 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Plataformas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Análisis de ventas Rappi y DiDi</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Platform badges */}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: RAPPI_COLOR }}>Rappi</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: DIDI_COLOR }}>DiDi</span>
        </div>
      </div>

      {/* Controles */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
        {/* Canal */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
          {[
            { key: 'all',   label: 'Ambas' },
            { key: 'rappi', label: 'Rappi', color: RAPPI_COLOR },
            { key: 'didi',  label: 'DiDi',  color: DIDI_COLOR },
          ].map(c => (
            <button key={c.key} onClick={() => setChannel(c.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={channel === c.key
                ? { background: c.color || '#7B2FFF', color: '#fff' }
                : { color: '#6b7280' }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Período */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {period === 'range' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">Desde</label>
              <input type="date" className="input py-1.5 text-sm w-36"
                value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">Hasta</label>
              <input type="date" className="input py-1.5 text-sm w-36"
                value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button onClick={load} className="btn-primary py-1.5 text-sm">Aplicar</button>
          </div>
        )}

        {data && !loading && (
          <span className="ml-auto text-xs text-gray-400">
            {data.date_from === data.date_to ? data.date_from : `${data.date_from} → ${data.date_to}`}
            {' · '}{summary.orders} pedido{summary.orders !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="flex justify-center py-20 text-gray-300 text-sm">Sin datos para este período</div>
      ) : (
        <div className="space-y-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-1">
                <span className="stat-label">Pedidos</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: accentColor }}>
                  #
                </span>
              </div>
              <span className="stat-value text-gray-900 text-2xl">{fmtN(summary.orders)}</span>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-1">
                <span className="stat-label">Bruto (precio plataforma)</span>
                <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold">$</span>
              </div>
              <span className="stat-value text-gray-900 text-2xl">{fmt(summary.gross)}</span>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-1">
                <span className="stat-label">Comisión plataforma</span>
                <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 text-xs font-bold">%</span>
              </div>
              <span className="stat-value text-red-500 text-2xl">{fmt(summary.fee)}</span>
              {feePct > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{feePct}% del bruto</p>}
            </div>

            <div className="stat-card border-2" style={{ borderColor: accentColor + '40' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="stat-label">Neto recibido</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: accentColor }}>
                  ✓
                </span>
              </div>
              <span className="stat-value text-2xl" style={{ color: accentColor }}>{fmt(summary.net)}</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Después de comisión</p>
            </div>
          </div>

          {/* Split por plataforma (solo en vista "Ambas") */}
          {channel === 'all' && Object.keys(platform_split).length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {['rappi', 'didi'].map(pl => {
                const s = platform_split[pl]
                if (!s) return null
                const color = platformColor(pl)
                const feeAmt = s.gross - s.net
                return (
                  <div key={pl} className="card border-l-4" style={{ borderLeftColor: color }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: color }}>
                        {platformLabel(pl)}
                      </span>
                      <span className="text-sm text-gray-500">{s.orders} pedido{s.orders !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Bruto</p>
                        <p className="text-sm font-bold text-gray-700">{fmt(s.gross)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Comisión</p>
                        <p className="text-sm font-bold text-red-500">{fmt(feeAmt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Neto</p>
                        <p className="text-sm font-bold" style={{ color }}>{fmt(s.net)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tendencia diaria */}
          {by_day.length > 1 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2>Tendencia de pedidos</h2>
              </div>
              <div className="px-4 py-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={by_day} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth()+1}` }}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(v, name) => [name === 'orders' ? `${v} pedidos` : fmt(v), name === 'orders' ? 'Pedidos' : 'Neto']}
                      contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                    />
                    <Bar dataKey="orders" name="orders" fill={accentColor} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Fila: Combos + Vendedoras */}
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Combos más vendidos */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2>Combos más pedidos</h2>
              </div>
              {by_promo.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <>
                  <div className="divide-y divide-gray-50">
                    {by_promo.map((p, i) => {
                      const color = platformColor(p.category)
                      const pct = Math.round((p.orders / maxPromo) * 100)
                      return (
                        <div key={p.name} className="px-5 py-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                                style={{ background: color }}>
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                              <span className="badge-gray text-[10px] flex-shrink-0">{p.orders} pedidos</span>
                            </div>
                            <span className="text-sm font-bold tabular-nums ml-2 flex-shrink-0" style={{ color }}>
                              {fmt(p.net)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                            <span>Bruto: {fmt(p.gross)}</span>
                            <span className="text-red-400">Comisión: {fmt(p.fee)}</span>
                            <span>{p.fee_pct}% fee</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total neto</span>
                    <span className="text-base font-bold tabular-nums" style={{ color: accentColor }}>{fmt(summary.net)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Ventas por vendedora */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2>Ventas por vendedora</h2>
              </div>
              {by_seller.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <>
                  <div className="px-5 py-4 space-y-3">
                    {by_seller.map((s, i) => {
                      const pct = Math.round((s.net / maxSeller) * 100)
                      return (
                        <div key={s.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                              <span className="badge-gray text-[10px] flex-shrink-0">{s.count} {s.count === 1 ? 'pedido' : 'pedidos'}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 tabular-nums ml-3 flex-shrink-0">{fmt(s.net)}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: accentColor }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
                    <span className="text-base font-bold text-gray-900 tabular-nums">{fmt(summary.net)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sabores más pedidos */}
          {top_flavors.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2>Sabores más pedidos</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                {top_flavors.map(f => {
                  const pct = Math.round((f.ml / maxFlavor) * 100)
                  return (
                    <div key={f.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{f.name}</span>
                        <span className="text-gray-400 tabular-nums ml-2">{f.ml.toFixed(0)} ml</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: accentColor }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sin pedidos */}
          {summary.orders === 0 && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: accentColor + '18' }}>
                <span className="text-xl">📦</span>
              </div>
              <p className="text-gray-500 font-medium">Sin pedidos de plataforma</p>
              <p className="text-sm text-gray-400 mt-1">No hay ventas de {platformLabel(channel)} en este período</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
