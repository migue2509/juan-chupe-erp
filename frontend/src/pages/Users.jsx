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
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input className="input" type="password" required minLength="6" placeholder="Mínimo 6 caracteres"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Crear Usuario
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
          style={{ gridTemplateColumns: '1fr 130px 120px 80px 90px 200px' }}>
          {['Nombre', 'Username', 'Rol', 'Estado', 'Creado', 'Acciones'].map(h => <span key={h}>{h}</span>)}
        </div>

        <div className="divide-y divide-gray-50">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-300">
              <p className="text-sm">No hay usuarios registrados</p>
            </div>
          ) : users.map(u => (
            <div key={u.id}>
              {editing?.id === u.id ? (
                /* Fila de edición */
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-3 items-end">
                  <div style={{ width: 180 }}>
                    <label className="label">Nombre completo</label>
                    <input className="input text-sm" value={editing.full_name}
                      onChange={e => setEditing(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div style={{ width: 140 }}>
                    <label className="label">Username</label>
                    <input className="input text-sm" value={editing.username}
                      onChange={e => setEditing(p => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div style={{ width: 150 }}>
                    <label className="label">Rol</label>
                    <select className="input text-sm" value={editing.role}
                      onChange={e => setEditing(p => ({ ...p, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pb-0.5">
                    <button onClick={handleEditSave} disabled={editSaving} className="btn-primary py-1.5 text-xs">
                      {editSaving
                        ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Icon name="check" className="w-3.5 h-3.5" />}
                      Guardar
                    </button>
                    <button onClick={() => setEditing(null)} className="btn-secondary py-1.5 text-xs">Cancelar</button>
                  </div>
                </div>
              ) : (
                /* Fila normal */
                <div className={`grid px-5 py-3.5 items-center gap-3 hover:bg-slate-50 transition-colors ${!u.is_active ? 'opacity-40' : ''}`}
                  style={{ gridTemplateColumns: '1fr 130px 120px 80px 90px 200px' }}>
                  <span className="font-medium text-sm text-gray-800">{u.full_name}</span>
                  <span className="text-sm text-gray-500 font-mono">@{u.username}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                  </span>
                  <button onClick={() => handleToggle(u)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all w-fit ${
                      u.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                  <span className="text-xs text-gray-400 tabular-nums">{fmtDate(u.created_at)}</span>
                  <div className="flex items-center gap-1.5">
                    {/* Editar */}
                    <button onClick={() => setEditing({ id: u.id, username: u.username, full_name: u.full_name, role: u.role })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                      title="Editar">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {/* Cambiar contraseña */}
                    <button onClick={() => { setPwdUser(u); setNewPwd('') }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-cyan-50 hover:text-cyan-600 transition-all"
                      title="Cambiar contraseña">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </button>
                    {/* Toggle activo */}
                    <button onClick={() => handleToggle(u)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        u.is_active
                          ? 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                          : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
                      }`}
                      title={u.is_active ? 'Desactivar' : 'Activar'}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {u.is_active
                          ? <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>
                          : <><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal cambiar contraseña */}
      {pwdUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-96 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2>Cambiar contraseña</h2>
                <p className="text-xs text-gray-400 mt-0.5">{pwdUser.full_name}</p>
              </div>
              <button onClick={() => setPwdUser(null)} className="text-gray-400 hover:text-gray-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePwd} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nueva contraseña</label>
                <input className="input" type="password" required minLength="6" autoFocus
                  placeholder="Mínimo 6 caracteres"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={pwdSaving} className="btn-primary flex-1">
                  {pwdSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Cambiar
                </button>
                <button type="button" onClick={() => setPwdUser(null)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
