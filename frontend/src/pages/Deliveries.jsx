import { useEffect, useState } from 'react'
import { getDeliveries, updateDelivery } from '../api'
import { getDeliveryPeople } from '../api/auth'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

const fmt     = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
const fmtDate = dt => new Date(dt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700',  next: 'on_way',    nextLabel: 'Enviar' },
  on_way:    { label: 'En camino',  cls: 'bg-cyan-100 text-cyan-700',    next: 'delivered', nextLabel: 'Entregado' },
  delivered: { label: 'Entregado', cls: 'bg-green-100 text-green-700',  next: null,        nextLabel: null },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-600',      next: null,        nextLabel: null },
}

const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
const PAYMENT_BADGE  = { cash: 'bg-gray-100 text-gray-600', transfer: 'bg-cyan-100 text-cyan-700', mixed: 'bg-lime-100 text-lime-700' }

export default function Deliveries() {
  const [deliveries,     setDeliveries]     = useState([])
  const [deliveryPeople, setDeliveryPeople] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [selected,       setSelected]       = useState(null)  // domicilio expandido

  const load = async () => {
    try {
      const [dRes, pRes] = await Promise.all([getDeliveries(), getDeliveryPeople()])
      setDeliveries(dRes.data?.results ?? dRes.data ?? [])
      setDeliveryPeople(pRes.data?.results ?? pRes.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const advanceStatus = async (d) => {
    const next = STATUS[d.status]?.next
    if (!next) return
    try {
      const patch = { status: next }
      if (next === 'delivered') patch.delivered_at = new Date().toISOString()
      await updateDelivery(d.id, patch)
      toast.success(`Estado → ${STATUS[next].label}`)
      load()
    } catch { toast.error('Error al actualizar estado') }
  }

  const cancelDelivery = async (d) => {
    if (!confirm('¿Cancelar este domicilio?')) return
    try {
      await updateDelivery(d.id, { status: 'cancelled' })
      toast.success('Domicilio cancelado')
      load()
    } catch { toast.error('Error') }
  }

  const assignPerson = async (deliveryId, personId) => {
    try {
      await updateDelivery(deliveryId, { delivery_person: personId || null })
      toast.success('Domiciliario asignado')
      load()
    } catch { toast.error('Error al asignar') }
  }

  const filtered = statusFilter === 'all'
    ? deliveries
    : deliveries.filter(d => d.status === statusFilter)

  const counts = Object.keys(STATUS).reduce((acc, k) => {
    acc[k] = deliveries.filter(d => d.status === k).length
    return acc
  }, {})

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Domicilios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{deliveries.length} pedido{deliveries.length !== 1 ? 's' : ''} hoy</p>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(STATUS).map(([key, s]) => (
          <button key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`card py-3 text-left transition-all border-2 ${statusFilter === key ? 'border-brand-navy' : 'border-transparent'}`}>
            <p className="text-2xl font-bold text-gray-900">{counts[key] ?? 0}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Tabla domicilios */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2>Pedidos</h2>
            <select className="input py-1.5 text-xs w-36" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Header tabla */}
          <div className="grid px-4 py-2.5 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-2"
            style={{ gridTemplateColumns: '50px 70px 55px 1fr 90px 90px 110px 80px' }}>
            {['#', 'Hora', '4 díg.', 'Dirección', 'Total', 'Pago', 'Domiciliario', 'Estado'].map(h => <span key={h}>{h}</span>)}
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                <Icon name="bike" className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin domicilios</p>
              </div>
            ) : filtered.map(d => {
              const s = STATUS[d.status] ?? STATUS.pending
              const sale = d.sale_detail
              return (
                <div key={d.id}>
                  <div
                    onClick={() => setSelected(selected?.id === d.id ? null : d)}
                    className="grid px-4 py-3 items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: '50px 70px 55px 1fr 90px 90px 110px 80px' }}>
                    <span className="font-mono text-xs font-bold text-brand-navy">#{d.id}</span>
                    <span className="text-xs tabular-nums text-gray-500">{fmtTime(d.created_at)}</span>
                    <span className="font-mono text-sm font-bold text-gray-700">{d.four_digits || '—'}</span>
                    <span className="text-sm text-gray-800 truncate">{d.address}</span>
                    <span className="text-sm font-semibold text-brand-pink tabular-nums">{fmt(sale?.total || 0)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${PAYMENT_BADGE[sale?.payment_method] ?? 'bg-gray-100 text-gray-500'}`}>
                      {PAYMENT_LABELS[sale?.payment_method] ?? '—'}
                    </span>
                    <select
                      className="input py-1 text-xs"
                      value={d.delivery_person || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => assignPerson(d.id, e.target.value)}>
                      <option value="">Sin asignar</option>
                      {deliveryPeople.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${s.cls}`}>{s.label}</span>
                  </div>

                  {/* Detalle expandido */}
                  {selected?.id === d.id && (
                    <div className="px-4 pb-4 pt-1 bg-blue-50 border-t border-blue-100 space-y-3">
                      {/* Pedido */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Pedido</p>
                        <div className="space-y-1">
                          {sale?.items?.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {item.cup_size_label || item.topping_name || 'Topping'}
                                {item.flavors_detail?.length > 0 && ` — ${item.flavors_detail.map(f => f.name).join(' + ')}`}
                                {item.quantity > 1 && <span className="text-gray-400"> ×{item.quantity}</span>}
                              </span>
                              <span className="font-semibold text-gray-800">{fmt(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pago */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {sale?.cash_received > 0 && (
                          <div><p className="text-xs text-gray-400">Efectivo recibido</p><p className="font-semibold">{fmt(sale.cash_received)}</p></div>
                        )}
                        {sale?.transfer_amount > 0 && (
                          <div><p className="text-xs text-gray-400">Transferencia</p><p className="font-semibold">{fmt(sale.transfer_amount)}</p></div>
                        )}
                        {sale?.change_given > 0 && (
                          <div><p className="text-xs text-gray-400">Cambio</p><p className="font-semibold text-green-600">{fmt(sale.change_given)}</p></div>
                        )}
                      </div>

                      {/* Notas */}
                      {d.notes && (
                        <p className="text-xs text-gray-500 italic">📝 {d.notes}</p>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2">
                        {s.next && (
                          <button onClick={() => advanceStatus(d)} className="btn-primary py-1.5 text-xs">
                            {s.nextLabel}
                          </button>
                        )}
                        {d.status !== 'cancelled' && d.status !== 'delivered' && (
                          <button onClick={() => cancelDelivery(d)} className="btn-secondary py-1.5 text-xs text-red-500">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel domiciliarios */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Icon name="bike" className="w-4 h-4 text-brand-cyan" />
            <h2>Domiciliarios</h2>
            <span className="badge-gray ml-auto">{deliveryPeople.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {deliveryPeople.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300 px-5">
                <p className="text-sm text-center">Sin domiciliarios activos.</p>
                <p className="text-xs text-center mt-1">Crea usuarios con rol "Domiciliario" en el módulo de Usuarios.</p>
              </div>
            ) : deliveryPeople.map(p => {
              const active = deliveries.filter(d => d.delivery_person === p.id && d.status === 'on_way').length
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.full_name}</p>
                    <p className="text-xs text-gray-400">@{p.username}</p>
                  </div>
                  {active > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                      {active} en camino
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
