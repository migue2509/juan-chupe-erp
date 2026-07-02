import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icons'
import { uploadAvatar, removeAvatar } from '../api/auth'
import toast from 'react-hot-toast'

export default function Topbar({ onMenuToggle }) {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const roleLabel = user?.role === 'admin'
    ? 'Administrador'
    : user?.role === 'delivery'
    ? 'Domiciliario'
    : 'Vendedora'

  const handleAvatarClick = () => {
    setMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida.')
      return
    }
    setUploading(true)
    try {
      const { data } = await uploadAvatar(user.id, file)
      updateUser({ avatar_url: data.avatar_url })
      toast.success('Foto actualizada')
    } catch {
      toast.error('No se pudo subir la foto')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setMenuOpen(false)
    setUploading(true)
    try {
      await removeAvatar(user.id)
      updateUser({ avatar_url: null })
      toast.success('Foto eliminada')
    } catch {
      toast.error('No se pudo eliminar la foto')
    } finally {
      setUploading(false)
    }
  }

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
        <div className="flex items-center gap-2.5 relative">
          {/* Avatar */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              disabled={uploading}
              className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-pink-300 transition-all focus:outline-none"
              title="Cambiar foto de perfil"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-600 text-xs font-semibold">
                  {uploading ? (
                    <svg className="w-4 h-4 animate-spin text-pink-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : initials}
                </div>
              )}
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={handleAvatarClick}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Subir foto
                </button>
                {user?.avatar_url && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="w-full text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Eliminar foto
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.full_name}</p>
            <p className="text-[11px] text-gray-400 leading-tight capitalize">{roleLabel}</p>
          </div>
        </div>

        <div className="w-px h-5 bg-gray-200" />
        <button onClick={handleLogout} className="btn-ghost text-gray-400 hover:text-red-500 px-2 py-1.5" title="Cerrar sesión">
          <Icon name="logout" className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </header>
  )
}
