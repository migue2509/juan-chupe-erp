import { useEffect, useState } from 'react'
import { getInvoices, editSale, voidInvoice, getAllFlavors, getCupSizes, getToppings, getOperatives, getShifts, getActivePromotions } from '../api'
import { Icon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const fmt     = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
const fmtDate = dt => new Date(dt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })

const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
const PAYMENT_BADGE  = { cash: 'badge-gray', transfer: 'badge-cyan', mixed: 'badge-lime' }

const FLAVOR_CATS = [
  { value: 'creamy',        label: 'Cremosos',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'refreshing',    label: 'Refrescantes', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'non_alcoholic', label: 'Sin Alcohol',  cls: 'bg-green-50 text-green-700 border-green-200' },
]

const emptyItem = () => ({ cup_size_id: null, flavor_ids: [], topping_id: null, unit_price: 0, quantity: 1 })

const PAYMENT_MODES = [
  { key: 'cash',     label: 'Efectivo' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'mixed',    label: 'Mixto' },
]

export default function Billing() {
  const { isAdmin } = useAuth()
  const [invoices,    setInvoices]   = useState([])
  const [loading,     setLoading]    = useState(true)
  const [selected,    setSelected]   = useState(null)
  const [editMode,    setEditMode]   = useState(false)
  const [flavors,     setFlavors]    = useState([])
  const [cupSizes,    setCupSizes]   = useState([])
  const [toppings,    setToppings]   = useState([])
  const [operatives,  setOperatives] = useState([])
  const [promotions,  setPromotions] = useState([])
  const [saving,      setSaving]     = useState(false)
  const [voidModal,   setVoidModal]  = useState(false)
  const [voidReason,  setVoidReason] = useState('')
  const [voiding,     setVoiding]    = useState(false)

  // Estado promo configurator (edit mode)
  const [ePromoConfig, setEPromoConfig] = useState(null) // { promo, activeCup, cups:[{flavorIds:[]}] }
  const [ePromoId,     setEPromoId]     = useState(null)

  // Filtros
  const [sellerSearch, setSellerSearch] = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [shiftFilter,  setShiftFilter]  = useState('all')
  const [shifts,       setShifts]       = useState([])

  // Formulario de edición
  const [eForm,  setEForm]  = useState({})
  const [eItems, setEItems] = useState([])  // items editables

  const load = () =>
    getInvoices({ ordering: '-created_at' })
      .then(r => { setInvoices(r.data?.results ?? r.data ?? []); setLoading(false) })

  useEffect(() => {
    load()
    const x = r => r.data?.results ?? r.data ?? []
    Promise.all([getAllFlavors(), getCupSizes(), getToppings(), getOperatives(), getShifts(), getActivePromotions()])
      .then(([f, c, t, o, s, p]) => {
        setFlavors(x(f)); setCupSizes(x(c)); setToppings(x(t)); setOperatives(x(o))
        setShifts((x(s)).sort((a, b) => b.id - a.id))
        setPromotions(x(p))
      }).catch(() => {})
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const openDetail = (inv) => {
    setSelected(inv)
    setEditMode(false)
    const s = inv.sale_detail
    setEForm({
      payment_method:     s.payment_method,
      cash_received:      s.cash_received,
      transfer_amount:    s.transfer_amount,
      transfer_reference: s.transfer_reference || '',
      is_delivery:        s.is_delivery,
      is_courtesy:        s.is_courtesy || false,
      courtesy_paid:      s.courtesy_paid || '',
      courtesy_method:    s.payment_method === 'transfer' ? 'transfer' : 'cash',
      delivery_address:   '',
      delivery_client:    '',
      delivery_notes:     '',
      notes:              s.notes || '',
      seller_id:          s.seller || null,
    })
    setEItems((s.items ?? []).map(item => ({
      cup_size_id: item.cup_size,
      flavor_ids:  (item.flavors_detail ?? []).map(f => f.id),
      topping_id:  item.topping || null,
      unit_price:  Number(item.unit_price),
      quantity:    item.quantity,
    })))
    setEPromoId(s.promotion || null)
    setEPromoConfig(null)
  }

  // ── Helpers items editables ──
  const updateItem   = (i, patch) => setEItems(its => its.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  const removeItem   = (i)        => setEItems(its => its.filter((_, idx) => idx !== i))
  const addItem      = ()         => setEItems(its => [...its, emptyItem()])
  const toggleFlavor = (i, fid)   => updateItem(i, {
    flavor_ids: eItems[i].flavor_ids.includes(fid)
      ? eItems[i].flavor_ids.filter(x => x !== fid)
      : [...eItems[i].flavor_ids, fid]
  })

  // ── Helpers promo (edit mode) ──
  const startEPromo = (promo) => {
    setEPromoConfig({
      promo, activeCup: 0,
      cups: Array.from({ length: promo.quantity_included }, () => ({ flavorIds: [] })),
    })
    setEPromoId(promo.id)
  }
  const cancelEPromo = () => { setEPromoConfig(null); setEPromoId(null) }
  const toggleEPromoFlavor = (fid) => {
    setEPromoConfig(p => {
      const cups = p.cups.map((c, i) => {
        if (i !== p.activeCup) return c
        const has = c.flavorIds.includes(fid)
        return { ...c, flavorIds: has ? c.flavorIds.filter(f => f !== fid) : [...c.flavorIds, fid] }
      })
      return { ...p, cups }
    })
  }
  const addEPromoItems = () => {
    const { promo, cups } = ePromoConfig
    if (cups.some(c => c.flavorIds.length === 0)) { toast.error('Cada vaso necesita al menos un sabor'); return }
    const newItems = cups.map(cup => ({
      cup_size_id: promo.cup_size,
      flavor_ids:  cup.flavorIds,
      topping_id:  null,
      unit_price:  Number(promo.unit_price),
      quantity:    1,
      _promoName:  promo.name,
    }))
    setEItems(its => [...its, ...newItems])
    setEPromoConfig(null)
    toast.success(`${promo.name} agregada`)
  }

  const handlePaymentChange = (method) => {
    const total = Number(sale?.total || 0)
    setEForm(f => ({
      ...f,
      payment_method:  method,
      cash_received:   method === 'transfer' ? '0' : method === 'cash' ? String(total) : f.cash_received,
      transfer_amount: method === 'cash'     ? '0' : method === 'transfer' ? String(total) : f.transfer_amount,
    }))
  }

  const handleVoid = async () => {
    setVoiding(true)
    try {
      await voidInvoice(selected.id, { reason: voidReason })
      toast.success('Factura anulada — inventario restaurado')
      await load()
      setSelected(null)
      setVoidModal(false)
      setVoidReason('')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al anular', { duration: 6000 })
    }
    setVoiding(false)
  }

  const handleSave = async () => {
    if (eItems.length === 0) { toast.error('Debe haber al menos un producto'); return }
    for (const [i, it] of eItems.entries()) {
      if (!it.cup_size_id) { toast.error(`Item ${i + 1}: elige un tamaño de vaso`); return }
      if (it.flavor_ids.length === 0) { toast.error(`Item ${i + 1}: elige al menos un sabor`); return }
    }
    setSaving(true)
    try {
      const payload = {
        seller_id:          eForm.seller_id || null,
        payment_method:     eForm.is_courtesy ? eForm.courtesy_method : eForm.payment_method,
        cash_received:      eForm.is_courtesy
          ? (eForm.courtesy_method === 'cash'     ? Number(eForm.courtesy_paid || 0) : 0)
          : Number(eForm.cash_received || 0),
        transfer_amount:    eForm.is_courtesy
          ? (eForm.courtesy_method === 'transfer' ? Number(eForm.courtesy_paid || 0) : 0)
          : Number(eForm.transfer_amount || 0),
        transfer_reference: eForm.transfer_reference || '',
        is_delivery:        eForm.is_delivery,
        is_courtesy:        eForm.is_courtesy,
        courtesy_paid:      Number(eForm.courtesy_paid || 0),
        notes:              eForm.notes || '',
        promotion_id:       ePromoId || null,
        items: eItems.map(it => ({
          cup_size_id: Number(it.cup_size_id),
          flavor_ids:  it.flavor_ids.map(Number),
          topping_id:  it.topping_id ? Number(it.topping_id) : null,
          unit_price:  Number(it.unit_price),
          quantity:    Number(it.quantity || 1),
        })),
      }
      await editSale(selected.sale_detail.id, payload)
      toast.success('Factura actualizada')
      await load()
      setSelected(null)
      setEditMode(false)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar', { duration: 6000 })
    }
    setSaving(false)
  }

  const editTotal = eItems.reduce((sum, it) => {
    const top = it.topping_id ? toppings.find(t => t.id === Number(it.topping_id)) : null
    return sum + (Number(it.unit_price) + (top ? Number(top.price) : 0)) * Number(it.quantity || 1)
  }, 0)

  const sale = selected?.sale_detail

  // Filtrado local
  const filtered = invoices.filter(inv => {
    const name = (inv.sale_detail?.seller_name || '').toLowerCase()
    if (sellerSearch && !name.includes(sellerSearch.toLowerCase())) return false
    if (shiftFilter !== 'all' && inv.shift !== Number(shiftFilter)) return false
    if (dateFrom || dateTo) {
      const d = new Date(inv.created_at)
      d.setHours(0, 0, 0, 0)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo   && d > new Date(dateTo))   return false
    }
    return true
  })

  const clearFilters = () => { setSellerSearch(''); setDateFrom(''); setDateTo(''); setShiftFilter('all') }
  const hasFilters   = sellerSearch || dateFrom || dateTo || shiftFilter !== 'all'

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      <div>
        <h1>Facturas</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {filtered.length} de {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtros */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Icon name="search" className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="input py-1.5 text-sm flex-1"
            placeholder="Buscar vendedora..."
            value={sellerSearch}
            onChange={e => setSellerSearch(e.target.value)}
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

      <div className="card p-0 overflow-hidden overflow-x-auto">
        {/* Header */}
        <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
          style={{ gridTemplateColumns: '130px 70px 70px 90px minmax(0,1fr) 110px 90px 90px 80px 50px', minWidth: '1200px' }}>
          {['Número', 'Hora', 'Fecha', 'Jornada', 'Vendedora', 'Total', 'Canal', 'Pago', 'Estado', ''].map(h => <span key={h}>{h}</span>)}
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-300">
              <Icon name="billing" className="w-8 h-8 mb-2" />
              <p className="text-sm">{hasFilters ? 'Sin resultados' : 'Sin facturas'}</p>
            </div>
          ) : filtered.map(inv => (
            <div key={inv.id}
              onClick={() => openDetail(inv)}
              className="grid px-5 py-3.5 items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: '130px 70px 70px 90px minmax(0,1fr) 110px 90px 90px 80px 50px', minWidth: '1200px' }}>
              <span className="font-mono font-semibold text-brand-navy text-sm">{inv.invoice_number}</span>
              <span className="text-sm tabular-nums text-gray-500">{fmtTime(inv.created_at)}</span>
              <span className="text-sm tabular-nums text-gray-400">{fmtDate(inv.created_at)}</span>
              <span className="text-xs font-medium text-brand-navy bg-blue-50 px-2 py-0.5 rounded-full">{inv.shift_label}</span>
              <span className="text-sm text-gray-700">{inv.sale_detail?.seller_name || '—'}</span>
              <span className="tabular-nums">
                <span className="text-sm font-bold text-brand-pink">
                  {fmt(inv.sale_detail?.is_courtesy ? (inv.sale_detail?.courtesy_paid || 0) : (inv.sale_detail?.total || 0))}
                </span>
                {inv.sale_detail?.is_courtesy && (
                  <span className="block text-[10px] text-gray-400 leading-none">factura {fmt(inv.sale_detail?.total || 0)}</span>
                )}
              </span>
              {inv.sale_detail?.promotion_category === 'rappi' ? (
                <span className="badge text-xs w-fit text-white" style={{ background: '#FF424D' }}>Rappi</span>
              ) : inv.sale_detail?.promotion_category === 'didi' ? (
                <span className="badge text-xs w-fit text-white" style={{ background: '#FF6600' }}>DiDi</span>
              ) : (
                <span className={`badge text-xs w-fit ${
                  inv.sale_detail?.is_courtesy ? 'bg-pink-100 text-pink-600' :
                  inv.sale_detail?.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                  {inv.sale_detail?.is_courtesy ? 'Cortesía' :
                   inv.sale_detail?.is_delivery ? 'Domicilio' : 'POS'}
                </span>
              )}
              <span className={`badge text-xs w-fit ${PAYMENT_BADGE[inv.sale_detail?.payment_method] ?? 'badge-gray'}`}>
                {PAYMENT_LABELS[inv.sale_detail?.payment_method] ?? inv.sale_detail?.payment_method}
              </span>
              <span className={`badge text-xs w-fit ${inv.voided ? 'badge-pink' : 'badge-lime'}`}>
                {inv.voided
                  ? (inv.void_reason?.includes('Domicilio cancelado') ? 'Cancelada' : 'Anulada')
                  : 'Válida'}
              </span>
              <Icon name="chevronRight" className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal detalle / edición ── */}
      {/* ── Modal confirmación de anulación ── */}
      {voidModal && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Anular {selected.invoice_number}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  El inventario se restaurará automáticamente. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div>
              <label className="label text-xs">Motivo de anulación</label>
              <input
                className="input text-sm"
                placeholder="Ej: Error en los productos registrados"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleVoid}
                disabled={voiding || !voidReason.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                {voiding && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirmar anulación
              </button>
              <button
                onClick={() => setVoidModal(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && sale && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">{selected.invoice_number}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(selected.created_at)} · {fmtTime(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {!selected.voided && !editMode && isAdmin && (
                  <>
                    <button onClick={() => setEditMode(true)} className="btn-secondary py-1.5 text-xs">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Editar
                    </button>
                    <button onClick={() => { setVoidReason(''); setVoidModal(true) }}
                      className="py-1.5 px-3 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      Anular
                    </button>
                  </>
                )}
                <button onClick={() => { setSelected(null); setEditMode(false) }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Items de la venta */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Productos</p>
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                  {sale.items?.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Sin items</p>
                  ) : sale.items?.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {item.cup_size_label || item.topping_name || 'Topping'}
                          {item.quantity > 1 && <span className="text-gray-400"> ×{item.quantity}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.flavors_detail?.map(f => {
                            const fl = flavors.find(x => x.id === f.id)
                            return (fl?.emoji ? fl.emoji + ' ' : '') + f.name
                          }).join(' + ')}
                          {item.cup_size_label && item.topping_name && ` · ${item.topping_name}`}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{fmt(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campos editables o solo vista */}
              {editMode ? (
                <div className="space-y-5">

                  {/* ── Items ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Productos</p>
                      <button type="button" onClick={addItem}
                        className="flex items-center gap-1 text-xs text-brand-pink font-medium hover:underline">
                        <Icon name="plus" className="w-3.5 h-3.5" /> Agregar item
                      </button>
                    </div>

                    {/* Selector de promociones */}
                    {promotions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-1">
                        {promotions.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => ePromoConfig?.promo?.id === p.id ? cancelEPromo() : startEPromo(p)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                              ePromoConfig?.promo?.id === p.id
                                ? 'border-brand-pink bg-pink-50 text-brand-pink'
                                : 'border-gray-200 text-gray-600 hover:border-brand-pink/40'
                            }`}>
                            <span className="font-bold">{p.name}</span>
                            <span className="text-xs text-gray-400">{p.quantity_included}×{p.cup_size_label}</span>
                            <span className="font-bold text-brand-pink">{fmt(p.promo_price)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Configurador promo */}
                    {ePromoConfig && (
                      <div className="border-2 border-brand-pink/30 rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-brand-navy text-sm">{ePromoConfig.promo.name}</p>
                          <button onClick={cancelEPromo} className="text-gray-300 hover:text-red-400">
                            <Icon name="x" className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Tabs vaso */}
                        <div className="flex gap-2">
                          {ePromoConfig.cups.map((cup, i) => (
                            <button key={i} type="button"
                              onClick={() => setEPromoConfig(p => ({ ...p, activeCup: i }))}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                ePromoConfig.activeCup === i
                                  ? 'border-brand-navy bg-brand-navy text-white'
                                  : cup.flavorIds.length > 0
                                    ? 'border-green-300 bg-green-50 text-green-700'
                                    : 'border-gray-200 text-gray-500'
                              }`}>
                              Vaso {i + 1}
                              {cup.flavorIds.length > 0 && ePromoConfig.activeCup !== i && (
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                        {/* Sabores */}
                        <div className="space-y-2">
                          {FLAVOR_CATS.map(cat => {
                            const catFlavors = flavors.filter(f => f.category === cat.value && f.is_active)
                            if (!catFlavors.length) return null
                            return (
                              <div key={cat.value}>
                                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1 ${cat.cls}`}>{cat.label}</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {catFlavors.map(f => {
                                    const sel = ePromoConfig.cups[ePromoConfig.activeCup]?.flavorIds.includes(f.id)
                                    return (
                                      <button key={f.id} type="button" onClick={() => toggleEPromoFlavor(f.id)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                          sel ? 'border-brand-pink bg-pink-50 text-brand-pink' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}>
                                        <span>{f.emoji || '🍧'}</span>{f.name}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Avanzar / agregar */}
                        <div className="flex justify-end">
                          {ePromoConfig.activeCup < ePromoConfig.cups.length - 1 ? (
                            <button type="button"
                              onClick={() => ePromoConfig.cups[ePromoConfig.activeCup].flavorIds.length > 0
                                ? setEPromoConfig(p => ({ ...p, activeCup: p.activeCup + 1 }))
                                : toast.error('Elige al menos un sabor')}
                              className="btn-secondary text-xs py-1.5">
                              Vaso {ePromoConfig.activeCup + 2} →
                            </button>
                          ) : (
                            <button type="button" onClick={addEPromoItems}
                              className="btn-primary text-xs py-1.5">
                              <Icon name="plus" className="w-3.5 h-3.5" /> Agregar promo
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {eItems.map((item, i) => {
                        const selCup = cupSizes.find(c => c.id === Number(item.cup_size_id))
                        return (
                          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                            {/* Cabecera item */}
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-gray-100">
                              <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <label className="text-xs text-gray-400">Cant.</label>
                                  <input type="number" min="1" className="input py-0.5 text-xs w-14 text-center"
                                    value={item.quantity}
                                    onChange={e => updateItem(i, { quantity: Number(e.target.value) })} />
                                </div>
                                {eItems.length > 1 && (
                                  <button onClick={() => removeItem(i)}
                                    className="text-gray-300 hover:text-red-400 transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="p-3 space-y-3">
                              {/* Tamaño de vaso */}
                              <div>
                                <label className="label text-[11px]">Tamaño</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {cupSizes.filter(c => c.is_active).map(c => (
                                    <button key={c.id} type="button"
                                      onClick={() => updateItem(i, { cup_size_id: c.id, unit_price: Number(c.price) })}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                        item.cup_size_id === c.id
                                          ? 'border-brand-cyan bg-cyan-50 text-brand-navy'
                                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                      }`}>
                                      {c.size} <span className="text-gray-400 ml-1">{fmt(c.price)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Sabores */}
                              <div>
                                <label className="label text-[11px]">
                                  Sabores
                                  {item.flavor_ids.length > 0 && (
                                    <span className="ml-1.5 text-brand-pink font-semibold">{item.flavor_ids.length} seleccionado{item.flavor_ids.length > 1 ? 's' : ''}</span>
                                  )}
                                </label>
                                <div className="space-y-2">
                                  {FLAVOR_CATS.map(cat => {
                                    const catFlavors = flavors.filter(f => f.category === cat.value && f.is_active)
                                    if (!catFlavors.length) return null
                                    return (
                                      <div key={cat.value}>
                                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1 ${cat.cls}`}>
                                          {cat.label}
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {catFlavors.map(f => {
                                            const sel = item.flavor_ids.includes(f.id)
                                            return (
                                              <button key={f.id} type="button"
                                                onClick={() => toggleFlavor(i, f.id)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                  sel
                                                    ? 'border-brand-pink bg-pink-50 text-brand-pink'
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}>
                                                <span>{f.emoji || '🍧'}</span>
                                                {f.name}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Topping + precio */}
                              <div className="flex items-end gap-3">
                                <div className="flex-1">
                                  <label className="label text-[11px]">Topping (opcional)</label>
                                  <select className="input text-sm py-1.5"
                                    value={item.topping_id ?? ''}
                                    onChange={e => updateItem(i, { topping_id: e.target.value ? Number(e.target.value) : null })}>
                                    <option value="">Sin topping</option>
                                    {toppings.filter(t => t.is_active).map(t => (
                                      <option key={t.id} value={t.id}>{t.name} (+{fmt(t.price)})</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="w-28">
                                  <label className="label text-[11px]">Precio unitario</label>
                                  <input type="number" className="input text-sm py-1.5"
                                    value={item.unit_price}
                                    onChange={e => updateItem(i, { unit_price: Number(e.target.value) })} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Total calculado */}
                    <div className="flex justify-between items-center mt-3 px-1">
                      <span className="text-sm text-gray-500">Total calculado</span>
                      <span className="text-lg font-bold text-brand-pink">{fmt(editTotal)}</span>
                    </div>
                  </div>

                  {/* ── Pago e info ── */}
                  <div className="space-y-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Pago e información</p>

                    {/* Vendedora */}
                    <div>
                      <label className="label">Vendedora</label>
                      <select className="input" value={eForm.seller_id ?? ''}
                        onChange={e => setEForm(f => ({ ...f, seller_id: e.target.value }))}>
                        <option value="">Sin asignar</option>
                        {operatives.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                      </select>
                    </div>

                    {/* Método de pago (solo visible si NO es cortesía) */}
                    {!eForm.is_courtesy && (
                      <>
                        <div>
                          <label className="label">Método de pago</label>
                          <div className="flex gap-2">
                            {PAYMENT_MODES.map(m => (
                              <button key={m.key} type="button"
                                onClick={() => handlePaymentChange(m.key)}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                                  eForm.payment_method === m.key
                                    ? 'border-brand-navy bg-brand-navy text-white'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(eForm.payment_method === 'cash' || eForm.payment_method === 'mixed') && (
                          <div>
                            <label className="label">Efectivo recibido</label>
                            <input type="number" className="input" value={eForm.cash_received}
                              onChange={e => setEForm(f => ({ ...f, cash_received: e.target.value }))} />
                          </div>
                        )}
                        {(eForm.payment_method === 'transfer' || eForm.payment_method === 'mixed') && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label">Monto transferencia</label>
                              <input type="number" className="input" value={eForm.transfer_amount}
                                onChange={e => setEForm(f => ({ ...f, transfer_amount: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label">Referencia</label>
                              <input className="input" value={eForm.transfer_reference}
                                onChange={e => setEForm(f => ({ ...f, transfer_reference: e.target.value }))} />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Domicilio */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={eForm.is_delivery}
                          onChange={e => setEForm(f => ({ ...f, is_delivery: e.target.checked }))}
                          className="w-4 h-4 accent-brand-pink" />
                        <span className="text-sm text-gray-600 flex items-center gap-1.5">
                          <Icon name="bike" className="w-4 h-4 text-gray-400" />
                          Es domicilio
                        </span>
                      </label>
                      {eForm.is_delivery && (
                        <div className="mt-2 space-y-2 p-3 bg-cyan-50 border border-cyan-100 rounded-xl">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="label">Dirección</label>
                              <input className="input text-sm" placeholder="Calle, barrio..."
                                value={eForm.delivery_address}
                                onChange={e => setEForm(f => ({ ...f, delivery_address: e.target.value }))} />
                            </div>
                            <div className="w-28">
                              <label className="label">Cliente</label>
                              <input className="input text-sm" placeholder="Nombre..."
                                value={eForm.delivery_client}
                                onChange={e => setEForm(f => ({ ...f, delivery_client: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <label className="label">Notas del pedido</label>
                            <input className="input text-sm" placeholder="Indicaciones adicionales..."
                              value={eForm.delivery_notes}
                              onChange={e => setEForm(f => ({ ...f, delivery_notes: e.target.value }))} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cortesía */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={eForm.is_courtesy}
                          onChange={e => setEForm(f => ({ ...f, is_courtesy: e.target.checked, courtesy_paid: '' }))}
                          className="w-4 h-4 accent-brand-pink" />
                        <span className="text-sm text-gray-600 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                          Es cortesía
                        </span>
                      </label>
                      {eForm.is_courtesy && (
                        <div className="mt-2 p-3 bg-pink-50 border border-pink-100 rounded-xl space-y-2">
                          <p className="text-xs text-pink-600 font-medium">
                            La diferencia entre el total y lo recibido se registra como gasto.
                          </p>
                          <div className="flex gap-2">
                            {[{ k: 'cash', l: 'Efectivo' }, { k: 'transfer', l: 'Transferencia' }].map(m => (
                              <button key={m.k} type="button"
                                onClick={() => setEForm(f => ({ ...f, courtesy_method: m.k }))}
                                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                  eForm.courtesy_method === m.k
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
                              value={eForm.courtesy_paid}
                              onChange={e => setEForm(f => ({ ...f, courtesy_paid: e.target.value }))} />
                          </div>
                          {editTotal > 0 && (
                            <div className="flex justify-between text-xs pt-1">
                              <span className="text-gray-500">Gasto que se generará:</span>
                              <span className="font-bold text-red-500">
                                {fmt(Math.max(0, editTotal - Number(eForm.courtesy_paid || 0)))}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="label">Notas</label>
                      <input className="input" value={eForm.notes}
                        onChange={e => setEForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                      {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Guardar cambios
                    </button>
                    <button onClick={() => setEditMode(false)} className="btn-secondary flex-1">Cancelar</button>
                  </div>
                </div>
              ) : (
                /* Vista solo lectura */
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Vendedora</p>
                    <p className="font-medium text-gray-800">{sale.seller_name || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">M\u00e9todo de pago</p>
                    <span className={`badge ${PAYMENT_BADGE[sale.payment_method] ?? 'badge-gray'}`}>
                      {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                    </span>
                  </div>
                  {sale.cash_received > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Efectivo recibido</p>
                      <p className="font-medium">{fmt(sale.cash_received)}</p>
                    </div>
                  )}
                  {sale.transfer_amount > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Transferencia</p>
                      <p className="font-medium">{fmt(sale.transfer_amount)}</p>
                    </div>
                  )}
                  {sale.change_given > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Cambio entregado</p>
                      <p className="font-medium text-green-600">{fmt(sale.change_given)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Canal</p>
                    {sale.promotion_category === 'rappi' ? (
                      <span className="badge" style={{ background: '#FF424D', color: '#fff' }}>Rappi</span>
                    ) : sale.promotion_category === 'didi' ? (
                      <span className="badge" style={{ background: '#FF6600', color: '#fff' }}>DiDi</span>
                    ) : (
                      <span className={`badge ${sale.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                        {sale.is_delivery ? 'Domicilio' : 'Punto de Venta'}
                      </span>
                    )}
                  </div>
                  {sale.notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-0.5">Notas</p>
                      <p className="text-gray-600">{sale.notes}</p>
                    </div>
                  )}
                  {sale.is_courtesy && (
                    <div className="col-span-2 p-3 bg-pink-50 border border-pink-100 rounded-xl space-y-1">
                      <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide">Cortes\u00eda</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Valor de la factura</span>
                        <span className="font-medium text-gray-700">{fmt(sale.total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Dinero recibido</span>
                        <span className="font-medium text-green-600">{fmt(sale.courtesy_paid || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-pink-100 pt-1">
                        <span className="text-gray-500">Gasto generado</span>
                        <span className="font-bold text-red-500">{fmt(Number(sale.total) - Number(sale.courtesy_paid || 0))}</span>
                      </div>
                    </div>
                  )}
                  {selected.voided && (
                    <div className="col-span-2 p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Factura Anulada</p>
                      {selected.void_reason && (
                        <p className="text-sm text-gray-600">Motivo: {selected.void_reason}</p>
                      )}
                      {selected.voided_by_name && (
                        <p className="text-xs text-gray-400">Anulada por: {selected.voided_by_name}</p>
                      )}
                    </div>
                  )}
                  <div className="col-span-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-500">
                      {sale.is_courtesy ? 'Recibido' : 'Total'}
                    </span>
                    <span className="text-xl font-bold text-brand-pink">
                      {fmt(sale.is_courtesy ? (sale.courtesy_paid || 0) : sale.total)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
