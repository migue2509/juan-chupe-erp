import { useEffect, useState } from 'react'
import { getPromotions, createPromotion, updatePromotion, togglePromotion, setPromotionItems, getCupSizes } from '../api'
import toast from 'react-hot-toast'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'pos',
  // POS
  cup_size: '',
  quantity_included: 2,
  // Plataforma
  platform_fee_pct: '',
  promo_price: '',
  valid_days: '',
}

const EMPTY_ITEM = { cup_size: '', quantity: 1, custom_name: '' }

const CATEGORY_COLORS = {
  rappi: { badge: 'bg-[#FF424D] text-white', border: 'border-[#FF424D]/40', label: 'Rappi' },
  didi:  { badge: 'bg-[#FF6600] text-white', border: 'border-[#FF6600]/40', label: 'DiDi' },
  pos:   { badge: 'bg-brand-navy text-white', border: 'border-brand-lime/60', label: 'POS' },
}

export default function Promotions() {
  const [promos,   setPromos]   = useState([])
  const [cupSizes, setCupSizes] = useState([])
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [items,    setItems]    = useState([{ ...EMPTY_ITEM }])  // para promos de plataforma
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)

  const load = () => getPromotions().then(r => setPromos(r.data?.results ?? r.data ?? []))

  useEffect(() => {
    load()
    getCupSizes().then(r => setCupSizes(r.data?.results ?? r.data ?? []))
  }, [])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setItems([{ ...EMPTY_ITEM }])
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (p) => {
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category || 'pos',
      cup_size: p.cup_size || '',
      quantity_included: p.quantity_included,
      platform_fee_pct: p.platform_fee_pct || '',
      promo_price: p.promo_price,
      valid_days: p.valid_days || '',
    })
    setItems(
      p.items?.length > 0
        ? p.items.map(i => ({ cup_size: i.cup_size || '', quantity: i.quantity, custom_name: i.custom_name || '' }))
        : [{ ...EMPTY_ITEM }]
    )
    setEditing(p.id)
    setShowForm(true)
  }

  const isPlatform = form.category === 'rappi' || form.category === 'didi'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isPlatform && !form.cup_size) { toast.error('Debes seleccionar un vaso'); return }
    if (isPlatform && items.some(i => !i.cup_size)) { toast.error('Cada producto necesita un tamaño de vaso'); return }

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      promo_price: Number(form.promo_price),
      platform_fee_pct: isPlatform ? Number(form.platform_fee_pct || 0) : 0,
      valid_days: form.valid_days,
      ...(isPlatform
        ? { cup_size: null, quantity_included: items.reduce((s, i) => s + Number(i.quantity), 0) }
        : { cup_size: Number(form.cup_size), quantity_included: form.quantity_included }
      ),
    }

    try {
      let id = editing
      if (editing) {
        await updatePromotion(editing, payload)
        toast.success('Promoción actualizada')
      } else {
        const res = await createPromotion(payload)
        id = res.data.id
        toast.success('Promoción creada')
      }

      if (isPlatform) {
        await setPromotionItems(id, items.map(i => ({
          cup_size: Number(i.cup_size),
          quantity: Number(i.quantity),
          custom_name: i.custom_name,
        })))
      }

      setShowForm(false); setEditing(null); setForm(EMPTY_FORM); setItems([{ ...EMPTY_ITEM }])
      load()
    } catch (err) {
      const d = err?.response?.data
      console.error('Error al guardar promoción:', d)
      let msg = 'Error al guardar'
      if (d) {
        if (typeof d === 'string') msg = d
        else if (d.detail) msg = d.detail
        else {
          // Muestra errores de campo: { cup_size: ["msg"], non_field_errors: ["msg"] }
          const parts = Object.entries(d).map(([k, v]) => {
            const val = Array.isArray(v) ? v[0] : v
            return `${k}: ${val}`
          })
          if (parts.length) msg = parts.join(' | ')
        }
      }
      toast.error(msg)
    }
  }

  const handleToggle = async (p) => {
    await togglePromotion(p.id)
    toast.success(p.is_active ? 'Promoción desactivada' : 'Promoción activada')
    load()
  }

  // Item list helpers
  const addItem    = () => setItems(it => [...it, { ...EMPTY_ITEM }])
  const removeItem = (i) => setItems(it => it.filter((_, idx) => idx !== i))
  const setItem    = (i, key, val) => setItems(it => it.map((item, idx) => idx === i ? { ...item, [key]: val } : item))

  // Group promos by category for the list
  const platformPromos = promos.filter(p => p.category !== 'pos')
  const posPromos      = promos.filter(p => !p.category || p.category === 'pos')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Promociones</h1>
          <p className="text-sm text-gray-400 mt-0.5">{promos.length} promo{promos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nueva Promoción</button>
      </div>

      {/* ── Formulario ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card border border-brand-pink/30 space-y-4">
          <h2>{editing ? 'Editar Promoción' : 'Nueva Promoción'}</h2>

          {/* Nombre + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Combo Rappi Grande" />
            </div>

            <div>
              <label className="label">Canal de venta</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="pos">POS — Punto de venta</option>
                <option value="rappi">Rappi</option>
                <option value="didi">DiDi</option>
              </select>
            </div>
          </div>

          {/* ── Campos según categoría ── */}
          {!isPlatform ? (
            /* POS: un vaso + cantidad */
            <div className="grid grid-cols-2 gap-3">
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
                <label className="label">Precio total</label>
                <input className="input" type="number" required value={form.promo_price}
                  placeholder="Ej: 25000"
                  onChange={e => setForm(f => ({ ...f, promo_price: e.target.value }))} />
              </div>
            </div>
          ) : (
            /* Plataforma: precio + descuento + items */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio total del pedido</label>
                  <input className="input" type="number" required value={form.promo_price}
                    placeholder="Ej: 22000"
                    onChange={e => setForm(f => ({ ...f, promo_price: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Descuento plataforma (%)</label>
                  <input className="input" type="number" min="0" max="100" value={form.platform_fee_pct}
                    placeholder="Ej: 30"
                    onChange={e => setForm(f => ({ ...f, platform_fee_pct: e.target.value }))} />
                </div>
              </div>

              {/* Preview precio neto */}
              {form.promo_price && (
                <div className={`rounded-xl p-3 text-sm flex items-center justify-between ${
                  form.category === 'rappi' ? 'bg-[#FF424D]/8 text-[#FF424D]' : 'bg-[#FF6600]/8 text-[#FF6600]'
                }`}>
                  <span>Precio que recibes:</span>
                  <span className="font-bold text-base">
                    {fmt(Math.round(Number(form.promo_price) * (1 - Number(form.platform_fee_pct || 0) / 100)))}
                    {form.platform_fee_pct > 0 && (
                      <span className="text-xs ml-1 opacity-60">({form.platform_fee_pct}% descuento)</span>
                    )}
                  </span>
                </div>
              )}

              {/* Productos del pedido */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Productos incluidos</label>
                  <button type="button" onClick={addItem}
                    className="text-xs text-brand-pink hover:underline font-medium">+ Agregar producto</button>
                </div>

                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select className="input flex-1" value={item.cup_size}
                        onChange={e => setItem(i, 'cup_size', e.target.value)}>
                        <option value="" disabled>Vaso</option>
                        {cupSizes.map(c => (
                          <option key={c.id} value={c.id}>{c.size}</option>
                        ))}
                      </select>

                      <input className="input w-20" type="number" min="1" value={item.quantity}
                        onChange={e => setItem(i, 'quantity', e.target.value)}
                        placeholder="Cant." />

                      <input className="input flex-1" value={item.custom_name}
                        onChange={e => setItem(i, 'custom_name', e.target.value)}
                        placeholder="Nombre (opcional)" />

                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)}
                          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">Descripción (opcional)</label>
            <input className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editing ? 'Guardar' : 'Crear'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {/* ── Lista ── */}

      {/* Plataformas */}
      {platformPromos.length > 0 && (
        <div>
          <p className="label mb-3">Pedidos de plataforma</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {platformPromos.map(p => {
              const cfg = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.pos
              return (
                <div key={p.id} className={`card border-2 transition-all ${p.is_active ? cfg.border : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <p className="font-bold text-brand-navy text-sm truncate">{p.name}</p>
                      </div>
                      {p.items?.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          {p.items.map(item => (
                            <p key={item.id} className="text-xs text-gray-500">
                              {item.quantity}× {item.cup_size_label || '—'}
                              {item.custom_name && <span className="text-gray-400"> · {item.custom_name}</span>}
                            </p>
                          ))}
                        </div>
                      )}
                      {p.description && <p className="text-xs text-gray-400 mt-1">{p.description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-extrabold text-brand-pink text-xl">{fmt(p.promo_price)}</p>
                      {Number(p.platform_fee_pct) > 0 && (
                        <>
                          <p className="text-[10px] text-red-400">-{p.platform_fee_pct}% plataforma</p>
                          <p className="text-xs text-gray-500 font-medium">Recibes {fmt(p.net_price)}</p>
                        </>
                      )}
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
              )
            })}
          </div>
        </div>
      )}

      {/* POS */}
      {posPromos.length > 0 && (
        <div>
          {platformPromos.length > 0 && <p className="label mb-3">Punto de Venta</p>}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {posPromos.map(p => (
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
      )}

      {promos.length === 0 && (
        <div className="card text-center py-10 text-gray-300">
          <p className="text-sm">Sin promociones creadas</p>
        </div>
      )}
    </div>
  )
}
