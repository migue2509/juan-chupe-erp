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
  const filteredSales = allSales.filter(s => {
    if (filter === 'delivery') return s.is_delivery === true
    if (filter === 'pos')      return s.is_delivery === false
    return true
  })

  // ── Stats computed from filtered sales ──
  const totalDinero    = filteredSales.reduce((sum, s) => sum + Number(s.total), 0)
  const cantidadVentas = filteredSales.length

  // Efectivo = ventas cash (total completo) + porción cash de ventas mixtas
  const totalEfectivo = filteredSales.reduce((sum, s) => {
    const total = Number(s.total || 0)
    const trf   = Number(s.transfer_amount || 0)
    if (s.payment_method === 'cash')     return sum + total
    if (s.payment_method === 'mixed')    return sum + Math.max(0, total - trf)
    return sum
  }, 0)

  // Transferencias = todas las ventas por transferencia + porción transfer de mixtas
  const totalTransf = filteredSales.reduce((sum, s) => sum + Number(s.transfer_amount || 0), 0)

  const filteredExpenses = expenses.filter(e => {
    if (filter === 'pos')      return e.origin === 'pos'
    if (filter === 'delivery') return e.origin === 'delivery'
    return true
  })
  const totalGastos = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const netoEnCaja  = totalDinero - totalGastos

  const recentSales = [...filteredSales].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )

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

      {/* ── Stats 6-col ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total dinero */}
        <div className="stat-card lg:col-span-1">
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

        {/* Gastos */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Gastos</span>
            <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400">
              <Icon name="expenses" className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="stat-value text-red-500 text-xl">{fmt(totalGastos)}</span>
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

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Ventas recientes */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2>Ventas recientes</h2>
            <span className="badge-gray">{cantidadVentas} {filter !== 'all' ? FILTERS.find(f=>f.key===filter)?.label.toLowerCase() : 'en total'}</span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-5 gap-2 px-5 py-2.5 bg-slate-50 border-b border-gray-100">
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
              recentSales.map(sale => (
                <div key={sale.id} className="grid grid-cols-5 gap-2 px-5 py-3 hover:bg-slate-50 transition-colors items-center">
                  <span className="text-sm font-medium text-gray-700 tabular-nums">
                    {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm text-gray-600 truncate">
                    {sale.seller_name || <span className="text-gray-300">—</span>}
                  </span>
                  <span>
                    <span className={`badge text-[11px] ${sale.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                      {sale.is_delivery ? 'Domicilio' : 'POS'}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                    {fmt(sale.total)}
                  </span>
                  <span>
                    <span className={`badge text-[11px] ${PAYMENT_BADGE[sale.payment_method] || 'badge-gray'}`}>
                      {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                    </span>
                  </span>
                </div>
              ))
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

        {/* Columna derecha: alertas + gastos */}
        <div className="space-y-5">

          {/* Alertas de stock */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-