import { useEffect, useState } from 'react'
import { getExpenses, createExpense } from '../api'
import { Icon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const fmt     = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtDate = dt => new Date(dt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const CATEGORIES = [
  { value: 'business',   label: 'Gasto del Negocio' },
  { value: 'personal',   label: 'Gasto Personal' },
  { value: 'petty_cash', label: 'Caja Menor' },
  { value: 'supply',     label: 'Ingreso de Mercancía' },
]

const ORIGINS = [
  { value: 'pos',      label: 'Punto de Venta' },
  { value: 'delivery', label: 'Domicilios' },
]

const CAT_BADGE = {
  business:   'bg-blue-50 text-blue-700',
  personal:   'bg-purple-50 text-purple-700',
  petty_cash: 'bg-amber-50 text-amber-700',
  supply:     'bg-green-50 text-green-700',
}

const ORIGIN_BADGE = {
  pos:      'badge-pink',
  delivery: 'badge-cyan',
}

const EMPTY_FORM = {
  category: 'business', origin: 'pos',
  description: '', amount: '', notes: '', from_daily_cash: true,
}

export default function Expenses() {
  const { user } = useAuth()
  const [expenses,   setExpenses]   = useState([])
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterOrigin, setFilterOrigin] = useState('all')

  const load = () =>
    getExpenses().then(r => setExpenses(r.data?.results ?? r.data ?? []))

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description || !form.amount || Number(form.amount) <= 0) {
      toast.error('Completa descripción y monto'); return
    }
    setSubmitting(true)
    try {
      await createExpense(form)
      toast.success('Gasto registrado')
      setForm(EMPTY_FORM)
      setShowForm(false)
      load()
    } catch { toast.error('Error al registrar gasto') }
    setSubmitting(false)
  }

  const filtered = filterOrigin === 'all'
    ? expenses
    : expenses.filter(e => e.origin === filterOrigin)

  const totalAll      = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalPos      = expenses.filter(e => e.origin === 'pos').reduce((s, e) => s + Number(e.amount), 0)
  const totalDelivery = expenses.filter(e => e.origin === 'delivery').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Gastos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registro de gastos por jornada</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          <Icon name="plus" className="w-4 h-4" />
          Registrar Gasto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total gastos</span>
          <span className="stat-value text-red-500">{fmt(totalAll)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Punto de Venta</span>
          <span className="stat-value text-brand-pink">{fmt(totalPos)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Domicilios</span>
          <span className="stat-value text-brand-cyan">{fmt(totalDelivery)}</span>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card border-l-4 border-brand-pink">
          <h2 className="mb-4">Nuevo Gasto</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              <div>
                <label className="label">Categoría</label>
                <select className="input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Canal</label>
                <div className="flex gap-2">
                  {ORIGINS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => setForm(f => ({ ...f, origin: o.value }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        form.origin === o.value
                          ? o.value === 'pos'
                            ? 'border-brand-pink bg-pink-50 text-brand-pink'
                            : 'border-brand-cyan bg-cyan-50 text-brand-cyan'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <label className="label">Descripción <span className="text-red-400">*</span></label>
                <input className="input" required placeholder="Ej: Compra de bolsas, transporte, etc."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <label className="label">Monto (COP) <span className="text-red-400">*</span></label>
                <input type="number" className="input" required placeholder="0" min="1"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={form.from_daily_cash}
                    onChange={e => setForm(f => ({ ...f, from_daily_cash: e.target.checked }))}
                    className="accent-brand-pink w-4 h-4 rounded" />
                  <span className="text-gray-600">Impacta caja del día</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Detalles adicionales..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Who registers */}
            {user && (
              <p className="text-xs text-gray-400">
                Registrado por: <span className="font-medium text-gray-600">{user.full_name || user.username}</span>
              </p>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Guardar Gasto
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter + Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2>Historial</h2>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {[{ k: 'all', l: 'Todos' }, { k: 'pos', l: 'POS' }, { k: 'delivery', l: 'Domicilios' }].map(f => (
              <button key={f.k} onClick={() => setFilterOrigin(f.k)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterOrigin === f.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="grid px-5 py-2.5 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
          style={{ gridTemplateColumns: '60px 80px 140px 90px 1fr 130px 90px' }}>
          {['Hora', 'Fecha', 'Categoría', 'Canal', 'Descripción', 'Registrado por', 'Monto'].map(h => (
            <span key={h}>{h}</span>
          ))}
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-300">
              <Icon name="expenses" className="w-8 h-8 mb-2" />
              <p className="text-sm">Sin gastos registrados</p>
            </div>
          ) : filtered.map(e => (
            <div key={e.id}
              className="grid px-5 py-3 items-center gap-3 hover:bg-slate-50 transition-colors"
              style={{ gridTemplateColumns: '60px 80px 140px 90px 1fr 130px 90px' }}>
              <span className="text-sm tabular-nums text-gray-500">{fmtTime(e.created_at)}</span>
              <span className="text-sm tabular-nums text-gray-500">{fmtDate(e.created_at)}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${CAT_BADGE[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {e.category_label}
              </span>
              <span className={`badge text-xs w-fit ${ORIGIN_BADGE[e.origin] ?? 'badge-gray'}`}>
                {e.origin_label}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#FF0099,#7B2FFF)' }}>
                  {(e.registered_by_name || '?')[0].toUpperCase()}
                </div>
                <span className="text-xs text-gray-700 font-medium truncate">{e.registered_by_name}</span>
              </div>
              <span className="text-sm font-bold text-red-500 tabular-nums">{fmt(e.amount)}</span>
            </div>
          ))}
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
            <span className="text-base font-bold text-red-500">
              {fmt(filtered.reduce((s, e) => s + Number(e.amount), 0))}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}
