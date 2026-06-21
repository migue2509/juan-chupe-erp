import { useEffect, useState } from 'react'
import { getFlavors, getCupSizes, getToppings, getActivePromotions, createSale } from '../api/index'
import { getOperatives as apiOperatives } from '../api/auth'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

const PAYMENT_MODES = [
  { key: 'cash',     label: 'Efectivo',      icon: 'cash' },
  { key: 'transfer', label: 'Transferencia', icon: 'transfer' },
  { key: 'mixed',    label: 'Mixto',         icon: 'mixed' },
]

export default function POS() {
  const [flavors, setFlavors]         = useState([])
  const [cupSizes, setCupSizes]       = useState([])
  const [toppings, setToppings]       = useState([])
  const [promotions, setPromotions]   = useState([])
  const [operatives, setOperatives]   = useState([])

  const [items, setItems]             = useState([])
  const [currentItem, setCurrentItem] = useState({ cupSizeId: null, flavorIds: [], toppingId: null, qty: 1 })
  const [sellerId, setSellerId]       = useState(null)
  const [promoId, setPromoId]         = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived]   = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferRef, setTransferRef]       = useState('')
  const [isDelivery, setIsDelivery]   = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    Promise.all([getFlavors(), getCupSizes(), getToppings(), getActivePromotions(), apiOperatives()])
      .then(([f, c, t, p, o]) => {
        setFlavors(f.data)
        setCupSizes(c.data)
        setToppings(t.data)
        setPromotions(p.data)
        setOperatives(o.data)
      })
  }, [])

  const selectedCup = cupSizes.find(c => c.id === currentItem.cupSizeId)
  const activePromo = promotions.find(p => p.id === promoId)
  const unitPrice   = () => activePromo ? Number(activePromo.unit_price) : selectedCup ? Number(selectedCup.price) : 0

  const addItem = () => {
    if (!currentItem.cupSizeId || currentItem.flavorIds.length === 0) {
      toast.error('Selecciona tamaño y al menos un sabor')
      return
    }
    const cup    = cupSizes.find(c => c.id === currentItem.cupSizeId)
    const fNames = currentItem.flavorIds.map(id => flavors.find(f => f.id === id)?.name).join(' + ')
    setItems(prev => [...prev, { ...currentItem, id: Date.now(), label: `${cup.size} — ${fNames}`, unit_price: unitPrice() }])
    setCurrentItem({ cupSizeId: null, flavorIds: [], toppingId: null, qty: 1 })
  }

  const removeItem    = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const orderTotal    = items.reduce((sum, i) => sum + i.unit_price * i.qty, 0)
  const change        = paymentMethod === 'cash' ? Math.max(0, Number(cashReceived) - orderTotal) : 0
  const toggleFlavor  = (id) => setCurrentItem(prev => ({
    ...prev,
    flavorIds: prev.flavorIds.includes(id) ? prev.flavorIds.filter(f => f !== id) : [...prev.flavorIds, id]
  }))

  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setSubmitting(true)
    try {
      await createSale({
        seller_id: sellerId,
        promotion_id: promoId,
        payment_method: paymentMethod,
        cash_received: Number(cashReceived) || 0,
        transfer_amount: Number(transferAmount) || 0,
        transfer_reference: transferRef,
        is_delivery: isDelivery,
        items: items.map(i => ({
          cup_size_id: i.cupSizeId,
          flavor_ids: i.flavorIds,
          topping_id: i.toppingId || null,
          unit_price: i.unit_price,
          quantity: i.qty,
        }))
      })
      toast.success('Venta registrada')
      setItems([])
      setCashReceived('')
      setTransferAmount('')
      setTransferRef('')
      setPromoId(null)
      setSellerId(null)
      setIsDelivery(false)
    } catch {}
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full max-h-full">

      {/* ── Left: product configurator ── */}
      <div className="flex-1 space-y-4 overflow-y-auto min-w-0">
        <h1>Punto de Venta</h1>

        {/* Seller */}
        <div className="card">
          <label className="label">Vendedora</label>
          <div className="flex gap-2 flex-wrap">
            {operatives.map(o => (
              <button
                key={o.id}
                onClick={() => setSellerId(o.id)}
                className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  sellerId === o.id
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {o.full_name}
              </button>
            ))}
          </div>
        </div>

        {/* Cup sizes */}
        <div className="card">
          <label className="label">Tamaño de Vaso</label>
          <div className="grid grid-cols-4 gap-2">
            {cupSizes.map(c => (
              <button
                key={c.id}
                onClick={() => setCurrentItem(p => ({ ...p, cupSizeId: c.id }))}
                className={`p-3 rounded-xl text-center border-2 font-medium transition-all ${
                  currentItem.cupSizeId === c.id
                    ? 'border-brand-cyan bg-brand-cyan/8 text-brand-navy'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon name="cup" className="w-6 h-6 mx-auto mb-1.5 opacity-70" />
                <div className="font-bold text-sm">{c.size}</div>
                <div className="text-xs text-gray-400 mt-0.5">{fmt(c.price)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Flavors */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <label className="label mb-0">Sabores</label>
            {currentItem.flavorIds.length > 0 && (
              <span className="badge-pink">{currentItem.flavorIds.length} seleccionado{currentItem.flavorIds.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {flavors.map(f => {
              const selected = currentItem.flavorIds.includes(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFlavor(f.id)}
                  className={`p-3 rounded-xl text-center border-2 transition-all text-sm font-medium ${
                    selected
                      ? 'border-brand-pink bg-brand-pink/8 text-brand-pink'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                  style={selected && f.color ? { borderColor: f.color, backgroundColor: `${f.color}12` } : {}}
                >
                  <div
                    className="w-8 h-8 rounded-full mx-auto mb-1.5 border-2 border-white shadow-sm"
                    style={{ background: f.color || '#e5e7eb' }}
                  />
                  <div className="text-xs leading-tight">{f.name}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Topping + qty + add */}
        <div className="card flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-36">
            <label className="label">Topping</label>
            <select
              className="input"
              value={currentItem.toppingId || ''}
              onChange={e => setCurrentItem(p => ({ ...p, toppingId: Number(e.target.value) || null }))}
            >
              <option value="">Sin topping</option>
              {toppings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="label">Cantidad</label>
            <input
              type="number"
              min="1"
              className="input"
              value={currentItem.qty}
              onChange={e => setCurrentItem(p => ({ ...p, qty: Number(e.target.value) }))}
            />
          </div>
          <button onClick={addItem} className="btn-cyan px-5">
            <Icon name="plus" className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* ── Right: order panel ── */}
      <div className="lg:w-80 flex-shrink-0">
        <div className="card h-full flex flex-col">
          <h2 className="text-gray-900 mb-4">Resumen del Pedido</h2>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0 mb-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <Icon name="cup" className="w-10 h-10 mb-2" />
                <p className="text-sm">Sin productos aún</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">x{item.qty} × {fmt(item.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-brand-pink">{fmt(item.unit_price * item.qty)}</span>
                    <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Promotion */}
          <div className="mb-3">
            <label className="label">Promoción</label>
            <select className="input" value={promoId || ''} onChange={e => setPromoId(Number(e.target.value) || null)}>
              <option value="">Sin promoción</option>
              {promotions.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.promo_price)}</option>)}
            </select>
          </div>

          {/* Payment method */}
          <div className="mb-3">
            <label className="label">Medio de Pago</label>
            <div className="flex gap-1.5">
              {PAYMENT_MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === m.key
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon name={m.icon} className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
            <div className="mb-2">
              <label className="label">Efectivo recibido</label>
              <input type="number" className="input" placeholder="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
              {cashReceived && Number(cashReceived) > 0 && (
                <p className="text-xs text-green-600 mt-1 font-semibold">Cambio: {fmt(change)}</p>
              )}
            </div>
          )}

          {(paymentMethod === 'transfer' || paymentMethod === 'mixed') && (
            <div className="mb-2 space-y-2">
              <div>
                <label className="label">Monto transferencia</label>
                <input type="number" className="input" placeholder="0" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Referencia</label>
                <input type="text" className="input" placeholder="# comprobante" value={transferRef} onChange={e => setTransferRef(e.target.value)} />
              </div>
            </div>
          )}

          {/* Delivery toggle */}
          <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDelivery}
              onChange={e => setIsDelivery(e.target.checked)}
              className="w-4 h-4 accent-brand-pink"
            />
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
            <button
              onClick={handleSubmit}
              disabled={submitting || items.length === 0}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="check" className="w-4 h-4" />
              )}
              {submitting ? 'Procesando...' : 'Registrar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
