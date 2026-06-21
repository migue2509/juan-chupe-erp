import { useEffect, useState } from 'react'
import { getShifts, openShift, closeShift, getActiveShift } from '../api'
import toast from 'react-hot-toast'

export default function Shifts() {
  const [shifts, setShifts] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [s, a] = await Promise.all([getShifts(), getActiveShift()])
    setShifts(s.data.results || s.data)
    setActive(a.data.shift)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleOpen = async () => {
    try { await openShift(); toast.success('Jornada abierta'); load() } catch {}
  }
  const handleClose = async () => {
    if (!confirm('¿Cerrar jornada actual?')) return
    try { await closeShift(); toast.success('Jornada cerrada'); load() } catch {}
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-brand-navy">Jornadas</h1>
        {active ? (
          <button onClick={handleClose} className="btn-primary bg-red-500 shadow-none">🔒 Cerrar Jornada</button>
        ) : (
          <button onClick={handleOpen} className="btn-lime">🟢 Abrir Jornada</button>
        )}
      </div>

      {active && (
        <div className="card border-brand-lime border-2 bg-brand-lime/5">
          <p className="font-bold text-green-800">✅ Jornada activa #{active.id}</p>
          <p className="text-sm text-gray-500 mt-1">
            Abierta: {new Date(active.opened_at).toLocaleString('es-CO')}
          </p>
        </div>
      )}

      <div className="card">
        <div className="divide-y">
          {shifts.map(s => (
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Jornada #{s.id}</p>
                <p className="text-xs text-gray-400">
                  {new Date(s.opened_at).toLocaleString('es-CO')}
                  {s.closed_at && ` → ${new Date(s.closed_at).toLocaleString('es-CO')}`}
                </p>
              </div>
              <span className={`badge-${s.status === 'open' ? 'lime' : 'gray'}`}>
                {s.status === 'open' ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
