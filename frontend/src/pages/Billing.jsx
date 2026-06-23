import { useEffect, useState } from 'react'
import { getInvoices, editSale, getAllFlavors, getCupSizes, getToppings, getOperatives } from '../api'
import { Icon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const fmt     = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
const fmtDate = dt => new Date(dt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })

const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
const PAYMENT_BADGE  = { cash: 'badge-gray', transfer: 'badge-cyan', mixed: 'badge-lime' }

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
  const [saving,      setSaving]     = useState(false)

  // Filtros
  const [sellerSearch, setSellerSearch] = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

  // Formulario de edición
  const [eForm, setEForm] = useState({})

  const load = () =>
    getInvoices({ ordering: '-created_at' })
      .then(r => { setInvoices(r.data?.results ?? r.data ?? []); setLoading(false) })

  useEffect(() => {
    load()
    const x = r => r.data?.results ?? r.data ?? []
    Promise.all([getAllFlavors(), getCupSizes(), getToppings(), getOperatives()])
      .then(([f, c, t, o]) => {
        setFlavors(x(f)); setCupSizes(x(c)); setToppings(x(t)); setOperatives(x(o))
      }).catch(() => {})
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
      notes:              s.notes || '',
      seller_id:          s.seller || null,
    })
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...eForm,
        seller_id: eForm.seller_id || null,
      }
      await editSale(selected.sale_detail.id, payload)
      toast.success('Factura actualizada')
      await load()
      // Refrescar el selected con los nuevos datos
      setSelected(null)
      setEditMode(false)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar', { duration: 6000 })
    }
    setSaving(false)
  }

  const sale = selected?.sale_detail

  // Filtrado local
  const filtered = invoices.filter(inv => {
    const name = (inv.sale_detail?.seller_name || '').toLowerCase()
    if (sellerSearch && !name.includes(sellerSearch.toLowerCase())) return false
    if (dateFrom || dateTo) {
      const d = new Date(inv.created_at)
      d.setHours(0, 0, 0, 0)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo   && d > new Date(dateTo))   return false
    }
    return true
  })

  const clearFilters = () => { setSellerSearch(''); setDateFrom(''); setDateTo('') }
  const hasFilters   = sellerSearch || dateFrom || dateTo

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

      <div className="card p-0 overflow-hidden">
        {/* Header */}
        <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
          style={{ gridTemplateColumns: '130px 70px 70px 1fr 110px 90px 90px 80px 50px' }}>
          {['Número', 'Hora', 'Fecha', 'Vendedora', 'Total', 'Canal', 'Pago', 'Estado', ''].map(h => <span key={h}>{h}</span>)}
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
              style={{ gridTemplateColumns: '130px 70px 70px 1fr 110px 90px 90px 80px 50px' }}>
              <span className="font-mono font-semibold text-brand-navy text-sm">{inv.invoice_number}</span>
              <span className="text-sm tabular-nums text-gray-500">{fmtTime(inv.created_at)}</span>
              <span className="text-sm tabular-nums text-gray-400">{fmtDate(inv.created_at)}</span>
              <span className="text-sm text-gray-700">{inv.sale_detail?.seller_name || '—'}</span>
              <span className="tabular-nums">
                <span className="text-sm font-bold text-brand-pink">
                  {fmt(inv.sale_detail?.is_courtesy ? (inv.sale_detail?.courtesy_paid || 0) : (inv.sale_detail?.total || 0))}
                </span>
                {inv.sale_detail?.is_courtesy && (
                  <span className="block text-[10px] text-gray-400 leading-none">factura {fmt(inv.sale_detail?.total || 0)}</span>
                )}
              </span>
              <span className={`badge text-xs w-fit ${
                inv.sale_detail?.is_courtesy ? 'bg-pink-100 text-pink-600' :
                inv.sale_detail?.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                {inv.sale_detail?.is_courtesy ? 'Cortesía' :
                 inv.sale_detail?.is_delivery ? 'Domicilio' : 'POS'}
              </span>
              <span className={`badge text-xs w-fit ${PAYMENT_BADGE[inv.sale_detail?.payment_method] ?? 'badge-gray'}`}>
                {PAYMENT_LABELS[inv.sale_detail?.payment_method] ?? inv.sale_detail?.payment_method}
              </span>
              <span className={`badge text-xs w-fit ${inv.voided ? 'badge-pink' : 'badge-lime'}`}>
                {inv.voided ? 'Anulada' : 'Válida'}
              </span>
              <Icon name="chevronRight" className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal detalle / edición ── */}
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
                {!selected.voided && !editMode && (
                  <button onClick={() => setEditMode(true)} className="btn-secondary py-1.5 text-xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar
                  </button>
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
                          {item.flavors_detail?.map(f => f.name).join(' + ')}
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
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Editar pago e info</p>

                  <div>
                    <label className="label">Vendedora</label>
                    <select className="input" value={eForm.seller_id}
                      onChange={e => setEForm(f => ({ ...f, seller_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {operatives.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                    </select>
                  </div>

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

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_delivery" checked={eForm.is_delivery}
                      onChange={e => setEForm(f => ({ ...f, is_delivery: e.target.checked }))}
                      className="w-4 h-4 accent-brand-pink" />
                    <label htmlFor="is_delivery" className="text-sm text-gray-600 cursor-pointer">Es domicilio</label>
                  </div>

                  <div>
                    <label className="label">Notas</label>
                    <input className="input" value={eForm.notes}
                      onChange={e => setEForm(f => ({ ...f, notes: e.target.value }))} />
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
                    <p className="font-medium text-gray-800">{sale.seller_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Método de pago</p>
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
                    <span className={`badge ${sale.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                      {sale.is_delivery ? 'Domicilio' : 'Punto de Venta'}
                    </span>
                  </div>
                  {sale.notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-0.5">Notas</p>
                      <p className="text-gray-600">{sale.notes}</p>
                    </div>
                  )}
                  {sale.is_courtesy && (
                    <div className="col-span-2 p-3 bg-pink-50 border border-pink-100 rounded-xl space-y-1">
                      <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide">Cortesía</p>
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
