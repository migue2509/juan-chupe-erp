import { useEffect, useState } from 'react'
import { getFlavors, getCupSizes, getToppings, getActivePromotions, createSale, getTransferMethods } from '../api/index'
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
  const [isDelivery,        setIsDelivery]        = useState(false)
  const [deliveryAddress,   setDeliveryAddress]   = useState('')
  const [deliveryFourDigits, setDeliveryFourDigits] = useState('')
  const [deliveryNotes,     setDeliveryNotes]     = useState('')
  const [isCourtesy,        setIsCourtesy]        = useState(false)
  const [courtesyPaid,      setCourtesyPaid]      = useState('')
  const [courtesyMethod,    setCourtesyMethod]    = useState('cash')  // 'cash' | 'transfer'
  const [courtesyTransferRef, setCourtesyTransferRef] = useState('')
  const [submitting,        setSubmitting]        = useState(false)
  const [transferMethods,   setTransferMethods]   = useState([])
  const [qrZoom,            setQrZoom]            = useState(null) // { url, name }
  const [cartOpen,          setCartOpen]          = useState(false)

  useEffect(() => {
    const get = async (fn, set, label) => {
      try { const r = await fn(); set(r.data?.results ?? r.data ?? []) }
      catch (e) { console.error(`POS: ${label}`, e?.response?.data ?? e) }
    }
    const loadAll = () => {
      get(getFlavors,          setFlavors,    'sabores')
      get(getCupSizes,         setCupSizes,   'vasos')
      get(getToppings,         setToppings,   'toppings')
      get(getActivePromotions, setPromotions, 'promos')
      get(getTransferMethods,  setTransferMethods, 'transfer-methods')
    }
    loadAll()
    // Refresca cuando el usuario vuelve a la pestaña
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
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
  const change       = paymentMethod === 'cash' && !isCourtesy
    ? Math.max(0, Number(cashReceived) - orderTotal)
    : paymentMethod === 'mixed' && !isCourtesy
      ? Math.max(0, Number(cashReceived) - Math.max(0, orderTotal - Number(transferAmount || 0)))
      : 0
  const courtesyDiff = isCourtesy ? Math.max(0, orderTotal - Number(courtesyPaid || 0)) : 0

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    if (isDelivery && !deliveryAddress.trim()) { toast.error('Ingresa la dirección del domicilio'); return }
    setSubmitting(true)
    try {
      const promoIds = [...new Set(items.map(i => i.promoId).filter(Boolean))]
      const singlePromo = promoIds.length === 1 && items.every(i => i.promoId) ? promoIds[0] : null

      const courtesyAmount = Number(courtesyPaid) || 0
      const saleRes = await createSale({
        seller_id: user?.id,
        promotion_id: singlePromo,
        payment_method: isCourtesy ? courtesyMethod : paymentMethod,
        cash_received:    isCourtesy ? (courtesyMethod === 'cash'     ? courtesyAmount : 0) : (Number(cashReceived) || 0),
        transfer_amount:  isCourtesy ? (courtesyMethod === 'transfer' ? courtesyAmount : 0) : (Number(transferAmount) || 0),
        transfer_reference: isCourtesy ? (courtesyMethod === 'transfer' ? courtesyTransferRef : '') : transferRef,
        is_delivery:      isDelivery,
        delivery_address: isDelivery ? deliveryAddress.trim() : '',
        delivery_client:  isDelivery ? deliveryFourDigits.trim() : '',
        delivery_notes:   isDelivery ? deliveryNotes.trim() : '',
        is_courtesy: isCourtesy,
        courtesy_paid: courtesyAmount,
        items: items.map(i => ({
          cup_size_id: i.cupSizeId || null,
          flavor_ids:  i.flavorIds || [],
          topping_id:  i.toppingId || null,
          unit_price:  i.unit_price,
          quantity:    i.qty,
        }))
      })

      toast.success('Venta registrada')
      setCartOpen(false)
      setItems([])
      setCurrent(emptyItem())
      setPromoConfig(null)
      setPromoId(null)
      setCashReceived('')
      setTransferAmount('')
      setTransferRef('')
      setIsDelivery(false)
      setDeliveryAddress('')
      setDeliveryFourDigits('')
      setDeliveryNotes('')
      setIsCourtesy(false)
      setCourtesyPaid('')
      setCourtesyMethod('cash')
      setCourtesyTransferRef('')
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
    <>
    <div className="flex flex-col md:flex-row gap-4 md:gap-5 h-full max-h-full">

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
                        const stock = Number(f.bag?.stock_ml ?? 0)
                        const minStock = Number(f.bag?.min_stock_ml ?? 0)
                        const agotado = stock <= 0
                        const bajo = !agotado && f.bag && stock < minStock
                        return (
                          <button key={f.id} onClick={() => togglePromoFlavor(f.id)}
                            className={`p-3 rounded-xl text-center border-2 transition-all text-sm font-medium relative ${
                              sel ? 'border-brand-pink bg-pink-50 text-brand-pink' : agotado ? 'border-gray-100 bg-gray-50 text-gray-400' : bajo ? 'border-amber-200 bg-amber-50 text-gray-600 hover:border-amber-300' : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                            }`}>
                            <div className={`text-2xl leading-none mx-auto mb-1.5 ${agotado ? 'opacity-40' : ''}`}>{f.emoji || '🍧'}</div>
                            <div className="text-xs leading-tight">{f.name}</div>
                            {agotado && (
                              <div className="text-[9px] font-bold text-red-400 uppercase tracking-wide mt-1">Agotado</div>
                            )}
                            {bajo && (
                              <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wide mt-1">Stock bajo</div>
                            )}
                            {f.licores && (
                            <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                              {f.licores.split(',').map(l => l.trim()).filter(Boolean).map(l => (
                                <span key={l} className="text-[9px] bg-purple-100 text-purple-600 px-1 py-px rounded-full leading-none">{l}</span>
                              ))}
                            </div>
                          )}
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
                      const stock = Number(f.bag?.stock_ml ?? 0)
                      const minStock = Number(f.bag?.min_stock_ml ?? 0)
                      const agotado = stock <= 0
                      const bajo = !agotado && f.bag && stock < minStock
                      return (
                        <button key={f.id} onClick={() => toggleFlavor(f.id)}
                          className={`p-3 rounded-xl text-center border-2 transition-all text-sm font-medium ${
                            sel ? 'border-brand-pink bg-pink-50 text-brand-pink' : agotado ? 'border-gray-100 bg-gray-50 text-gray-400' : bajo ? 'border-amber-200 bg-amber-50 text-gray-600 hover:border-amber-300' : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div className={`text-2xl leading-none mx-auto mb-1.5 ${agotado ? 'opacity-40' : ''}`}>{f.emoji || '🍧'}</div>
                          <div className="text-xs leading-tight">{f.name}</div>
                          {agotado && (
                            <div className="text-[9px] font-bold text-red-400 uppercase tracking-wide mt-1">Agotado</div>
                          )}
                          {bajo && (
                            <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wide mt-1">Stock bajo</div>
                          )}
                          {f.licores && (
                            <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                              {f.licores.split(',').map(l => l.trim()).filter(Boolean).map(l => (
                                <span key={l} className="text-[9px] bg-purple-100 text-purple-600 px-1 py-px rounded-full leading-none">{l}</span>
                              ))}
                            </div>
                          )}
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

      {/* Backdrop móvil */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setCartOpen(false)} />
      )}

      <div className={`md:w-72 lg:w-80 md:flex-shrink-0 md:relative md:translate-y-0
        fixed inset-x-0 bottom-0 z-50 md:z-auto transition-transform duration-300 ease-in-out
        ${cartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
        <div className="card md:h-full flex flex-col max-h-[88vh] md:max-h-full overflow-y-auto rounded-b-none md:rounded-2xl">

          {/* Handle — solo móvil */}
          <div className="md:hidden flex items-center justify-between mb-3">
            <h2 className="text-gray-900">Carrito</h2>
            <button onClick={() => setCartOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
          <h2 className="hidden md:block text-gray-900 mb-4">Resumen del Pedido</h2>

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
              {cashReceived && Number(cashReceived) > 0 && change > 0 && (
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
                {paymentMethod === 'mixed' && cashReceived && Number(cashReceived) > 0 && Number(cashReceived) < orderTotal && !transferAmount && (
                  <p className="text-xs text-cyan-600 mt-1">
                    Sugerido: {fmt(orderTotal - Number(cashReceived))}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Referencia</label>
                <input type="text" className="input" placeholder="# comprobante" value={transferRef}
                  onChange={e => setTransferRef(e.target.value)} />
              </div>

              {/* Panel de métodos de transferencia */}
              {transferMethods.filter(m => m.is_active).length > 0 && (
                <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">
                    Métodos de transferencia
                  </p>
                  {transferMethods.filter(m => m.is_active).map(m => {
                    const providerColors = {
                      bancolombia: 'bg-yellow-100 text-yellow-800',
                      nequi:       'bg-purple-100 text-purple-800',
                      daviplata:   'bg-red-100 text-red-700',
                      other:       'bg-gray-100 text-gray-600',
                    }
                    const badgeCls = providerColors[m.provider] || providerColors.other
                    return (
                      <div key={m.id} className="flex gap-3 items-center bg-white rounded-lg p-2.5 border border-cyan-100">
                        {m.qr_image_url ? (
                          <button
                            type="button"
                            onClick={() => setQrZoom({ url: m.qr_image_url, name: m.display_name })}
                            className="shrink-0 group relative"
                            title="Ampliar QR"
                          >
                            <img
                              src={m.qr_image_url}
                              alt={`QR ${m.display_name}`}
                              className="w-16 h-16 object-contain rounded border border-gray-100 group-hover:opacity-80 transition-opacity"
                            />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="bg-black/50 rounded-full p-1">
                                <Icon name="qr" className="w-4 h-4 text-white" />
                              </span>
                            </span>
                          </button>
                        ) : (
                          <div className="w-16 h-16 rounded border border-dashed border-gray-200 flex items-center justify-center shrink-0">
                            <Icon name="qr" className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                            {m.provider_label}
                          </span>
                          <p className="font-semibold text-gray-800 text-sm mt-1 truncate">{m.display_name}</p>
                          {m.account_number && (
                            <p className="text-sm font-mono text-cyan-700">{m.account_number}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Delivery toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={isDelivery} onChange={e => setIsDelivery(e.target.checked)}
              className="w-4 h-4 accent-brand-pink" />
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <Icon name="bike" className="w-4 h-4 text-gray-400" />
              Es domicilio
            </span>
          </label>

          {/* Campos domicilio */}
          {isDelivery && (
            <div className="space-y-2 p-3 bg-cyan-50 border border-cyan-100 rounded-xl">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Dirección <span className="text-red-400">*</span></label>
                  <input className="input text-sm" placeholder="Calle, barrio..."
                    value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                </div>
                <div className="w-28">
                  <label className="label">Cliente</label>
                  <input className="input text-sm" placeholder="Nombre..."
                    value={deliveryFourDigits}
                    onChange={e => setDeliveryFourDigits(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Notas del pedido</label>
                <input className="input text-sm" placeholder="Indicaciones adicionales..."
                  value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} />
              </div>
            </div>
          )}

          {/* Cortesía toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={isCourtesy}
              onChange={e => { setIsCourtesy(e.target.checked); setCourtesyPaid(''); setCourtesyMethod('cash'); setCourtesyTransferRef('') }}
              className="w-4 h-4 accent-brand-pink" />
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              Es cortesía
            </span>
          </label>

          {/* Campos cortesía */}
          {isCourtesy && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-xl space-y-2">
              <p className="text-xs text-pink-600 font-medium">
                La diferencia entre el total y lo recibido se registrará como gasto automáticamente.
              </p>

              {/* Método de pago cortesía */}
              <div className="flex gap-2">
                {[{ k: 'cash', l: 'Efectivo' }, { k: 'transfer', l: 'Transferencia' }].map(m => (
                  <button key={m.k} type="button"
                    onClick={() => setCourtesyMethod(m.k)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      courtesyMethod === m.k
                        ? 'border-brand-pink bg-brand-pink text-white'
                        : 'border-pink-200 text-pink-400 hover:border-pink-300 bg-white'
                    }`}>
                    {m.l}
                  </button>
                ))}
              </div>

              <div>
                <label className="label">Dinero recibido (0 si es gratis)</label>
                <input type="number" className="input text-sm" placeholder="0" min="0"
                  value={courtesyPaid} onChange={e => setCourtesyPaid(e.target.value)} />
              </div>

              {courtesyMethod === 'transfer' && (
                <div>
                  <label className="label">Referencia transferencia</label>
                  <input className="input text-sm" placeholder="Nro. de referencia..."
                    value={courtesyTransferRef} onChange={e => setCourtesyTransferRef(e.target.value)} />
                </div>
              )}

              {orderTotal > 0 && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-gray-500">Gasto que se generará:</span>
                  <span className="font-bold text-red-500">{fmt(courtesyDiff)}</span>
                </div>
              )}
            </div>
          )}


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

      {/* Botón flotante carrito — solo móvil */}
      <button
        onClick={() => setCartOpen(true)}
        className={`md:hidden fixed bottom-5 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white font-semibold text-sm transition-all duration-300 ${
          cartOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ background: 'linear-gradient(135deg, #FF0099, #7B2FFF)' }}>
        <Icon name="cup" className="w-4 h-4" />
        <span>{items.length} ítem{items.length !== 1 ? 's' : ''}</span>
        <span className="font-bold">{fmt(orderTotal)}</span>
      </button>

      {/* Modal QR fullscreen */}
      {qrZoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setQrZoom(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-bold text-gray-800 text-lg">{qrZoom.name}</p>
            <img src={qrZoom.url} alt={qrZoom.name} className="w-full object-contain rounded-xl" />
            <p className="text-xs text-gray-400">Apunta la cámara al código para transferir</p>
            <button onClick={() => setQrZoom(null)} className="btn-ghost w-full justify-center">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
