import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icons'

export default function Topbar({ onMenuToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Hamburger — solo móvil */}
        <button onClick={onMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo — solo móvil */}
        <div className="flex items-center gap-2 md:hidden">
          <img src="/logo-neon.png" alt="" className="w-6 h-6 object-contain" />
          <span className="font-bold text-gray-900 text-sm">Juan Chupe</span>
        </div>

        {/* Fecha — solo desktop */}
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
          <span className="font-medium text-gray-600">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF0099, #7B2FFF)' }}>
            {initials}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.full_name}</p>
            <p className="text-[11px] text-gray-400 leading-tight capitalize">
              {user?.role === 'admin' ? 'Administrador' : 'Operativa'}
            </p>
          </div>
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <button onClick={handleLogout} className="btn-ghost text-gray-400 hover:text-red-500 px-2 py-1.5" title="Cerrar sesión">
          <Icon name="logout" className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
