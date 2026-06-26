import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../context/AuthContext'
import { getActiveShift } from '../api'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isOperative = user?.role === 'operative'

  const [activeShift, setActiveShift] = useState(null)
  const [checkingShift, setCheckingShift] = useState(isOperative)

  const checkShift = useCallback(async () => {
    try {
      const { data } = await getActiveShift()
      setActiveShift(data.shift ?? null)
    } catch {
      setActiveShift(null)
    } finally {
      setCheckingShift(false)
    }
  }, [])

  useEffect(() => {
    if (!isOperative) return
    checkShift()
    // Revisar cada 30 segundos por si el admin abre la jornada
    const interval = setInterval(checkShift, 30_000)
    // También revisar al volver a la pestaña
    const onVisible = () => { if (document.visibilityState === 'visible') checkShift() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [isOperative, checkShift])

  // Pantalla de bloqueo para operativas sin jornada activa
  if (isOperative && checkingShift) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isOperative && !activeShift) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Jornada no iniciada</h2>
        <p className="text-sm text-gray-400 mb-6">
          El sistema está bloqueado hasta que el administrador abra la jornada del día.
        </p>
        <button onClick={checkShift} className="btn-primary w-full">
          Verificar de nuevo
        </button>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="btn-secondary w-full mt-3">
          Cerrar sesión
        </button>
        <p className="text-xs text-gray-300 mt-4">Revisando automáticamente cada 30 segundos…</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
