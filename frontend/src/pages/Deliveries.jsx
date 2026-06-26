import { useEffect, useState } from 'react'
import { getDeliveries, updateDelivery, cancelDeliveryReq, getDomiciliarios, createDomiciliario, updateDomiciliario, getShifts } from '../api'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

const fmt     = n  => `$${Number(n).toLocaleString('es-CO')}`
const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const STATUS = {
  pending:   { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700', next: 'on_way',    nextLabel: 'Enviar' },
  on_way:    { label: 'En camino', cls: 'bg-cyan-100 text-cyan-700',   next: 'delivered', nextLabel: 'Entregado' },
  delivered: { label: 'Entregado', cls: 'bg-green-100 text-green-700', next: null,        nextLabel: null },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-600',     next: null,        nextLabel: null },
}

const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
const PAYMENT_BADGE  = {
  cash: 'bg-gray-100 text-gray-600',
  transfer: 'bg-cyan-100 text-cyan-700',
  mixed: 'bg-lime-100 text-lime-700',
}

export default function Deliveries() {
  const [deliveries,     setDeliveries]     = useState([])
  const [domiciliarios,  setDomiciliarios]  = useState([])
  const [loading,        setLoading]        = useState(true)
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [selected,       setSelected]       = useState(null)

  // Crear domiciliario
  const [newName,  setNewName]  = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    try {
      const [dRes, domRes, sRes] = await Promise.all([getDeliveries(), getDomiciliarios(), getShifts()])
      setDeliveries(dRes.data?.results ?? dRes.data ?? [])
      setDomiciliarios(domRes.data?.results ?? domRes.data ?? [])
      setShifts((sRes.data?.results ?? sRes.data ?? []).sort((a, b) => b.id - a.id))
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

  const changeStatus = async (d, newStatus) => {
    if (d.status === newStatus) return
    try {
      const patch = { status: newStatus }
      if (newStatus === 'delivered') patch.delivered_at = new Date().toISOString()
      await updateDelivery(d.id, patch)
      toast.success(`Estado → ${STATUS[newStatus].label}`)
      load()
    } catch { toast.error('Error al actualizar estado') }
  }

  const cancelDelivery = async (d) => {
    if (!confirm('¿Cancelar este domicilio? Se revertirá el inventario y se anulará la factura.')) return
    try {
      await cancelDeliveryReq(d.id)
      toast.success('Domicilio cancelado — inventario revertido')
      load()
    } catch { toast.error('Error al cancelar') }
  }

  const assignPerson = async (deliveryId, personId) => {
    try {
      await updateDelivery(deliveryId, { delivery_person: personId || null })
      load()
    } catch { toast.error('Error al asignar') }
  }

  const handleCreateDomiciliario = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createDomiciliario({ name: newName.trim() })
      toast.success(`"${newName.trim()}" agregado`)
      setNewName('')
      load()
    } catch { toast.error('Error al crear') }
    setCreating(false)
  }

  const toggleDomiciliario = async (d) => {
    try {
      await updateDomiciliario(d.id, { is_active: !d.is_active })
      toast.success(d.is_active ? 'Desactivado' : 'Activado')
      load()
    } catch { toast.error('Error') }
  }

  // Editar domicilio
  const [editing,  setEditing]  = useState(null)
  const [editForm, setEditForm] = useState({})

  const openEdit = (d, e) => {
    e.stopPropagation()
    setEditForm({ address: d.address, four_digits: d.four_digits, notes: d.notes || '', delivery_person: d.delivery_person || '' })
    setEditing(d)
  }

  const saveEdit = async () => {
    try {
      await updateDelivery(editing.id, {
        address:         editForm.address.trim(),
        four_digits:     editForm.four_digits.trim(),
        notes:           editForm.notes.trim(),
        delivery_person: editForm.delivery_person || null,
      })
      toast.success('Domicilio actualizado')
      setEditing(null)
      load()
    } catch { toast.error('Error al guardar') }
  }

  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [shifts,      setShifts]      = useState([])

  const filtered = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (shiftFilter !== 'all' && d.shift !== Number(shiftFilter)) return false
    if (dateFrom || dateTo) {
      const d2 = new Date(d.created_at)
      d2.setHours(0, 0, 0, 0)
      if (dateFrom && d2 < new Date(dateFrom)) return false
      if (dateTo   && d2 > new Date(dateTo))   return false
    }
    return true
  })

  const hasDateFilter = dateFrom || dateTo || shiftFilter !== 'all'
  const clearDates    = () => { setDateFrom(''); setDateTo(''); setShiftFilter('all') }

  const counts = Object.keys(STATUS).reduce((acc, k) => {
    acc[k] = filtered.filter(d => d.status === k).length
    return acc
  }, {})

  // Gráfico por domiciliario — usa `filtered` para respetar filtros de fecha y estado
  const domChart = {}
  filtered.forEach(d => {
    const name = d.delivery_person_name || 'Sin asignar'
    if (!domChart[name]) domChart[name] = { total: 0, delivered: 0, on_way: 0, pending: 0, cancelled: 0 }
    domChart[name].total++
    if (d.status) domChart[name][d.status] = (domChart[name][d.status] || 0) + 1
  })
  const domChartArr = Object.entries(domChart)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)

  const activeDomiciliarios = domiciliarios.filter(d => d.is_active)

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1>Domicilios</h1>
        <p className="text-sm text-gray-400 mt-0.5">{deliveries.length} pedido{deliveries.length !== 1 ? 's' : ''} registrado{deliveries.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Stats */}
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

      {/* Filtro fechas */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
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
        {hasDateFilter && (
          <button onClick={clearDates} className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap">
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} de {deliveries.length} domicilios</span>
      </div>

      {/* Gráfico por domiciliario */}
      {domChartArr.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Icon name="reports" className="w-4 h-4 text-brand-purple" />
            <h2>Domicilios por repartidor</h2>
            <span className="badge-gray ml-auto">{filtered.length} en total</span>
          </div>
          <div className="px-5 py-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(domChartArr.length, 4)}, 1fr)` }}>
            {domChartArr.map(d => (
              <div key={d.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 truncate">{d.name}</span>
                  <span className="text-lg font-bold text-gray-900 tabular-nums ml-2">{d.total}</span>
                </div>
                {/* Barra apilada */}
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  {d.delivered > 0 && <div title={`${d.delivered} entregados`} className="h-full bg-green-400" style={{ width: `${(d.delivered/d.total)*100}%` }} />}
                  {d.on_way > 0    && <div title={`${d.on_way} en camino`}    className="h-full bg-cyan-400"  style={{ width: `${(d.on_way/d.total)*100}%` }} />}
                  {d.pending > 0   && <div title={`${d.pending} pendientes`}  className="h-full bg-amber-400" style={{ width: `${(d.pending/d.total)*100}%` }} />}
                  {d.cancelled > 0 && <div title={`${d.cancelled} cancelados`}className="h-full bg-red-400"   style={{ width: `${(d.cancelled/d.total)*100}%` }} />}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {d.delivered > 0 && <span className="text-[10px] font-medium text-green-600">✓ {d.delivered} entregados</span>}
                  {d.on_way > 0    && <span className="text-[10px] font-medium text-cyan-600">↗ {d.on_way} en camino</span>}
                  {d.pending > 0   && <span className="text-[10px] font-medium text-amber-600">◷ {d.pending} pendientes</span>}
                  {d.cancelled > 0 && <span className="text-[10px] font-medium text-red-500">✕ {d.cancelled} cancelados</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

          <div className="grid px-4 py-2.5 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-2"
            style={{ gridTemplateColumns: '44px 110px 52px 1fr 85px 85px 110px 76px' }}>
            {['#', 'Fecha / Hora', 'Cliente', 'Dirección', 'Total', 'Pago', 'Domiciliario', 'Estado'].map(h => <span key={h}>{h}</span>)}
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                <Icon name="bike" className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin domicilios</p>
              </div>
            ) : filtered.map(d => {
              const s    = STATUS[d.status] ?? STATUS.pending
              const sale = d.sale_detail
              return (
                <div key={d.id}>
                  <div
                    onClick={() => setSelected(selected?.id === d.id ? null : d)}
                    className="grid px-4 py-3 items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: '44px 110px 52px 1fr 85px 85px 110px 76px' }}>
                    <span className="font-mono text-xs font-bold text-brand-navy">#{d.id}</span>
                    <span className="text-xs tabular-nums text-gray-500 leading-tight">
                      <span className="block">{new Date(d.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                      <span className="block text-gray-400">{fmtTime(d.created_at)}</span>
                    </span>
                    <span className="font-mono text-sm font-bold text-gray-700 text-center">{d.four_digits || '—'}</span>
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
                      {activeDomiciliarios.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {/* Mantener trazabilidad: mostrar el asignado aunque esté inactivo */}
                      {d.delivery_person && !activeDomiciliarios.find(p => p.id === d.delivery_person) && (() => {
                        const inactivo = domiciliarios.find(p => p.id === d.delivery_person)
                        return inactivo ? <option key={inactivo.id} value={inactivo.id}>{inactivo.name} (inactivo)</option> : null
                      })()}
                    </select>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${s.cls}`}>{s.label}</span>
                  </div>

                  {/* Detalle expandido */}
                  {selected?.id === d.id && (
                    <div className="px-5 pb-4 pt-3 bg-blue-50 border-t border-blue-100 space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Pedido</p>
                        <span className="text-xs font-medium text-brand-navy bg-blue-100 px-2 py-0.5 rounded-full">Jornada {d.shift_label}</span>
                      </div>
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

                      {/* Pago detalle */}
                      <div className="flex gap-6 text-sm pt-1 border-t border-blue-100">
                        {sale?.cash_received > 0 && <div><p className="text-xs text-gray-400">Efectivo</p><p className="font-semibold">{fmt(sale.cash_received)}</p></div>}
                        {sale?.transfer_amount > 0 && <div><p className="text-xs text-gray-400">Transferencia</p><p className="font-semibold">{fmt(sale.transfer_amount)}</p></div>}
                        {sale?.change_given > 0 && <div><p className="text-xs text-gray-400">Cambio</p><p className="font-semibold text-green-600">{fmt(sale.change_given)}</p></div>}
                        <div className="ml-auto"><p className="text-xs text-gray-400">Total</p><p className="font-bold text-brand-pink">{fmt(sale?.total || 0)}</p></div>
                      </div>

                      {d.notes && <p className="text-xs text-gray-500 italic">📝 {d.notes}</p>}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {s.next && (
                          <button onClick={() => advanceStatus(d)} className="btn-primary py-1.5 text-xs">
                            {s.nextLabel}
                          </button>
                        )}
                        {/* Selector libre de estado */}
                        <select
                          className="input py-1.5 text-xs w-36"
                          value={d.status}
                          onChange={e => changeStatus(d, e.target.value)}>
                          {Object.entries(STATUS).map(([k, sv]) => (
                            <option key={k} value={k}>{sv.label}</option>
                          ))}
                        </select>
                        <button onClick={(e) => openEdit(d, e)} className="btn-secondary py-1.5 text-xs">
                          Editar
                        </button>
                        {d.status !== 'cancelled' && (
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
            <span className="badge-gray ml-auto">{activeDomiciliarios.length} activos</span>
          </div>

          {/* Formulario agregar */}
          <form onSubmit={handleCreateDomiciliario} className="px-5 py-3 border-b border-gray-100 flex gap-2">
            <input className="input text-sm flex-1" placeholder="Nombre del domiciliario..."
              value={newName} onChange={e => setNewName(e.target.value)} />
            <button type="submit" disabled={creating || !newName.trim()} className="btn-cyan py-1.5 text-xs px-3">
              {creating
                ? <span className="w-3 h-3 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
                : <Icon name="plus" className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Lista */}
          <div className="divide-y divide-gray-50">
            {domiciliarios.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-300 text-sm">
                Sin domiciliarios
              </div>
            ) : domiciliarios.map(p => {
              const enCamino = deliveries.filter(d => d.delivery_person === p.id && d.status === 'on_way').length
              return (
                <div key={p.id} className={`flex items-center justify-between px-5 py-3 ${!p.is_active ? 'opacity-40' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    {enCamino > 0 && (
                      <span className="text-xs text-cyan-600 font-medium">{enCamino} en camino</span>
                    )}
                  </div>
                  <button onClick={() => toggleDomiciliario(p)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                      p.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Modal editar domicilio */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">Editar domicilio #{editing.id}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cliente</label>
                <input className="input" value={editForm.four_digits}
                  onChange={e => setEditForm(f => ({ ...f, four_digits: e.target.value }))} />
              </div>
              <div>
                <label className="label">Domiciliario</label>
                <select className="input" value={editForm.delivery_person}
                  onChange={e => setEditForm(f => ({ ...f, delivery_person: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {activeDomiciliarios.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {editForm.delivery_person && !activeDomiciliarios.find(p => p.id === Number(editForm.delivery_person)) && (() => {
                    const inactivo = domiciliarios.find(p => p.id === Number(editForm.delivery_person))
                    return inactivo ? <option key={inactivo.id} value={inactivo.id}>{inactivo.name} (inactivo)</option> : null
                  })()}
                </select>
              </div>
              <div>
                <label className="label">Notas</label>
                <input className="input" value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={saveEdit} className="btn-primary text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
