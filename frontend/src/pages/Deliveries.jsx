import { useEffect, useState } from 'react'
import { getDeliveries, updateDelivery } from '../api'
import toast from 'react-hot-toast'

const STATUS_LABELS = { pending: '⏳ Pendiente', on_way: '🛵 En Camino', delivered: '✅ Entregado', cancelled: '❌ Cancelado' }

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => getDeliveries().then(r => { setDeliveries(r.data.results || r.data); setLoading(false) })
  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    await updateDelivery(id, { status })
    toast.success('Estado actualizado')
    load()
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-brand-navy">Domicilios</h1>
      <div className="space-y-3">
        {deliveries.length === 0 && <div className="card text-center text-gray-400 py-8">Sin domicilios</div>}
        {deliveries.map(d => (
          <div key={d.id} className="card flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-medium">📍 {d.address}</p>
              <p className="text-xs text-gray-400">
                {d.delivery_person_name || 'Sin asignar'} ·
                ${Number(d.sale_total).toLocaleString('es-CO')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{STATUS_LABELS[d.status]}</span>
              {d.status === 'pending' && (
                <button onClick={() => updateStatus(d.id, 'on_way')} className="btn-cyan text-xs py-1">En Camino</button>
              )}
              {d.status === 'on_way' && (
                <button onClick={() => updateStatus(d.id, 'delivered')} className="btn-lime text-xs py-1">Entregado</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
