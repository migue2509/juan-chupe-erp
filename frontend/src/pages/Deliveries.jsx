import { useEffect, useState } from 'react'
import { getDeliveries, updateDelivery, getDomiciliarios, createDomiciliario, updateDomiciliario } from '../api'
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
      const [dRes, domRes] = await Promise.all([getDeliveries(), getDomiciliarios()])
      setDeliveries(dRes.data?.results ?? dRes.data ?? [])
      setDomiciliarios(domRes.data?.results ?? domRes.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const advanceStatus = async (d) => {
    const next = STATUS[d.status]?.next
    if (!next) return
    try {
      const patch = { status: next }
      if (next === 'delivered') patch.delivered_at = new Date().toISOStrin