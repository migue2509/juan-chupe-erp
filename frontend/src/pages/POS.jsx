import { useEffect, useState } from 'react'
import { getFlavors, getCupSizes, getToppings, getActivePromotions, createSale } from '../api/index'
import { Icon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

const FLAVOR_CATS = [
  { value: 'creamy',       label: 'Cremosos',    cls: 'text-amber-600 border-amber-200 bg-amber-50' },
  { value: 'refreshing',   label: 'Refrescantes', cls: 'text-cyan-600 border-cyan-200 bg-cyan-50' },
  { value: 'non_alcoholic',label: 'Sin Alcohol',  cls: 'text-violet-600 border-violet-200 bg-violet-50' },
]

const PAYMENT_MODES = [
  { key: 'cash',     label: 'Efectivo',      icon: 'cash' },
  { key: 'transfer', label: 'Transferencia', icon: 'transfer' },
  { key: 'mixed',    label: 'Mixto',         icon: 'mixed' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
const emptyItem = () => ({ cupSizeId: null, flavorIds: [], qty: 1 })

export default function POS() {
  const { user } = useAuth()
  const [flavors,    setFlavors]    = useState([])
  const [cupSizes,   setCupSizes]   = useState([])
  const [toppings,   setToppings]   = useState([])
  const [promotions, setPromotions] = useState([])

  // ── Orden ──
  const [items,      setItems]      = useState([])

  // ── Configurador item regular ──
  const [current,    setCurrent]    = useState(emptyItem())

  // ── Configurador promo ──
  // { promo, activeCup: 0, cups: [{flavorIds:[], toppingId:null}, ...] }
  const [promoConfig, setPromoConfig] = useState(null)

  // ── Pago ──
  const [promoId,        setPromoId]        = useState(null)
  const [paymentMethod,  setPaymentMethod]  = useState('cash')
  const [cashReceived,   setCashReceived]   = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferRef,    setTransferRef]    = useState('')
  const [isDelivery,     setIsDelivery]     = useState(false)
  const [submitting,     setSubmitting]     = useState(false)

  useEffect(() => {
    const get = async (fn, set, label) => {
      try { const r = await fn(); set(r.data?.results ?? r.data ?? []) }
      catch (e) { console.error(`POS: ${label}`, e?.response?.data ?? e) }
    }
    get(getFlavors,          setFlavors,    'sabores')
    get(getCupSizes,         setCupSizes,   'vasos')
    get(getToppings,         setToppings,   'toppings')
    get(getActivePromotions, setPromotions, 'promos')
  }, [])

  // ─── Item regular ─────────────────────────────────────────────────────────
  const selectedCup = cupSizes.find(c => c.id === current.cupSizeId)
  const unitPrice   = () => selectedCup ? Number(selectedCup.price) : 0

  const toggleFlavor = (id) => setCurrent(p => ({
    ...p,
    flavorIds: p.flavorIds.includes(id) ? p.flavorIds.filter(f => f !== id) : [...p.flavorIds, id]
  }))

  const addRegularItem = () => {
    if (!current.cupSizeId || current.flavorIds.length === 0) {
      toast.error('Selecciona tamaño y al menos un sabor')
      return
    }
    const cup    = cupSizes.find(c => c.id === current.cupSizeId)
    const fNames = current.flavorIds.map(id => flavors.find(f => f.id === id)?.name).join(' + ')
    setItems(prev => [...prev, {
      ...current,
      id: Date.now(),
      label: `${cup.size} — ${fNames}`,
      unit_price: unitPrice(),
      topping_price: 0,
      promoId: null,
    }])
    setCurrent(emptyItem())
  }

  // ─── Promo ────────────────────────────────────────────────────────────────
  const startPromo = (promo) => {
    setPromoConfig({
      promo,
      activeCup: 0,
      cups: Array.from({ length: promo.quantity_included }, () => ({ flavorIds: [] })),
    })
    setPromoId(promo.id)
  }

  const cancelPromo = () => { setPromoConfig(null); setPromoId(null) }

  const togglePromoFlavor = (flavorId) => {
    setPromoConfig(p => {
      const cups = p.cups.map((c, i) => {
        if (i !== p.activeCup) return c
        const has = c.flavorIds.includes(flavorId)
        return { ...c, flavorIds: has ? c.flavorIds.filter(f => f !== flavorId) : [...c.flavorIds, flavorId] }
      })
      return { ...p, cups }
    })
  }

  const addPromoItems = () => {
    const { promo, cups } = promoConfig
    if (cups.some(c => c.flavorIds.length === 0)) {
      toast.error('Cada vaso necesita al menos un sabor')
      return
    }
    const newItems = cups.map((cup, i) => {
      const fNames = cup.flavorIds.map(id => flavors.find(f => f.id === id)?.name).join(' + ')
      return {
        id: Date.now() + i,
        label: `${promo.name} · Vaso ${i + 1} — ${fNames}`,
        cupSizeId: promo.cup_size,
        flavorIds: cup.flavorIds,
        toppingId: null,
        qty: 1,
        unit_price: Number(promo.unit_price),
        topping_price: 0,
        promoId: promo.id,
        promoName: promo.name,
      }
    })
    setItems(prev => [...prev, ...newItems])
    setPromoConfig(null)
    toast.success(`${promo.name} agregada al pedido`)
  }

  // ─── Orden ────────────────────────────────────────────────────────────────
  const removeItem   = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const itemTotal    = (i) => (i.unit_price + (i.topping_price || 0)) * i.qty
  const orderTotal   = items.reduce((sum, i) => sum + itemTotal(i), 0)
  const change       = paymentMethod === 'cash' ? Math.max(0, Number(cashReceived) - orderTotal) : 0

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setSubmitting(true)
    try {
      // Si todos los items son de la misma promo, la marcamos en la venta
      const promoIds = [...new Set(items.map(i => i.promoId).filter(Boolean))]
      const singlePromo = promoIds.length === 1 && items.every(i => i.promoId) ? promoIds[0] : null

      await createSale({
        seller_id: user?.id,
        promotion_id: singlePromo,
        payment_method: paymentMethod,
        cash_received: Number(cashReceived) || 0,
        transfer_amount: Number(transferAmount) || 0,
        transfer_reference: transferRef,
        is_delivery: isDelivery,
        items: items.map(i => ({
          cup_size_id: i.cupSizeId || null,
          flavor_ids:  i.flavorIds || [],
          topping_id:  i.toppingId || null,
          unit_price:  i.unit_price,
          quantity:    i.qty,
        }))
      })
      toast.success('Venta registrada')
      setItems([])
      setCurrent(emptyItem())
      setPromoConfig(null)
      setPromoId(null)
      setCashReceived('')
      setTransferAmount('')
      setTransferRef('')
      setIsDelivery(false)
      setPaymentMethod('cash')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al registrar la venta', { duration: 6000 })
    }
    setSubmitting(false)
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  const promoActiveCupFlavors = promoConfig?.cups[promoConfig.activeCup]?.flavorIds ?? []
  const promoAllFilled = promoConfig?.cups.every(c => c.flavorIds.length > 0) ?? false

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full max-h-full">

      {/* ── Left panel ── */}
      <div className="flex-1 space-y-4 overflow-y-auto min-w-0">
        <h1>Punto de Venta</h1>

        {/* ── Promociones ── */}
        {promotions.length > 0 && (
          <div className="card">
            <p className="label mb-2">Promociones</p>
            <div className="flex gap-2 flex-wrap">
              {promotions.map(p => (
                <button key={p.id}
                  onClick={() => promoConfig?.promo?.id === p.id ? cancelPromo() : startPromo(p)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                    promoConfig?.promo?.id === p.id
                      ? 'border-brand-pink bg-brand-pink/8 text-brand-pink'
                      : 'border-gray-200 text-gray-700 hover:border-brand-pink/40 hover:bg-brand-pink/4'
                  }`}>
                  <span className="font-bold">{p.name}</span>
                  <span className="text-xs opacity-70">{p.quantity_included}×{p.cup_size_label}</span>
                  <span className="font-bold text-brand-pink">{fmt(p.promo_price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Configurador PROMO ── */}
        {promoConfig && (
          <div className="card border-2 border-brand-pink/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-brand-navy">{promoConfig.promo.name}</p>
                <p className="text-xs text-gray-400">{promoConfig.promo.cup_size_label} · Elige sabores para cada vaso</p>
              </div>
              <button onClick={cancelPromo} className="text-gray-300 hover:text-red-400 transition-colors">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs por vaso */}
            <div className="flex gap-2">
              {promoConfig.cups.map((cup, i) => (
                <button key={i}
                  onClick={() => setPromoConfig(p => ({ ...p, activeCup: i }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    promoConfig.activeCup === i
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : cup.flavorIds.length > 0
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-500'
                  }`}>
                  Vaso {i + 1}
                  {cup.flavorIds.length > 0 && promoConfig.activeCup !== i && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Selección de sabores para el vaso activo */}
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium">
                Sabores para Vaso {promoConfig.activeCup + 1}
                {promoActiveCupFlavors.length > 0 && (
                  <span className="ml-2 text-brand-pink">{promoActiveCupFlavors.length} seleccionado{promoActiveCupFlavors.length > 1 ? 's' : ''}</span>
                )}
              </p>
              {FLAVOR_CATS.map(cat => {
                const catFlavors = flavors.filter(f => f.category === cat.value)
                if (!catFlavors.length) return null
                return (
                  <div key={cat.value}>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1.5 ${cat.cls}`}>{cat.label}</span>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {catFlavors.map(f => {
                        const sel = promoActiveCupFlavors.includes(f.id)
                        return (
                          <button key={f.id} onClick={() => togglePromoFlavor(f.id)}
                            className={`p-3 rounded-xl text-center border-2 transition-all text-sm font-medium ${
                              sel ? 'border-brand-pink bg-brand-pink/8 text-brand-pink' : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                            style={sel && f.color ? { borderColor: f.color, backgroundColor: `${f.color}12` } : {}}>
                            <div className="w-8 h-8 rounded-full mx-auto mb-1.5 border-2 border-white shadow-sm"
                              style={{ background: f.color || '#e5e7eb' }} />
                            <div className="text-xs leading-tight">{f.name}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Avanzar o agregar */}
            <div className="flex justify-end">
              {promoConfig.activeCup < promoConfig.cups.length - 1 ? (
                <button
                  onClick={() => promoActiveCupFlavors.length > 0
                    ? setPromoConfig(p => ({ ...p, activeCup: p.activeCup + 1 }))
                    : toast.error('Elige al menos un sabor')}
                  className="btn-cyan px-4">
                  Vaso {promoConfig.activeCup + 2}
                  <Icon name="chevronRight" className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={addPromoItems} disabled={!promoAllFilled}
                  className="btn-primary px-4 disabled:opacity-40">
                  <Icon name="plus" className="w-4 h-4" />
                  Agregar Promo
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Configurador item regular ── */}

        <div className="card space-y-4">
          <p className="font-semibold text-gray-700 text-sm">Granizado individual</p>

          {/* Cup sizes */}
          <div>
            <label className="label">Tamaño</label>
            <div className="grid grid-cols-4 gap-2">
              {cupSizes.map(c => (
                <button key={c.id}
                  onClick={() => setCurrent(p => ({ ...p, cupSizeId: c.id }))}
                  className={`p-3 rounded-xl text-center border-2 font-medium transition-all ${
                    current.cupSizeId === c.id
                      ? 'border-brand-cyan bg-brand-cyan/8 text-brand-navy'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                  }`}>
                  <Icon name="cup" className="w-6 h-6 mx-auto mb-1.5 opacity-70" />
                  <div className="font-bold text-sm">{c.size}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{fmt(c.price)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Flavors agrupados por categoría */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label mb-0">Sabores</label>
              {current.flavorIds.length > 0 && (
                <span className="badge-pink">{current.flavorIds.length} seleccionado{current.flavorIds.length > 1 ? 's' : ''}</span>
              )}
            </div>
            {FLAVOR_CATS.map(cat => {
              const catFlavors = flavors.filter(f => f.category === cat.value)
              if (!catFlavors.length) return null
              return (
                <div key={cat.value}>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1.5 ${cat.cls}`}>{cat.label}</span>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {catFlavors.map(f => {
                      const sel = current.flavorIds.includes(f.id)
                      return (
                        <button key={f.id} onClick={() => toggleFlavor(f.id)}
                          className={`p-3 rounded-xl text-center border-2 transition-all text-sm font-medium ${
                            sel ? 'border-brand-pink bg-brand-pink/8 text-brand-pink' : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                          style={sel && f.color ? { borderColor: f.color, backgroundColor: `${f.color}12` } : {}}>
                          <div className="w-8 h-8 rounded-full mx-auto mb-1.5 border-2 border-white shadow-sm"
                            style={{ background: f.color || '#e5e7eb' }} />
                          <div className="text-xs leading-tight">{f.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Qty + add */}
          <div className="flex gap-4 items-end">
            <div className="w-24">
              <label className="label">Cantidad</label>
              <input type="number" min="1" className="input" value={current.qty}
                onChange={e => setCurrent(p => ({ ...p, qty: Number(e.target.value) }))} />
            </div>
            <button onClick={addRegularItem} className="btn-cyan px-5">
              <Icon name="plus" className="w-4 h-4" />
              Agregar
            </button>
          </div>
        </div>

        {/* ── Vender topping solo ── */}
        {toppings.length > 0 && (
          <div className="card space-y-2">
            <p className="font-semibold text-gray-700 text-sm">Vender topping suelto</p>
            <div className="flex gap-2 flex-wrap">
              {toppings.map(t => (
                <button key={t.id}
                  onClick={() => setItems(prev => [...prev, {
                    id: Date.now(),
                    label: t.name,
                    cupSizeId: null,
                    flavorIds: [],
                    toppingId: t.id,
                    qty: 1,
                    unit_price: Number(t.price),
                    topping_price: 0,
                    promoId: null,
                    isToppingOnly: true,
                  }])}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-brand-cyan hover:bg-brand-cyan/5 transition-all">
                  <span>{t.name}</span>
                  <span className="text-brand-pink font-bold">{fmt(t.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: order panel ── */}
      <div className="lg:w-80 flex-shrink-0">
        <div className="card h-full flex flex-col">
          <h2 className="text-gray-900 mb-4">Resumen del Pedido</h2>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 mb-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <Icon name="cup" className="w-10 h-10 mb-2" />
                <p className="text-sm">Sin productos aún</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className={`flex items-start justify-between gap-2 py-2 border-b ${
                  item.promoId ? 'border-brand-pink/10' : 'border-gray-50'
                }`}>
                  <div className="flex-1 min-w-0">
                    {item.promoId && (
                      <span className="inline-block text-[10px] font-semibold text-brand-pink bg-brand-pink/8 px-1.5 py-0.5 rounded mb-0.5">
                        {item.promoName}
                      </span>
                    )}
                    <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                    <p className="text-xs text-gray-400">
                      x{item.qty} × {fmt(item.unit_price)}
                      {item.topping_price > 0 && <span className="text-brand-cyan"> +{fmt(item.topping_price)} topping</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-brand-pink">{fmt(itemTotal(item))}</span>
                    <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment method */}
          <div className="mb-3">
            <label className="label">Medio de Pago</label>
            <div className="flex gap-1.5">
              {PAYMENT_MODES.map(m => (
                <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === m.key
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <Icon name={m.icon} className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
            <div className="mb-2">
              <label className="label">Efectivo recibido</label>
              <input type="number" className="input" placeholder="0" value={cashReceived}
                onChange={e => setCashReceived(e.target.value)} />
              {cashReceived && Number(cashReceived) > 0 && (
                <p className="text-xs text-green-600 mt-1 font-semibold">Cambio: {fmt(change)}</p>
              )}
            </div>
          )}

          {(paymentMethod === 'transfer' || paymentMethod === 'mixed') && (
            <div className="mb-2 space-y-2">
              <div>
                <label className="label">Monto transferencia</label>
                <input type="number" className="input" placeholder="0" value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Referencia</label>
                <input type="text" className="input" placeholder="# comprobante" value={transferRef}
                  onChange={e => setTransferRef(e.target.value)} />
              </div>
            </div>
          )}

          {/* Delivery toggle */}
          <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
            <input type="checkbox" checked={isDelivery} onChange={e => setIsDelivery(e.target.checked)}
              className="w-4 h-4 accent-brand-pink" />
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <Icon name="bike" className="w-4 h-4 text-gray-400" />
              Es domicilio
            </span>
          </label>

          {/* Total + submit */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total</span>
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(orderTotal)}</span>
            </div>
            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="check" className="w-4 h-4" />}
              {submitting ? 'Procesando...' : 'Registrar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
