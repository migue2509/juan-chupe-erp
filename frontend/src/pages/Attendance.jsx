import { useEffect, useState } from 'react'
import { getTodayAttendance, createAttendance, checkoutAttendance } from '../api'
import { getOperatives } from '../api/auth'
import toast from 'react-hot-toast'

export default function Attendance() {
  const [records, setRecords] = useState([])
  const [operatives, setOperatives] = useState([])
  const [selectedUser, setSelectedUser] = useState('')

  const load = async () => {
    const [r, o] = await Promise.all([getTodayAttendance(), getOperatives()])
    setRecords(r.data)
    setOperatives(o.data)
  }
  useEffect(() => { load() }, [])

  const handleCheckin = async () => {
    if (!selectedUser) { toast.error('Selecciona una vendedora'); return }
    try {
      await createAttendance({ user: selectedUser })
      toast.success('Entrada registrada')
      load()
    } catch {}
  }

  const handleCheckout = async (id) => {
    try {
      await checkoutAttendance(id)
      toast.success('Salida registrada')
      load()
    } catch {}
  }

  return (
    <div className="space-y-6">
      <h1 className="text-brand-navy">Asistencia</h1>

      {/* Check-in */}
      <div className="card">
        <h2 className="mb-3 text-sm">Registrar Entrada</h2>
        <div className="flex gap-2">
          <select className="input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="">Selecciona vendedora...</option>
            {operatives.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </select>
          <button onClick={handleCheckin} className="btn-lime whitespace-nowrap">✅ Registrar</button>
        </div>
      </div>

      {/* Records */}
      <div className="card">
        <h2 className="mb-3 text-sm">Registros de Hoy</h2>
        <div className="divide-y">
          {records.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">Sin registros hoy</p>}
          {records.map(r => (
            <div key={r.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{r.user_name}</p>
                <p className="text-xs text-gray-400">
                  Entrada: {new Date(r.check_in).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  {r.check_out && ` · Salida: ${new Date(r.check_out).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
                  {r.hours_worked && ` · ${r.hours_worked}h`}
                </p>
              </div>
              {!r.check_out && (
                <button onClick={() => handleCheckout(r.id)} className="btn-primary text-xs py-1">Salida</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
