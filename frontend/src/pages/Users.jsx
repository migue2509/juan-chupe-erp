import { useEffect, useState } from 'react'
import { getUsers, createUser, toggleUser, changePassword } from '../api/auth'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operative', label: 'Vendedora' },
  { value: 'delivery', label: 'Domiciliario' },
]

export default function Users() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ username: '', full_name: '', role: 'operative', password: '' })
  const [pwdForm, setPwdForm] = useState({ user_id: null, new_password: '' })
  const [showForm, setShowForm] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const load = () => getUsers().then(r => setUsers(r.data.results || r.data))
  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createUser(form)
      toast.success('Usuario creado')
      setForm({ username: '', full_name: '', role: 'operative', password: '' })
      setShowForm(false)
      load()
    } catch {}
  }

  const handleToggle = async (u) => {
    await toggleUser(u.id)
    toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
    load()
  }

  const handlePwd = async (e) => {
    e.preventDefault()
    try {
      await changePassword(pwdForm)
      toast.success('Contraseña actualizada')
      setShowPwd(false)
      setPwdForm({ user_id: null, new_password: '' })
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-brand-navy">Usuarios</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Nuevo Usuario</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card border-brand-pink border space-y-3">
          <h2 className="text-brand-pink">Nuevo Usuario</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username</label>
              <input className="input" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" required minLength="6" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Crear</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {showPwd && (
        <form onSubmit={handlePwd} className="card border-brand-cyan border space-y-3">
          <h2 className="text-cyan-700">Cambiar Contraseña</h2>
          <div>
            <label className="label">Nueva Contraseña</label>
            <input className="input" type="password" required minLength="6" autoFocus
              value={pwdForm.new_password} onChange={e => setPwdForm(f => ({ ...f, new_password: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-cyan">Cambiar</button>
            <button type="button" onClick={() => setShowPwd(false)} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="divide-y">
          {users.map(u => (
            <div key={u.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{u.full_name}</p>
                <p className="text-xs text-gray-400">@{u.username} · {ROLES.find(r => r.value === u.role)?.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setPwdForm(f => ({ ...f, user_id: u.id })); setShowPwd(true) }}
                  className="text-xs text-brand-cyan hover:underline">Contraseña</button>
                <button onClick={() => handleToggle(u)}
                  className={`text-xs px-3 py-1 rounded-full ${u.is_active ? 'bg-brand-lime/30 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
