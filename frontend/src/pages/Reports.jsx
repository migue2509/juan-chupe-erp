import { useEffect, useState, useCallback } from 'react'
import { getRangeReport } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

const localDate = (d = new Date()) => {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today        = () => localDate()
const startOfWeek  = () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return localDate(d) }
const startOfMonth = () => { const d = new Date(); d.setDate(1); return localDate(d) }

const PERIODS  = [
  { key: 'daily',   label: 'Hoy' },
  { key: 'weekly',  label: 'Esta semana' },
  { key: 'monthly', label: 'Este mes' },
  { key: 'range',   label: 'Rango' },
]
const CHANNELS = [
  { key: 'all',      label: 'Todos' },
  { key: 'pos',      label: 'Punto de Venta' },
  { key: 'delivery', label: 'Domicilios' },
]

const PIE_COLORS   = ['#00E5FF', '#7B2FFF']
const STATUS_META  = {
  pending:   { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  on_way:    { label: 'En camino', cls: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: 'Entregado', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-600' },
}

export default function Reports() {
  const [period,   setPeriod]   = useState('daily')
  const [channel,  setChannel]  = useState('all')
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
      const res = await getRangeReport(from, to, channel)
      setData(res.data)
    } catch {}
    setLoading(false)
  }, [getRange, channel])

  useEffect(() => {
    if (period !== 'range') load()
  }, [period, channel, load])

  const pieData = data ? [
    { name: 'Efectivo',      value: data.payment_pct.cash },
    { name: 'Transferencia', value: data.payment_pct.transfer },
  ] : []

  const totalSellers = data?.sellers?.reduce((s, v) => s + v.total, 0) || 1

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1>Reportes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Análisis de ventas, domicilios y gastos por período</p>
      </div>

      {/* Controles: período + canal */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
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

        {/* Canal */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {CHANNELS.map(c => (
            <button key={c.key} onClick={() => setChannel(c.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                channel === c.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado */}
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

          {/* ── Stats resumen ── */}
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

          {/* ── Fila 1: Vendedoras + Medio de pago ── */}
          <div className="grid lg:grid-cols-3 gap-5">

            <div className="lg:col-span-2 card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><h2>Ventas por Vendedora</h2></div>
              {data.sellers.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <div>
                  <div className="grid px-5 py-2.5 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest"
                    style={{ gridTemplateColumns: '1fr 110px 70px 160px 50px' }}>
                    {['Vendedora', 'Ventas', 'Trans.', 'Participación', ''].map(h => <span key={h}>{h}</span>)}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {data.sellers.map(s => {
                      const pct = Math.round((s.total / totalSellers) * 100)
                      return (
                        <div key={s.name} className="grid px-5 py-3.5 items-center"
                          style={{ gridTemplateColumns: '1fr 110px 70px 160px 50px' }}>
                          <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                          <span className="text-sm font-bold text-brand-pink tabular-nums">{fmt(s.total)}</span>
                          <span className="text-sm tabular-nums text-gray-500">{s.count}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-500 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="card flex flex-col">
              <h2 className="mb-4">Medio de Pago</h2>
              {data.total_money === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Sin ventas</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                        dataKey="value" paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {pieData.map((e, i) => (
                      <div key={e.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                          <span className="text-gray-600">{e.name}</span>
                        </div>
                        <span className="font-bold text-gray-800">{e.value}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Efectivo</span><span className="font-semibold">{fmt(data.total_cash)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Transferencia</span><span className="font-semibold">{fmt(data.total_transfer)}</span></div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Fila 2: Vasos + Sabores ── */}
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card">
              <h2 className="mb-4">Ventas por Tamaño de Vaso</h2>
              {data.cup_sales.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.cup_sales} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="size" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [`${v} uds`, 'Cantidad']}
                      contentStyle={{ border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#00E5FF" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 className="mb-4">Sabores más Vendidos</h2>
              {data.flavors.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
              ) : (
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {data.flavors.map(f => {
                    const pct = Math.round((f.ml / (data.flavors[0]?.ml || 1)) * 100)
                    return (
                      <div key={f.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700 truncate">{f.name}</span>
                          <span className="text-gray-400 tabular-nums ml-2">{f.ml.toFixed(0)} ml</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-pink" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Fila 3: Domicilios + Gastos ── */}
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Domicilios */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2>Domicilios</h2>
                <span className="text-sm font-bold text-brand-cyan">{fmt(data.deliveries.revenue)}</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-gray-50">
                {Object.entries(STATUS_META).map(([key, s]) => (
                  <div key={key} className="px-5 py-4">
                    <p className="text-2xl font-bold text-gray-900">{data.deliveries[key] ?? 0}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-slate-50">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Total pedidos</span>
                <span className="text-lg font-bold text-gray-800">{data.deliveries.total}</span>
              </div>
            </div>

            {/* Gastos por categoría */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2>Gastos</h2>
                <span className="text-sm font-bold text-red-500">{fmt(data.total_expenses)}</span>
              </div>
              {data.expense_by_cat.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin gastos</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.expense_by_cat.map(e => {
                    const maxTotal = data.expense_by_cat[0]?.total || 1
                    const pct = Math.round((e.total / maxTotal) * 100)
                    return (
                      <div key={e.category} className="px-5 py-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 font-medium">{e.category}</span>
                          <span className="font-bold text-red-500 tabular-nums">{fmt(e.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-slate-50">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Neto en caja</span>
                <span className={`text-lg font-bold ${data.net_cash < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {fmt(data.net_cash)}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
