import { useEffect, useState } from 'react'
import { getCashAuditPrefill, createCashAudit } from '../api'
import toast from 'react-hot-toast'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

export default function CashAudit() {
  const [prefill, setPrefill] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getCashAuditPrefill().then(({ data }) => {
      setPrefill(data)
      setForm({
        shift: data.shift_id,
        expected_cash: data.expected_cash,
        expected_transfer: data.expected_transfer,
        actual_cash: '',
        actual_transfer: data.expected_transfer,
        cups_16oz_system: data.cups_16oz_system,
        cups_16oz_actual: '',
        cups_24oz_system: data.cups_24oz_system,
        cups_24oz_actual: '',
        bags_creamy_system: data.bags_creamy_system,
        bags_creamy_actual: '',
        bags_refreshing_system: data.bags_refreshing_system,
        bags_refreshing_actual: '',
        notes: '',
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createCashAudit(form)
      toast.success('✅ Arqueo guardado')
    } catch {}
    setSubmitting(false)
  }

  const diff = Number(form.actual_cash || 0) - Number(prefill?.net_expected_cash || 0)

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <h1 className="text-brand-navy">Arqueo de Caja</h1>

      {prefill && (
        <div className="card bg-brand-navy/5 border-brand-navy/20">
          <p className="text-sm font-semibold text-brand-navy mb-2">Resumen del Sistema</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Efectivo esperado:</span>
            <span className="font-bold text-right">{fmt(prefill.expected_cash)}</span>
            <span className="text-gray-500">Gastos del día:</span>
            <span className="font-bold text-right text-red-500">- {fmt(prefill.expenses_from_cash)}</span>
            <span className="text-gray-700 font-semibold border-t pt-1">Neto a entregar:</span>
            <span className="font-bold text-right text-brand-pink border-t pt-1">{fmt(prefill.net_expected_cash)}</span>
          </div>
        </div>
      )}

      {/* Cash */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">💵 Efectivo</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sistema (esperado)</label>
            <input className="input bg-gray-50" readOnly value={form.expected_cash || ''} />
          </div>
          <div>
            <label className="label">Entregado físicamente</label>
            <input className="input" type="number" required placeholder="0"
              value={form.actual_cash} onChange={e => setForm(f => ({ ...f, actual_cash: e.target.value }))} />
          </div>
        </div>
        {form.actual_cash && (
          <div className={`text-sm font-semibold p-2 rounded-lg ${diff >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {diff >= 0 ? `✅ Sobrante: ${fmt(diff)}` : `⚠️ Faltante: ${fmt(Math.abs(diff))}`}
          </div>
        )}
      </div>

      {/* Cups */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">🥤 Vasos</h2>
        {['16', '24'].map(oz => (
          <div key={oz} className="grid grid-cols-3 gap-3 items-center">
            <span className="text-sm font-medium">{oz} oz</span>
            <div>
              <label className="label">Sistema</label>
              <input className="input bg-gray-50" readOnly value={form[`cups_${oz}oz_system`] || 0} />
            </div>
            <div>
              <label className="label">Físico</label>
              <input className="input" type="number" placeholder="0"
                value={form[`cups_${oz}oz_actual`]}
                onChange={e => setForm(f => ({ ...f, [`cups_${oz}oz_actual`]: e.target.value }))} />
            </div>
          </div>
        ))}
      </div>

      {/* Bags */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">🧊 Bolsas</h2>
        {['creamy', 'refreshing'].map(type => (
          <div key={type} className="grid grid-cols-3 gap-3 items-center">
            <span className="text-sm font-medium">{type === 'creamy' ? 'Cremosos' : 'Refrescantes'}</span>
            <div>
              <label className="label">Sistema (ml)</label>
              <input className="input bg-gray-50" readOnly value={Number(form[`bags_${type}_system`] || 0).toFixed(0)} />
            </div>
            <div>
              <label className="label">Físico (ml)</label>
              <input className="input" type="number" placeholder="0"
                value={form[`bags_${type}_actual`]}
                onChange={e => setForm(f => ({ ...f, [`bags_${type}_actual`]: e.target.value }))} />
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="card">
        <label className="label">Observaciones</label>
        <textarea className="input h-20 resize-none" placeholder="Notas del arqueo..."
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full justify-center flex items-center gap-2">
        {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💰'}
        Guardar Arqueo
      </button>
    </form>
  )
}
