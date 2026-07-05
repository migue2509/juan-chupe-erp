import { useEffect, useState, useCallback, useRef } from 'react'
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
  { key: 'rappi',    label: 'Rappi' },
  { key: 'didi',     label: 'DiDi' },
]

const PIE_COLORS   = ['#00E5FF', '#7B2FFF']
const STATUS_META  = {
  pending:   { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  on_way:    { label: 'En camino', cls: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: 'Entregado', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-600' },
}

export default function Reports() {
  const [period,      setPeriod]      = useState('daily')
  const [channel,     setChannel]     = useState('all')
  const [dateFrom,    setDateFrom]    = useState(localDate())
  const [dateTo,      setDateTo]      = useState(localDate())
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [downloading, setDownloading] = useState(false)
  const reportRef = useRef(null)

  const downloadPDF = async () => {
    if (!reportRef.current) return
    setDownloading(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      const el = reportRef.current

      // ── Guardar estilos originales ──
      const saved = []
      const patch = (node, styles) => {
        const orig = {}
        Object.keys(styles).forEach(k => { orig[k] = node.style[k]; node.style[k] = styles[k] })
        saved.push({ node, orig })
      }

      // 1. Expandir contenedor principal
      patch(el, { width: '1200px', minWidth: '1200px', maxWidth: '1200px' })

      // 2. Quitar altura máxima en listas recortadas
      el.querySelectorAll('[class*="max-h"]').forEach(n =>
        patch(n, { maxHeight: 'none', overflow: 'visible' })
      )

      // 3. Fondo blanco en SVGs / Recharts (evita negro)
      el.querySelectorAll('svg, .recharts-wrapper').forEach(n =>
        patch(n, { background: 'white' })
      )

      // 4. Forzar min-width:0 en celdas de grids para que funcione
      el.querySelectorAll('[style*="gridTemplateColumns"] > *').forEach(n =>
        patch(n, { minWidth: '0', overflow: 'hidden' })
      )

      // Repintar antes de capturar
      await new Promise(r => setTimeout(r, 150))

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        windowWidth: 1200,
        width: 1200,
      })

      // ── Restaurar todos los estilos ──
      saved.reverse().forEach(({ node, orig }) =>
        Object.keys(orig).forEach(k => { node.style[k] = orig[k] })
      )

      const imgData = canvas.toDataURL('image/png')
      const pdf     = new jsPDF('l', 'mm', 'a4')   // landscape A4 = 297×210mm
      const pdfW    = pdf.internal.pageSize.getWidth()
      const pdfH    = pdf.internal.pageSize.getHeight()
      const imgH    = (canvas.height * pdfW) / canvas.width

      let posY = 0
      while (posY < imgH) {
        pdf.addImage(imgData, 'PNG', 0, -posY, pdfW, imgH)
        posY += pdfH
        if (posY < imgH) pdf.addPage()
      }

      const from  = data?.date_from ?? dateFrom
      const to    = data?.date_to   ?? dateTo
      const label = from === to ? from : `${from}_${to}`
      pdf.save(`reporte-juan-chupe-${label}.pdf`)
    } catch (e) {
      console.error(e)
    }
    setDownloading(false)
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1>Reportes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Análisis de ventas, domicilios y gastos por período</p>
        </div>
        {data && !loading && (
          <button onClick={downloadPDF} disabled={downloading}
            className="btn-secondary flex items-center gap-2">
            {downloading
              ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            }
            {downloading ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        )}
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
        <div className="space-y-5" ref={reportRef}>

          {/* ── Encabezado PDF ── */}
          <div className="card flex items-center justify-between py-4 px-6 border-l-4 border-brand-pink">
            <div className="flex items-center gap-4">
              <img src="/logo-neon.png" alt="Juan Chupe" className="h-10 w-auto object-contain"
                onError={e => { e.target.style.display = 'none' }} />
              <div>
                <p className="text-lg font-bold text-gray-900">Juan Chupe ERP</p>
                <p className="text-xs text-gray-400">Sistema de gestión operativa</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Powered by <span className="font-semibold text-gray-500">Opia Systems</span></p>
              <p className="text-sm font-semibold text-gray-700">
                {(() => {
                  const from = data.date_from
                  const to   = data.date_to
                  const d1   = new Date(from + 'T12:00:00')
                  const d2   = new Date(to   + 'T12:00:00')
                  return from === to
                    ? d1.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    : `${d1.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — ${d2.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`
                })()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                Canal: {CHANNELS.find(c => c.key === channel)?.label} · {data.sales_count} venta{data.sales_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* ── Stats resumen ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="stat-card">
              <span className="stat-label">Total recibido</span>
              <span className="stat-value text-brand-pink">{fmt(data.total_sales)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Efectivo</span>
              <span className="stat-value text-brand-cyan">{fmt(data.total_cash)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Neto efectivo</span>
              <span className={`stat-value ${(data.net_efectivo ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                {fmt(data.net_efectivo ?? 0)}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Efectivo − gastos efectivo</p>
            </div>
            <div className="stat-card">
              <span className="stat-label">Transferencias</span>
              <span className="stat-value text-brand-purple">{fmt(data.total_transfer)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Neto transferencias</span>
              <span className={`stat-value ${(data.net_transfer ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                {fmt(data.net_transfer ?? 0)}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Transf. − gastos transf.</p>
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
                    style={{ gridTemplateColumns: 'minmax(0,1fr) 110px 70px 160px 50px' }}>
                    {['Vendedora', 'Ventas', 'Trans.', 'Participación', ''].map(h => <span key={h}>{h}</span>)}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {data.sellers.map(s => {
                      const pct = Math.round((s.total / totalSellers) * 100)
                      return (
                        <div key={s.name} className="grid px-5 py-3.5 items-center"
                          style={{ gridTemplateColumns: 'minmax(0,1fr) 110px 70px 160px 50px' }}>
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
                          <span className="font-medium text-gray-700">{f.name}</span>
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
            <div className="card p-0 overflow-hidden overflow-x-auto">
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
            <div className="card p-0 overflow-hidden overflow-x-auto">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2>Gastos</h2>
                <span className="text-sm font-bold text-red-500">{fmt(data.total_expenses)}</span>
              </div>
              {data.expense_by_cat.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin gastos</div>
              ) : (
                <>
                  {/* Header tabla */}
                  <div className="grid px-5 py-2 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest"
                    style={{ gridTemplateColumns: '2fr minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 1fr' }}>
                    <span>Categoría</span>
                    <span>Efectivo</span>
                    <span>Transferencia</span>
                    <span>Afecta caja</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {data.expense_by_cat.flatMap(e => {
                      const maxTotal = data.expense_by_cat[0]?.total || 1
                      const hasMix = e.afecta_caja > 0 && e.no_afecta > 0

                      const Row = ({ label, amount, cash, transfer, afectaCaja, key }) => {
                        const pct = Math.round((amount / maxTotal) * 100)
                        return (
                          <div key={key} className="px-5 py-3 space-y-1.5">
                            <div className="grid items-center text-sm"
                              style={{ gridTemplateColumns: '2fr minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 1fr' }}>
                              <span className="text-gray-700 font-medium">{label}</span>
                              <span className="tabular-nums text-gray-700">
                                {cash > 0 ? fmt(cash) : <span className="text-gray-300">—</span>}
                              </span>
                              <span className="tabular-nums text-cyan-700">
                                {transfer > 0 ? fmt(transfer) : <span className="text-gray-300">—</span>}
                              </span>
                              <span>
                                {afectaCaja
                                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Sí</span>
                                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">No</span>
                                }
                              </span>
                              <span className="font-bold text-red-500 tabular-nums text-right">{fmt(amount)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                              {cash > 0     && <div className="h-full bg-gray-400" style={{ width: `${Math.round((cash / amount) * pct)}%` }} />}
                              {transfer > 0 && <div className="h-full bg-cyan-400"  style={{ width: `${Math.round((transfer / amount) * pct)}%` }} />}
                            </div>
                          </div>
                        )
                      }

                      if (!hasMix) {
                        return [<Row
                          key={e.category}
                          label={e.category}
                          amount={e.total}
                          cash={e.cash}
                          transfer={e.transfer}
                          afectaCaja={e.afecta_caja > 0}
                        />]
                      }

                      // Split en dos filas cuando hay mezcla
                      return [
                        <Row
                          key={`${e.category}-caja`}
                          label={`${e.category} · afecta caja`}
                          amount={e.afecta_caja}
                          cash={e.cash}
                          transfer={e.transfer}
                          afectaCaja={true}
                        />,
                        <Row
                          key={`${e.category}-nocaja`}
                          label={`${e.category} · no afecta caja`}
                          amount={e.no_afecta}
                          cash={0}
                          transfer={0}
                          afectaCaja={false}
                        />,
                      ]
                    })}
                  </div>
                </>
              )}
              <div className="px-5 py-3 border-t border-gray-100 bg-slate-50 space-y-1">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Gastos que afectan caja</span>
                  <span className="font-semibold text-red-500">- {fmt(data.expense_by_cat?.reduce((s, e) => s + (e.afecta_caja || 0), 0) ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Gastos que no afectan caja</span>
                  <span className="font-semibold text-gray-400">- {fmt(data.expense_by_cat?.reduce((s, e) => s + (e.no_afecta || 0), 0) ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total gastos</span>
                  <span className="text-base font-bold text-red-500">- {fmt(data.total_expenses ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Efectivo</span>
                  <span className="text-sm font-bold text-gray-700">{fmt(data.total_expenses_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Transferencia</span>
                  <span className="text-sm font-bold text-cyan-700">{fmt(data.total_expenses_transfer ?? 0)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
