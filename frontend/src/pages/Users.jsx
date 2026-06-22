import { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, toggleUser, changePassword } from '../api/auth'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'admin',     label: 'Administrador' },
  { value: 'operative', label: 'Vendedora' },
  { value: 'delivery',  label: 'Domiciliario' },
]

const ROLE_BADGE = {
  admin:     'bg-violet-100 text-violet-700',
  operative: 'bg-cyan-100 text-cyan-700',
  delivery:  'bg-amber-100 text-amber-700',
}

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : '—'

const EMPTY_FORM = { username: '', full_name: '', role: 'operative', password: '' }

export default function Users() {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  // Edición inline
  const [editing,  setEditing]  = useState(null) // { id, username, full_name, role }
  const [editSaving, setEditSaving] = useState(false)

  // Cambio de contraseña
  const [pwdUser,  setPwdUser]  = useState(null)  // usuario seleccionado
  const [newPwd,   setNewPwd]   = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const load = async () => {
    try {
      const r = await getUsers()
      setUsers(r.data?.results ?? r.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Crear ──
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.username || !form.full_name || !form.password) {
      toast.error('Completa todos los campos'); return
    }
    setSaving(true)
    try {
      await createUser(form)
      toast.success(`Usuario "${form.full_name}" creado`)
      setForm(EMPTY_FORM); setShowForm(false); load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al crear usuario')
    }
    setSaving(false)
  }

  // ── Editar ──
  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      await updateUser(editing.id, {
        username:  editing.username,
        full_name: editing.full_name,
        role:      editing.role,
      })
      toast.success('Usuario actualizado')
      setEditing(null); load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al actualizar')
    }
    setEditSaving(false)
  }

  // ── Toggle activo ──
  const handleToggle = async (u) => {
    try {
      await toggleUser(u.id)
      toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch { toast.error('Error al cambiar estado') }
  }

  // ── Cambiar contraseña ──
  const handlePwd = async (e) => {
    e.preventDefault()
    if (newPwd.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    setPwdSaving(true)
    try {
      await changePassword({ user_id: pwdUser.id, new_password: newPwd })
      toast.success(`Contraseña de "${pwdUser.full_name}" actualizada`)
      setPwdUser(null); setNewPwd('')
    } catch { toast.error('Error al cambiar contraseña') }
    setPwdSaving(false)
  }

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
          <h1>Usuarios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} cuenta{users.length !== 1 ? 's' : ''} registrada{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditing(null) }} className="btn-primary">
          <Icon name="plus" className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Formulario crear */}
      {showForm && (
        <div className="card border-l-4 border-brand-pink">
          <h2 className="mb-4">Nuevo Usuario</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" required placeholder="Ej: María López"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" required placeholder="Ej: maria.lopez"
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label className="label">Rol</label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }