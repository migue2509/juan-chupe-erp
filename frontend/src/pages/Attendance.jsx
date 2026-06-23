import { useEffect, useState } from 'react'
import {
  getTodayAttendance, createAttendance, checkoutAttendance,
  myAttendanceStatus, myCheckin, myCheckout,
} from '../api'
import { getOperatives } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

// ── Vista admin: lista completa + registrar por cualquier empleada ───────────
function AdminAttendance() {
  const [records, setRecords]     = useState([])
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
    } catch { toast.error('Error al registrar') }
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

// ── Vista vendedora: solo su propio ingreso/salida ───────────────────────────
function SellerAttendance({ user }) {
  const [status, setStatus] = useState(null)   // { shift_active, record }
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await myAttendanceStatus()
      setStatus(res.data)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const checkin = async () => {
    setBusy(true)
    try {
      await myCheckin()
      toast.success('¡Entrada registrada!')
      load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al registrar entrada')
    }
    setBusy(false)
  }

  const checkout = async () => {
    setBusy(true)
    try {
      await myCheckout()
      toast.success('¡Salida registrada!')
      load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al registrar salida')
    }
    setBusy(false)
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const record = status?.record
  const shiftActive = status?.shift_active

  const fmtTime = dt => new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-sm mx-auto pt-8 space-y-6">
      {/* Saludo */}
      <div className="text-center">
        <p className="text-sm text-gray-400">Bienvenida,</p>
        <h1 className="text-2xl font-bold text-brand-navy mt-0.5">{user.full_name}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Card de estado */}
      <div className={`card text-center py-8 border-2 ${
        !shiftActive ? 'border-gray-100' :
        record?.check_out ? 'border-green-200 bg-green-50' :
        record ? 'border-brand-navy/20 bg-blue-50' :
        'border-gray-100'
      }`}>
        {!shiftActive ? (
          <>
            <div className="text-5xl mb-4">🕐</div>
            <p className="font-semibold text-gray-600">Sin jornada activa</p>
            <p className="text-sm text-gray-400 mt-1">Espera a que el admin abra la jornada</p>
          </>
        ) : record?.check_out ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <p className="font-bold text-green-700 text-lg">Jornada completada</p>
            <div className="mt-3 space-y-1 text-sm text-gray-500">
              <p>Entrada: <span className="font-semibold text-gray-700">{fmtTime(record.check_in)}</span></p>
              <p>Salida: <span className="font-semibold text-gray-700">{fmtTime(record.check_out)}</span></p>
              {record.hours_worked && (
                <p className="text-brand-navy font-bold mt-2">{record.hours_worked}h trabajadas</p>
              )}
            </div>
          </>
        ) : record ? (
          <>
            <div className="text-5xl mb-4">⏱️</div>
            <p className="font-bold text-brand-navy text-lg">En jornada</p>
            <p className="text-sm text-gray-500 mt-1">
              Entrada a las <span className="font-semibold">{fmtTime(record.check_in)}</span>
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">👋</div>
            <p className="font-bold text-gray-700 text-lg">Aún no has marcado entrada</p>
            <p className="text-sm text-gray-400 mt-1">Pulsa el botón para iniciar tu jornada</p>
          </>
        )}
      </div>

      {/* Botón de acción */}
      {shiftActive && !record?.check_out && (
        <button
          onClick={record ? checkout : checkin}
          disabled={busy}
          className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition-all shadow-lg ${
            record
              ? 'bg-red-500 hover:bg-red-600 active:scale-95'
              : 'bg-brand-navy hover:opacity-90 active:scale-95'
          }`}
          style={!record ? { background: 'linear-gradient(135deg, #FF0099, #7B2FFF)' } : {}}>
          {busy ? '...' : record ? '🚪 Registrar Salida' : '✅ Registrar Entrada'}
        </button>
      )}
    </div>
  )
}

// ── Selector por rol ─────────────────────────────────────────────────────────
export default function Attendance() {
  const { user, isAdmin } = useAuth()
  if (isAdmin) return <AdminAttendance />
  return <SellerAttendance user={user} />
}
