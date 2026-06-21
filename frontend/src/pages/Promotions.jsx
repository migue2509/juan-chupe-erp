import { useEffect, useState } from 'react'
import { getPromotions, createPromotion, togglePromotion } from '../api'
import toast from 'react-hot-toast'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

export default function Promotions() {
  const [promos, setPromos] = useState([])
  const [form, setForm] = useState({ name: '', description: '', quantity_included: 2, promo_price: '', valid_days: '' })
  const [showForm, setShowForm] = useState(false)

  const load = () => getPromotions().then(r => setPromos(r.data.results || r.data))
  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createPromotion(form)
      toast.success('Promoción creada')
      setForm({ name: '', description: '', quantity_included: 2, promo_price: '', valid_days: '' })
      setShowForm(false)
      load()
    } catch {}
  }

  const handleToggle = async (p) => {
    await togglePromotion(p.id)
    toast.success(p.is_active ? 'Promoción desactivada' : 'Promoción activada')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-brand-navy">Promociones</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Nueva Promoción</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card border-brand-pink border space-y-3">
          <h2 className="text-brand-pink">Nueva Promoción</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: 2x25" />
            </div>
            <div>
              <label className="label">Cantidad incluida</label>
              <input className="input" type="number" min="1" required value={form.quantity_included}
                onChange={e => setForm(f => ({ ...f, quantity_included: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Precio promocional</label>
              <input className="input" type="number" required value={form.promo_price}
                onChange={e => setForm(f => ({ ...f, promo_price: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Crear</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {promos.map(p => (
          <div key={p.id} className={`card border-2 ${p.is_active ? 'border-brand-lime' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-brand-navy text-lg">🎉 {p.name}</p>
                <p className="text-sm text-gray-500">{p.quantity_included} granizados</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-brand-pink text-xl">{fmt(p.promo_price)}</p>
                <p className="text-xs text-gray-400">{fmt(p.unit_price)} c/u</p>
              </div>
            </div>
            <button onClick={() => handleToggle(p)}
              className={`mt-3 text-xs px-4 py-1.5 rounded-full font-semibold transition-all ${p.is_active ? 'bg-brand-lime/30 text-green-700 hover:bg-red-50 hover:text-red-500' : 'bg-gray-100 text-gray-500 hover:bg-brand-lime/20 hover:text-green-700'}`}>
              {p.is_active ? '✅ Activa — Click para desactivar' : '⛔ Inactiva — Click para activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
