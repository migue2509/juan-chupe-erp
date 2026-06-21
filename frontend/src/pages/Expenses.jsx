import { useEffect, useState } from 'react'
import { getExpenses, createExpense } from '../api'
import toast from 'react-hot-toast'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

const CATEGORIES = [
  { value: 'business', label: '🏪 Gasto del Negocio' },
  { value: 'personal', label: '👤 Gasto Personal' },
  { value: 'petty_cash', label: '💵 Caja Menor' },
]

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState({ category: 'business', description: '', amount: '', from_daily_cash: true, notes: '' })
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = () => getExpenses().then(r => setExpenses(r.data.results || r.data))

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createExpense(form)
      toast.success('Gasto registrado')
      setForm({ category: 'business', description: '', amount: '', from_daily_cash: true, notes: '' })
      setShowForm(false)
      load()
    } catch {}
    setSubmitting(false)
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const fromCash = expenses.filter(e => e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-brand-navy">Gastos</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Registrar Gasto</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card border-l-4 border-red-400">
          <span className="stat-label">Total Gastos</span>
          <span className="stat-value text-red-500">{fmt(total)}</span>
        </div>
        <div className="stat-card border-l-4 border-orange-400">
          <span className="stat-label">Impacta Caja</span>
          <span className="stat-value text-orange-500">{fmt(fromCash)}</span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4 border-brand-pink border">
          <h2 className="text-brand-pink">Nuevo Gasto</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Categoría</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Descripción</label>
              <input className="input" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Monto</label>
              <input className="input" type="number" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.from_daily_cash}
                  onChange={e => setForm(f => ({ ...f, from_daily_cash: e.target.checked }))}
                  className="accent-brand-pink w-4 h-4" />
                ¿Sale de la plata del día?
              </label>
            </div>
            <div className="col-span-2">
              <label className="label">Notas</label>
              <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary">Guardar</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="card">
        <div className="divide-y divide-gray-50">
          {expenses.length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Sin gastos registrados</p>}
          {expenses.map(e => (
            <div key={e.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{e.description}</p>
                <p className="text-xs text-gray-400">
                  {CATEGORIES.find(c => c.value === e.category)?.label}
                  {e.from_daily_cash ? ' · 💵 Impacta caja' : ' · Sin impacto'}
                </p>
              </div>
              <span className="font-bold text-red-500">{fmt(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
