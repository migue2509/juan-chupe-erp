import { useEffect, useState } from 'react'
import { getActiveShift, getTodaySales, getInventoryAlerts, getTodayExpenses, openShift, closeShift } from '../api'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

const fmt  = (n) => `$${Number(n).toLocaleString('es-CO')}`
const fmtN = (n) => Number(n).toLocaleString('es-CO')

const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
const PAYMENT_BADGE  = { cash: 'badge-gray', transfer: 'badge-cyan', mixed: 'badge-lime' }

const FILTERS = [
  { key: 'all',      label: 'Todos' },
  { key: 'pos',      label: 'Punto de Venta' },
  { key: 'delivery', label: 'Domicilios' },
]

export default function Dashboard() {
  const { isAdmin } = useAuth()
  const [shift,    setShift]   = useState(null)
  const [allSales, setAllSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [alerts,   setAlerts]  = useState([])
  const [loading,  setLoading] = useState(true)
  const [filter,   setFilter]  = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const [shiftRes, salesRes, alertsRes, expRes] = await Promise.all([
        getActiveShift(),
        getTodaySales(),
        getInventoryAlerts(),
        getTodayExpenses(),
      ])
      setShift(shiftRes.data.shift)
      setAllSales(salesRes.data.sales || [])
      setAlerts(alertsRes.data)
      setExpenses(expRes.data?.results ?? expRes.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleOpenShift = async () => {
    try { await openShift(); toast.success('Jornada abierta'); load() } catch {}
  }
  const handleCloseShift = async () => {
    if (!confirm('¿Cerrar la jornada actual?')) return
    try { await closeShift(); toast.success('Jornada cerrada'); load() } catch {}
  }

  // ── Filter sales by category ──
  // allSales incluye anuladas para mostrar en recientes; activeSales excluye anuladas para totales
  const filteredSales = allSales.filter(s => {
    if (filter === 'delivery') return s.is_delivery === true
    if (filter === 'pos')      return s.is_delivery === false
    return true
  })
  const activeSales = filteredSales.filter(s => !s.is_voided)

  // ── Stats computed from ACTIVE (non-voided) sales ──
  const totalDinero    = activeSales.reduce((sum, s) =>
    sum + (s.is_courtesy ? Number(s.courtesy_paid || 0) : Number(s.total || 0)), 0)
  const cantidadVentas = activeSales.length

  // Efectivo = ventas cash (total completo) + porción cash de ventas mixtas
  // Cortesías: solo cuenta lo que realmente pagaron (courtesy_paid)
  const totalEfectivo = activeSales.reduce((sum, s) => {
    if (s.is_courtesy) return sum + Number(s.courtesy_paid || 0)
    const total = Number(s.total || 0)
    const trf   = Number(s.transfer_amount || 0)
    if (s.payment_method === 'cash')  return sum + total
    if (s.payment_method === 'mixed') return sum + Math.max(0, total - trf)
    return sum
  }, 0)

  // Transferencias = todas las ventas activas por transferencia + porción transfer de mixtas
  const totalTransf = activeSales.reduce((sum, s) => sum + Number(s.transfer_amount || 0), 0)

  const filteredExpenses = expenses.filter(e => {
    if (filter === 'pos')      return e.origin === 'pos'
    if (filter === 'delivery') return e.origin === 'delivery'
    return true
  })
  const gastosAfectaCaja  = filteredExpenses.filter(e =>  e.from_daily_cash).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const gastosNoAfectaCaja= filteredExpenses.filter(e => !e.from_daily_cash).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const gastosTotalAll    = gastosAfectaCaja + gastosNoAfectaCaja
  // alias para compatibilidad con cálculo de neto
  const totalGastos       = gastosAfectaCaja
  // Gastos pagados en efectivo (reducen el efectivo físico disponible)
  const gastosEfectivo = filteredExpenses
    .filter(e => e.from_daily_cash && e.payment_method === 'cash')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  // Neto en caja = efectivo de ventas - gastos pagados en efectivo
  const netoEnCaja = totalEfectivo - gastosEfectivo

  const recentSales = [...filteredSales].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )

  // ── Ventas por vendedora ──
  const vendedoraMap = {}
  activeSales.forEach(s => {
    const name = s.seller_name || 'Sin asignar'
    if (!vendedoraMap[name]) vendedoraMap[name] = { total: 0, count: 0 }
    vendedoraMap[name].total += s.is_courtesy ? Number(s.courtesy_paid || 0) : Number(s.total || 0)
    vendedoraMap[name].count++
  })
  const vendedoraChart = Object.entries(vendedoraMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.total - a.total)
  const maxVendTotal = Math.max(...vendedoraChart.map(d => d.total), 1)

  // ── Delivery stats (solo cuando filter === 'delivery') ──
  const deliverySales = allSales.filter(s => s.is_delivery)
  const deliveryStatusCounts = {
    pending:   deliverySales.filter(s => s.delivery_status === 'pending').length,
    on_way:    deliverySales.filter(s => s.delivery_status === 'on_way').length,
    delivered: deliverySales.filter(s => s.delivery_status === 'delivered').length,
    cancelled: deliverySales.filter(s => s.delivery_status === 'cancelled').length,
  }
  const deliveryStatusConfig = [
    { key: 'pending',   label: 'Pendiente', cls: 'bg-amber-100 text-amber-700',  bar: 'bg-amber-400' },
    { key: 'on_way',    label: 'En camino', cls: 'bg-cyan-100 text-cyan-700',    bar: 'bg-cyan-400'  },
    { key: 'delivered', label: 'Entregado', cls: 'bg-green-100 text-green-700',  bar: 'bg-green-400' },
    { key: 'cancelled', label: 'Cancelado', cls: 'bg-red-100 text-red-600',      bar: 'bg-red-400'   },
  ]
  // Domiciliarios chart data: agrupar por delivery_person_name
  const domiciliarioMap = {}
  deliverySales.forEach(s => {
    const name = s.delivery_person_name || 'Sin asignar'
    if (!domiciliarioMap[name]) domiciliarioMap[name] = { total: 0, delivered: 0, cancelled: 0, pending: 0, on_way: 0 }
    domiciliarioMap[name].total++
    if (s.delivery_status) domiciliarioMap[name][s.delivery_status] = (domiciliarioMap[name][s.delivery_status] || 0) + 1
  })
  const domiciliarioChart = Object.entries(domiciliarioMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.total - a.total)
  const maxDomTotal = Math.max(...domiciliarioChart.map(d => d.total), 1)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {isAdmin && (
          shift ? (
            <button onClick={handleCloseShift} className="btn-danger">
              <Icon name="lock" className="w-4 h-4" />
              Cerrar Jornada
            </button>
          ) : (
            <button onClick={handleOpenShift} className="btn-lime">
              <Icon name="unlock" className="w-4 h-4" />
              Abrir Jornada
            </button>
          )
        )}
      </div>

      {/* ── Shift status + Category filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Shift status */}
        <div className={`card flex items-center gap-3 py-3 flex-1 ${shift ? 'border-green-200 bg-green-50' : ''}`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${shift ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {shift ? 'Jornada activa' : 'Sin jornada activa'}
            </p>
            {shift && (
              <p className="text-xs text-gray-400">
                Desde las {new Date(shift.opened_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="card py-3 flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-400 mr-2 whitespace-nowrap">Ver:</span>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.key
                  ? 'bg-brand-navy text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats ventas (5-col) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total dinero */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Total dinero</span>
            <span className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center text-brand-pink">
              <Icon name="trending" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-gray-900 text-xl">{fmt(totalDinero)}</span>
        </div>

        {/* Cantidad ventas */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Ventas</span>
            <span className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center text-brand-pink">
              <Icon name="billing" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-gray-900 text-xl">{fmtN(cantidadVentas)}</span>
        </div>

        {/* Efectivo */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Efectivo</span>
            <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <Icon name="cash" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-gray-900 text-xl">{fmt(totalEfectivo)}</span>
        </div>

        {/* Transferencias */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Transferencias</span>
            <span className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
              <Icon name="transfer" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-gray-900 text-xl">{fmt(totalTransf)}</span>
        </div>

        {/* Neto en caja */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Neto en caja</span>
            <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
              <Icon name="cash" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className={`stat-value text-xl ${netoEnCaja >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {fmt(netoEnCaja)}
          </span>
          <p className="text-[10px] text-gray-400 mt-0.5">Ventas − Gastos</p>
        </div>
      </div>

      {/* ── Stats gastos (3-col) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total gastos */}
        <div className="stat-card col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Total gastos</span>
            <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400">
              <Icon name="expenses" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-red-500 text-xl">{fmt(gastosTotalAll)}</span>
          <p className="text-[10px] text-gray-400 mt-0.5">{filteredExpenses.length} registros</p>
        </div>

        {/* Afecta caja */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Afecta caja</span>
            <span className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
              <Icon name="cash" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-orange-500 text-xl">{fmt(gastosAfectaCaja)}</span>
          <p className="text-[10px] text-gray-400 mt-0.5">{filteredExpenses.filter(e => e.from_daily_cash).length} gastos</p>
        </div>

        {/* No afecta caja */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">No afecta caja</span>
            <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <Icon name="expenses" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-gray-500 text-xl">{fmt(gastosNoAfectaCaja)}</span>
          <p className="text-[10px] text-gray-400 mt-0.5">{filteredExpenses.filter(e => !e.from_daily_cash).length} gastos</p>
        </div>
      </div>

      {/* ── Delivery section (solo cuando filter === 'delivery') ── */}
      {filter === 'delivery' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Cards estado */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Icon name="bike" className="w-4 h-4 text-brand-cyan" />
              <h2>Estado del día</h2>
              <span className="badge-gray ml-auto">{deliverySales.length} domicilios</span>
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-gray-100">
              {deliveryStatusConfig.map(({ key, label, cls, bar }) => (
                <div key={key} className="px-5 py-4">
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">{deliveryStatusCounts[key]}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar}`}
                      style={{ width: deliverySales.length ? `${(deliveryStatusCounts[key] / deliverySales.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico repartidores */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Icon name="reports" className="w-4 h-4 text-brand-purple" />
              <h2>Domicilios por repartidor</h2>
            </div>
            {domiciliarioChart.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-300 text-sm">Sin datos</div>
            ) : (
              <div className="divide-y divide-gray-50 px-5 py-3 space-y-3">
                {domiciliarioChart.map(d => (
                  <div key={d.name} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800">{d.name}</span>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{d.total}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                      {d.delivered > 0 && <div className="h-full bg-green-400" style={{ width: `${(d.delivered/d.total)*100}%` }} />}
                      {d.on_way > 0    && <div className="h-full bg-cyan-400"  style={{ width: `${(d.on_way/d.total)*100}%` }} />}
                      {d.pending > 0   && <div className="h-full bg-amber-400" style={{ width: `${(d.pending/d.total)*100}%` }} />}
                      {d.cancelled > 0 && <div className="h-full bg-red-400"   style={{ width: `${(d.cancelled/d.total)*100}%` }} />}
                    </div>
                    <div className="flex gap-3 mt-1">
                      {d.delivered > 0 && <span className="text-[10px] text-green-600">{d.delivered} entregados</span>}
                      {d.on_way > 0    && <span className="text-[10px] text-cyan-600">{d.on_way} en camino</span>}
                      {d.pending > 0   && <span className="text-[10px] text-amber-600">{d.pending} pendientes</span>}
                      {d.cancelled > 0 && <span className="text-[10px] text-red-500">{d.cancelled} cancelados</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Ventas recientes */}
        <div className="lg:col-span-2 space-y-5">

        {/* Gráfico ventas por vendedora */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Icon name="reports" className="w-4 h-4 text-brand-purple" />
            <h2>Ventas por vendedora</h2>
            <span className="badge-gray ml-auto">{activeSales.length} ventas</span>
          </div>
          {vendedoraChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300 text-sm">
              <Icon name="billing" className="w-7 h-7 mb-2" />
              Sin ventas aún
            </div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {vendedoraChart.map((d, i) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-pink-100 text-brand-pink text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">{d.name}</span>
                      <span className="badge-gray text-[10px] flex-shrink-0">{d.count} {d.count === 1 ? 'venta' : 'ventas'}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 tabular-nums ml-3 flex-shrink-0">{fmt(d.total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-pink to-pink-400 transition-all duration-500"
                      style={{ width: `${(d.total / maxVendTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {vendedoraChart.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
              <span className="text-base font-bold text-gray-900 tabular-nums">{fmt(totalDinero)}</span>
            </div>
          )}
        </div>

        {/* Ventas recientes */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2>Ventas recientes</h2>
            <span className="badge-gray">{cantidadVentas} {filter !== 'all' ? FILTERS.find(f=>f.key===filter)?.label.toLowerCase() : 'en total'}</span>
          </div>

          {/* Table header */}
          <div className="grid gap-2 px-5 py-2.5 bg-slate-50 border-b border-gray-100"
            style={{ gridTemplateColumns: '60px 1fr 90px 90px 90px' }}>
            {['Hora', 'Vendedora', 'Canal', 'Total', 'Pago'].map(col => (
              <span key={col} className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{col}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {recentSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <Icon name="billing" className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin ventas aún</p>
              </div>
            ) : (
              recentSales.map(sale => {
                const DELIVERY_STATUS = {
                  pending:   { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
                  on_way:    { label: 'En camino', cls: 'bg-cyan-100 text-cyan-700' },
                  delivered: { label: 'Entregado',  cls: 'bg-green-100 text-green-700' },
                  cancelled: { label: 'Cancelado',  cls: 'bg-red-100 text-red-600' },
                }
                const delivSt = sale.is_delivery && sale.delivery_status ? DELIVERY_STATUS[sale.delivery_status] : null
                const isVoided = sale.is_voided
                return (
                <div key={sale.id} className={`grid gap-2 px-5 py-3 hover:bg-slate-50 transition-colors items-start ${isVoided ? 'opacity-50' : ''}`}
                  style={{ gridTemplateColumns: '60px 1fr 90px 90px 90px' }}>
                  <span className="text-sm font-medium text-gray-700 tabular-nums">
                    {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm text-gray-600 truncate">
                    {sale.seller_name || <span className="text-gray-300">—</span>}
                  </span>
                  <span className="flex flex-col gap-0.5 items-start">
                    <span className={`badge text-[11px] ${
                      sale.is_courtesy ? 'bg-pink-100 text-pink-600' :
                      sale.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                      {sale.is_courtesy ? 'Cortesía' : sale.is_delivery ? 'Domicilio' : 'POS'}
                    </span>
                    {delivSt && (
                      <span className={`badge text-[10px] ${delivSt.cls}`}>{delivSt.label}</span>
                    )}
                    {isVoided && (
                      <span className="badge text-[10px] bg-red-100 text-red-500">Anulado</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    <span className={`text-sm font-semibold ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {fmt(sale.is_courtesy ? (sale.courtesy_paid || 0) : sale.total)}
                    </span>
                    {sale.is_courtesy && !isVoided && (
                      <span className="block text-[10px] text-gray-400 leading-none">
                        factura {fmt(sale.total)}
                      </span>
                    )}
                  </span>
                  <span>
                    <span className={`badge text-[11px] ${PAYMENT_BADGE[sale.payment_method] || 'badge-gray'}`}>
                      {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                    </span>
                  </span>
                </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {recentSales.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
              <span className="text-base font-bold text-gray-900 tabular-nums">{fmt(totalDinero)}</span>
            </div>
          )}
        </div>

        </div>{/* fin lg:col-span-2 */}

        {/* Columna derecha: alertas + gastos */}
        <div className="space-y-5">

          {/* Alertas de stock */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <Icon name="alert" className={`w-4 h-4 ${alerts.length > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              <h2>Alertas de stock</h2>
              {alerts.length > 0 && <span className="badge-amber ml-auto">{alerts.length}</span>}
            </div>
            <div className="divide-y divide-gray-50">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300 px-5">
                  <Icon name="check" className="w-7 h-7 mb-2" />
                  <p className="text-sm text-center">Stock en niveles normales</p>
                </div>
              ) : (
                alerts.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg leading-none flex-shrink-0">{a.emoji}</span>
                      <span className="text-sm font-medium text-gray-700 truncate">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="badge-amber tabular-nums">{a.stock}</span>
                      <span className="text-[10px] text-gray-400">min {a.min}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gastos de la jornada */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Icon name="expenses" className="w-4 h-4 text-red-400" />
                <h2>Gastos</h2>
              </div>
              <span className="badge-gray">{filteredExpenses.length}</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-300 px-5">
                  <p className="text-sm">Sin gastos registrados</p>
                </div>
              ) : (
                filteredExpenses.map(e => (
                  <div key={e.id} className="flex items-start justify-between px-5 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{e.category_label || e.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-500 tabular-nums flex-shrink-0">
                      -{fmt(e.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
            {filteredExpenses.length > 0 && (
              <div className="border-t border-gray-100 bg-slate-50 divide-y divide-gray-100">
                <div className="flex items-center justify-between px-5 py-2">
                  <span className="text-xs text-gray-400">Afecta caja</span>
                  <span className="text-xs font-semibold text-orange-500 tabular-nums">-{fmt(gastosAfectaCaja)}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-2">
                  <span className="text-xs text-gray-400">No afecta caja</span>
                  <span className="text-xs font-semibold text-gray-400 tabular-nums">-{fmt(gastosNoAfectaCaja)}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</span>
                  <span className="text-sm font-bold text-red-500 tabular-nums">-{fmt(gastosTotalAll)}</span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
