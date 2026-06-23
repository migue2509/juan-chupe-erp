import { useEffect, useState, useCallback } from 'react'
import { getRangeReport } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const fmt    = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtPct = n  => `${n}%`
// Usa fecha LOCAL (no UTC) para evitar desfase con hora de Bogotá
const localDate  = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today       = () => localDate()
const startOfWeek = () => {
  const d   = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return localDate(d)
}
const startOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  return localDate(d)
}

const PERIODS = [
  { key: 'daily',   label: 'Hoy' },
  { key: 'weekly',  label: 'Esta semana' },
  { key: 'monthly', label: 'Este mes' },
  { key: 'range',   label: 'Rango' },
]

const PIE_COLORS = ['#00E5FF', '#7B2FFF']

export default function Reports() {
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
      const res = await getRangeReport(from, to)
      setData(res.data)
    } catch {}
    setLoading(false)
  }, [getRange])

  useEffect(() => {
    if (period !== 'range') load()
  }, [period, load])

  const handleRangeApply = () => load()

  const pieData = data ? [
    { name: 'Efectivo',       value: data.payment_pct.cash },
    { name: 'Transferencia',  value: data.payment_pct.transfer },
  ] : []

  const totalSellers = data?.sellers?.reduce((s, v) => s + v.total, 0) || 1

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1>Reportes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Análisis de ventas por período</p>
      </div>

      {/* Selector de período */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
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
            <button onClick={handleRangeApply} className="btn-primary py-1.5 text-sm">
              Aplicar
            </button>
          </div>
        )}

        {data && !loading && (
          <span className="ml-auto text-xs text-gray-400">
            {data.date_from === data.date_to ? data.date_from : `${data.date_from} → ${data.date_to}`}
            {' · '}{data.sales_count} venta{data.sales_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="flex justify-center py-20 text-gray-300 text-sm">Sin datos para este período</div>
      ) : (
        <div className="space-y-5">

          {/* Stats resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <span className="stat-label">Total recibido</span>
              <span className="stat-value text-brand-pink">{fmt(data.total_sales)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Efectivo</span>
              <span className="stat-value text-brand-cyan">{fmt(data.total_cash)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Transferencias</span>
              <span className="stat-value text-brand-purple">{fmt(data.total_transfer)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Neto en caja</span>
              <span className={`stat-value ${data.net_cash < 0 ? 'text-red-500' : 'text-green-600'}`}>
                {fmt(data.net_cash)}
              </span>
            </div>
          </div>

          {/* Fila 1: Ventas por vendedora + Medio de pago */}
          <div className="grid lg:grid-cols-3 gap-5">

            {/* Ventas por vendedora */}
            <div className="lg:col-span-2 card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2>Ventas por Vendedora</h2>
              </div>
              {data.sellers.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <div>
                  <div className="grid px-5 py-2.5 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest"
                    style={{ gridTemplateColumns: '1fr 110px 70px 160px 50px' }}>
                    {['Vendedora', 'Ventas', 'Trans.', 'Participación', ''].map(h => <span key={h}>{h}</span>)}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {data.sellers.map((s, i) => {
                      const pct = Math.round((s.total / totalSellers) * 100)
                      return (
                        <div key={s.name} className="grid px-5 py-3.5 items-center"
                          style={{ gridTemplateColumns: '1fr 110px 70px 160px 50px' }}>
                          <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                          <span className="text-sm font-bold text-brand-pink tabular-nums">{fmt(s.total)}</span>
                          <span className="text-sm tabular-nums text-gray-500">{s.count}</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-brand-cyan transition-all"
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-500 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Medio de pago */}
            <div className="card flex flex-col">
              <h2 className="mb-4">Medio de Pago</h2>
              {data.total_money === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Sin ventas</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                        dataKey="value" paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {pieData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                          <span className="text-gray-600">{entry.name}</span>
                        </div>
                        <span className="font-bold text-gray-800">{entry.value}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm">
                    <span className="text-gray-400">Efectivo</span>
                    <span className="font-semibold">{fmt(data.total_cash)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Transferencia</span>
                    <span className="font-semibold">{fmt(data.total_transfer)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fila 2: Ventas por tamaño de vaso + sabores */}
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Ventas por tamaño de vaso */}
            <div className="card">
              <h2 className="mb-4">Ventas por Tamaño de Vaso</h2>
              {data.cup_sales.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.cup_sales} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="size" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v, name) => [name === 'count' ? `${v} uds` : fmt(v), name === 'count' ? 'Cantidad' : 'Ventas']}
                      contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#00E5FF" radius={[6, 6, 0, 0]} name="count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Sabores más vendidos */}
            <div className="card">
              <h2 className="mb-4">Sabores más Vendidos</h2>
              {data.flavors.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {data.flavors.map((f, i) => {
                    const maxMl = data.flavors[0]?.ml || 1
                    const pct   = Math.round((f.ml / maxMl) * 100)
                    return (
                      <div key={f.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700 truncate">{f.name}</span>
                          <span className="text-gray-400 tabular-nums ml-2">{f.ml.toFixed(0)} ml</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-pink transition-all"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
