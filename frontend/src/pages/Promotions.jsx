import { useEffect, useState } from 'react'
import { getPromotions, createPromotion, updatePromotion, togglePromotion, getCupSizes } from '../api'
import toast from 'react-hot-toast'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

const EMPTY_FORM = { name: '', description: '', cup_size: '', quantity_included: 2, promo_price: '', valid_days: '' }

export default function Promotions() {
  const [promos,    setPromos]    = useState([])
  const [cupSizes,  setCupSizes]  = useState([])
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState(null)

  const load = () => getPromotions().then(r => setPromos(r.data?.results ?? r.data ?? []))

  useEffect(() => {
    load()
    getCupSizes().then(r => setCupSizes(r.data?.results ?? r.data ?? []))
  }, [])

  const openNew = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }
  const openEdit = (p) => {
    setForm({
      name: p.name, description: p.description || '',
      cup_size: p.cup_size || '', quantity_included: p.quantity_included,
      promo_price: p.promo_price, valid_days: p.valid_days || '',
    })
    setEditing(p.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.cup_size) { toast.error('Debes seleccionar un vaso'); return }
    const payload = { ...form, cup_size: Number(form.cup_size) }
    try {
      if (editing) {
        await updatePromotion(editing, payload)
        toast.success('Promoción actualizada')
      } else {
        await createPromotion(payload)
        toast.success('Promoción creada')
      }
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleToggle = async (p) => {
    await togglePromotion(p.id)
    toast.success(p.is_active ? 'Promoción desactivada' : 'Promoción activada')
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Promociones</h1>
          <p className="text-sm text-gray-400 mt-0.5">{promos.length} promo{promos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nueva Promoción</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card border border-brand-pink/30 space-y-4">
          <h2>{editing ? 'Editar Promoción' : 'Nueva Promoción'}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre</label>
              <input className="input" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: 2x25 16oz" />
            </div>

            <div className="col-span-2">
              <label className="label">Vaso <span className="text-brand-pink">*</span></label>
              <select className="input" required value={form.cup_size}
                onChange={e => setForm(f => ({ ...f, cup_size: e.target.value }))}>
                <option value="" disabled>Selecciona un vaso</option>
                {cupSizes.map(c => (
                  <option key={c.id} value={c.id}>{c.size} — {c.ml} ml — ${Number(c.price).toLocaleString('es-CO')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Cantidad de vasos</label>
              <input className="input" type="number" min="1" required value={form.quantity_included}
                onChange={e => setForm(f => ({ ...f, quantity_included: Number(e.target.value) }))} />
            </div>

            <div>
              <label className="label">Precio total de la promo</label>
              <input className="input" type="number" required value={form.promo_price}
                placeholder="Ej: 25000"
                onChange={e => setForm(f => ({ ...f, promo_price: e.target.value }))} />
            </div>

            <div className="col-span-2">
              <label className="label">Descripción (opcional)</label>
              <input className="input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          {/* Preview */}
          {form.cup_size && form.quantity_included && form.promo_price && (
            <div className="bg-brand-navy/5 rounded-xl p-3 text-sm text-brand-navy">
              <span className="font-semibold">{form.quantity_included} vasos</span>
              {' '}de{' '}
              <span className="font-semibold">{cupSizes.find(c => String(c.id) === String(form.cup_size))?.size}</span>
              {' '}por{' '}
              <span className="font-semibold text-brand-pink">{fmt(form.promo_price)}</span>
              {' '}— {fmt(Math.round(Number(form.promo_price) / Number(form.quantity_included)))} c/u
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editing ? 'Guardar' : 'Crear'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {promos.length === 0 && (
          <div className="col-span-full card text-center py-10 text-gray-300">
            <p className="text-sm">Sin promociones creadas</p>
          </div>
        )}
        {promos.map(p => (
          <div key={p.id} className={`card border-2 transition-all ${p.is_active ? 'border-brand-lime/60' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-brand-navy text-base">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.quantity_included} × {p.cup_size_label || 'Sin vaso asignado'}
                </p>
                {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="font-extrabold text-brand-pink text-xl">{fmt(p.promo_price)}</p>
                <p className="text-xs text-gray-400">{fmt(p.unit_price)} c/u</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleToggle(p)}
                className={`flex-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  p.is_active
                    ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-500'
                    : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700'
                }`}>
                {p.is_active ? 'Activa' : 'Inactiva'}
              </button>
              <button onClick={() => openEdit(p)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-medium">
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
