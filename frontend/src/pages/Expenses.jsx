import { useEffect, useState } from 'react'
import { getExpenses, createExpense, updateExpense, deleteExpense, getShifts, getActiveShift } from '../api'
import { Icon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const fmt     = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtDate = dt => new Date(dt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const CATEGORIES = [
  { value: 'business',   label: 'Gasto del Negocio' },
  { value: 'personal',   label: 'Gasto Personal' },
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
  description: '', amount: '', notes: '',
  from_daily_cash: true, payment_method: 'cash',
}

/* Selector Efectivo / Transferencia */
function PayMethodToggle({ value, onChange }) {
  return (
    <div className="flex gap-2 mt-1">
      {[{ v: 'cash', l: 'Efectivo' }, { v: 'transfer', l: 'Transferencia' }].map(o => (
        <button
          key={o.v} type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
            value === o.v
              ? o.v === 'cash'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-cyan-500 bg-cyan-50 text-cyan-700'
              : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

export default function Expenses() {
  const { user } = useAuth()
  const [expenses,   setExpenses]   = useState([])
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [descSearch,   setDescSearch]   = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [shiftFilter,  setShiftFilter]  = useState('all')
  const [shifts,       setShifts]       = useState([])
  const [activeShift,  setActiveShift]  = useState(null)

  // Edición
  const [editing,   setEditing]   = useState(null)
  const [eForm,     setEForm]     = useState({})
  const [eSaving,   setESaving]   = useState(false)

  const load = (origin = filterOrigin) => {
    const params = { page_size: 500 }
    if (origin !== 'all') params.origin = origin
    getExpenses(params).then(r => setExpenses(r.data?.results ?? r.data ?? []))
  }

  useEffect(() => {
    load()
    getShifts().then(r => setShifts((r.data?.results ?? r.data ?? []).sort((a,b) => b.id - a.id)))
    getActiveShift().then(r => setActiveShift(r.data?.shift ?? null)).catch(() => {})
  }, [])
  useEffect(() => { load(filterOrigin) }, [filterOrigin])

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
    } catch (err) { toast.error(err?.response?.data?.detail || err?.response?.data?.[0] || 'Error al registrar gasto') }
    setSubmitting(false)
  }

  const filtered = expenses.filter(e => {
    if (filterOrigin !== 'all' && e.origin !== filterOrigin) return false
    if (shiftFilter !== 'all' && e.shift !== Number(shiftFilter)) return false
    if (descSearch && !(e.description || '').toLowerCase().includes(descSearch.toLowerCase())) return false
    if (dateFrom || dateTo) {
      const d = new Date(e.created_at)
      d.setHours(0, 0, 0, 0)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo   && d > new Date(dateTo))   return false
    }
    return true
  })

  const hasFilters   = descSearch || dateFrom || dateTo || filterOrigin !== 'all' || shiftFilter !== 'all'
  const clearFilters = () => { setDescSearch(''); setDateFrom(''); setDateTo(''); setFilterOrigin('all'); setShiftFilter('all'); load('all') }

  const openEdit = (e) => {
    setEditing(e)
    setEForm({
      category:        e.category,
      origin:          e.origin,
      description:     e.description,
      amount:          e.amount,
      from_daily_cash: e.from_daily_cash,
      payment_method:  e.payment_method || 'cash',
      notes:           e.notes || '',
    })
  }

  const handleUpdate = async (ev) => {
    ev.preventDefault()
    if (!eForm.description || !eForm.amount || Number(eForm.amount) <= 0) {
      toast.error('Completa descripción y monto'); return
    }
    setESaving(true)
    try {
      await updateExpense(editing.id, eForm)
      toast.success('Gasto actualizado')
      setEditing(null)
      load()
    } catch (err) { toast.error(err?.response?.data?.detail || 'Error al actualizar') }
    setESaving(false)
  }

  const handleDelete = async (e) => {
    if (!confirm(`¿Eliminar "${e.description}"?`)) return
    try {
      await deleteExpense(e.id)
      toast.success('Gasto eliminado')
      load()
    } catch { toast.error('Error al eliminar') }
  }

  const totalAll      = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const totalPos      = filtered.filter(e => e.origin === 'pos').reduce((s, e) => s + Number(e.amount), 0)
  const totalDelivery = filtered.filter(e => e.origin === 'delivery').reduce((s, e) => s + Number(e.amount), 0)
  const totalCash     = filtered.filter(e => e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)
  const totalNoCash   = filtered.filter(e => !e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)

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
      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total gastos</span>
          <span className="stat-value text-red-500">{fmt(totalAll)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Afecta caja</span>
          <span className="stat-value text-orange-500">{fmt(totalCash)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">No afecta caja</span>
          <span className="stat-value text-gray-400">{fmt(totalNoCash)}</span>
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
          <div className="flex items-center justify-between mb-4">
            <h2>Nuevo Gasto</h2>
            {activeShift
              ? <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-brand-navy border border-blue-100">
                  Jornada #{activeShift.id} · {new Date(activeShift.opened_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              : <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">Sin jornada activa</span>
            }
          </div>
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

              {/* Afecta caja + método de pago */}
              <div className="flex flex-col justify-start gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-1">
                  <input type="checkbox" checked={form.from_daily_cash}
                    onChange={e => setForm(f => ({ ...f, from_daily_cash: e.target.checked }))}
                    className="accent-brand-pink w-4 h-4 rounded" />
                  <span className="text-gray-600 font-medium">Afecta caja del día</span>
                </label>
                {form.from_daily_cash && (
                  <div>
                    <label className="label">Medio de pago</label>
                    <PayMethodToggle
                      value={form.payment_method}
                      onChange={v => setForm(f => ({ ...f, payment_method: v }))}
                    />
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Detalles adicionales..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

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

      {/* Filtros */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Icon name="search" className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="input py-1.5 text-sm flex-1"
            placeholder="Buscar por descripción..."
            value={descSearch}
            onChange={e => setDescSearch(e.target.value)}
          />
        </div>
        <select className="input py-1.5 text-sm w-44" value={shiftFilter} onChange={e => setShiftFilter(e.target.value)}>
          <option value="all">Todas las jornadas</option>
          {shifts.map(s => (
            <option key={s.id} value={s.id}>
              #{s.id} · {new Date(s.opened_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </option>
          ))}
        </select>
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
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2>Historial <span className="text-sm font-normal text-gray-400">({filtered.length})</span></h2>
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
          style={{ gridTemplateColumns: '60px 80px 90px 130px 80px 1fr 120px 90px 90px 80px 64px' }}>
          {['Hora', 'Fecha', 'Jornada', 'Categoría', 'Canal', 'Descripción', 'Registrado por', 'Caja', 'Método', 'Monto', ''].map(h => (
            <span key={h}>{h}</span>
          ))}
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-300">
              <Icon name="expenses" className="w-8 h-8 mb-2" />
              <p className="text-sm">{hasFilters ? 'Sin resultados' : 'Sin gastos registrados'}</p>
            </div>
          ) : filtered.map(e => (
            <div key={e.id}
              className="grid px-5 py-3 items-center gap-3 hover:bg-slate-50 transition-colors"
              style={{ gridTemplateColumns: '60px 80px 90px 130px 80px 1fr 120px 90px 90px 80px 64px' }}>
              <span className="text-sm tabular-nums text-gray-500">{fmtTime(e.created_at)}</span>
              <span className="text-sm tabular-nums text-gray-500">{fmtDate(e.created_at)}</span>
              <span className="text-xs font-medium text-brand-navy bg-blue-50 px-2 py-0.5 rounded-full truncate">{e.shift_label}</span>
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
              {/* Columna Caja */}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${e.from_daily_cash ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {e.from_daily_cash ? 'Sí' : 'No'}
              </span>
              {/* Columna Método */}
              {e.from_daily_cash ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${
                  e.payment_method === 'transfer'
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {e.payment_method === 'transfer' ? 'Transf.' : 'Efectivo'}
                </span>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              )}
              <span className={`text-sm font-bold tabular-nums ${e.from_daily_cash ? 'text-red-500' : 'text-gray-400'}`}>
                {fmt(e.amount)}
              </span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(e)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={() => handleDelete(e)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length > 0 && (() => {
          const afectaCaja  = filtered.filter(e => e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)
          const noAfecta    = filtered.filter(e => !e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)
          const totalG      = afectaCaja + noAfecta
          return (
            <div className="px-5 py-3 border-t border-gray-100 bg-slate-50 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Gastos que afectan caja</span>
                <span className="font-semibold text-red-500">- {fmt(afectaCaja)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Gastos que no afectan caja</span>
                <span className="font-semibold text-gray-400">- {fmt(noAfecta)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Total gastos</span>
                <span className="text-base font-bold text-red-500">- {fmt(totalG)}</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Modal edición */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Editar Gasto</h2>
              <button onClick={() => setEditing(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={eForm.category}
                    onChange={e => setEForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Canal</label>
                  <div className="flex gap-2">
                    {ORIGINS.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => setEForm(f => ({ ...f, origin: o.value }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          eForm.origin === o.value
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
                  <label className="label">Descripción</label>
                  <input className="input" required value={eForm.description}
                    onChange={e => setEForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Monto (COP)</label>
                  <input type="number" className="input" required min="1" value={eForm.amount}
                    onChange={e => setEForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-1">
                    <input type="checkbox" checked={eForm.from_daily_cash}
                      onChange={e => setEForm(f => ({ ...f, from_daily_cash: e.target.checked }))}
                      className="accent-brand-pink w-4 h-4 rounded" />
                    <span className="text-gray-600 font-medium">Afecta caja del día</span>
                  </label>
                  {eForm.from_daily_cash && (
                    <div>
                      <label className="label">Medio de pago</label>
                      <PayMethodToggle
                        value={eForm.payment_method || 'cash'}
                        onChange={v => setEForm(f => ({ ...f, payment_method: v }))}
                      />
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="label">Notas (opcional)</label>
                  <input className="input" value={eForm.notes}
                    onChange={e => setEForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={eSaving} className="btn-primary flex-1">
                  {eSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Guardar cambios
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
