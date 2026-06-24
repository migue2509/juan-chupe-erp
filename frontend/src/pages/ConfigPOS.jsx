import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import {
  getTransferMethods,
  createTransferMethod,
  updateTransferMethod,
  deleteTransferMethod,
} from '../api/index'
import toast from 'react-hot-toast'

const PROVIDERS = [
  { value: 'bancolombia', label: 'Bancolombia', color: 'bg-yellow-400 text-yellow-900' },
  { value: 'nequi',       label: 'Nequi',       color: 'bg-purple-600 text-white' },
  { value: 'daviplata',   label: 'Daviplata',   color: 'bg-red-500 text-white' },
  { value: 'other',       label: 'Otro',         color: 'bg-gray-400 text-white' },
]

const providerMeta = (p) => PROVIDERS.find(x => x.value === p) || PROVIDERS[3]

const EMPTY = { provider: 'bancolombia', display_name: '', account_number: '', is_active: true, order: 0 }

// ─── Modal de creación / edición ─────────────────────────────────────────────
function MethodModal({ method, onClose, onSaved }) {
  const [form, setForm] = useState(method ? { ...method } : { ...EMPTY })
  const [qrFile, setQrFile] = useState(null)
  const [preview, setPreview] = useState(method?.qr_image_url || null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setQrFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!form.display_name.trim()) { toast.error('Ingresa un nombre'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('provider',       form.provider)
      fd.append('display_name',   form.display_name)
      fd.append('account_number', form.account_number)
      fd.append('is_active',      form.is_active)
      fd.append('order',          form.order)
      if (qrFile) fd.append('qr_image', qrFile)

      if (method?.id) {
        await updateTransferMethod(method.id, fd)
        toast.success('Método actualizado')
      } else {
        await createTransferMethod(fd)
        toast.success('Método creado')
      }
      onSaved()
    } catch (e) {
      toast.error('Error al guardar')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {method ? 'Editar método' : 'Nuevo método de pago'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <Icon name="x" className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Proveedor */}
        <div>
          <label className="label-sm">Proveedor</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                onClick={() => set('provider', p.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all
                  ${form.provider === p.value
                    ? `${p.color} border-transparent`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre mostrado */}
        <div>
          <label className="label-sm">Nombre mostrado al cliente</label>
          <input
            className="input mt-1"
            value={form.display_name}
            onChange={e => set('display_name', e.target.value)}
            placeholder="Ej: Bancolombia Ahorros"
          />
        </div>

        {/* Número / cuenta */}
        <div>
          <label className="label-sm">Número de celular o cuenta</label>
          <input
            className="input mt-1"
            value={form.account_number}
            onChange={e => set('account_number', e.target.value)}
            placeholder="Ej: 310 000 0000"
          />
        </div>

        {/* QR */}
        <div>
          <label className="label-sm">Código QR (imagen)</label>
          <div
            className="mt-1 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-4 cursor-pointer hover:border-brand-pink transition-colors"
            onClick={() => fileRef.current.click()}
          >
            {preview
              ? <img src={preview} alt="QR" className="h-40 object-contain rounded" />
              : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Icon name="upload" className="w-8 h-8" />
                  <p className="text-sm">Haz clic para subir una imagen</p>
                </div>
              )
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {preview && (
            <button
              onClick={() => { setQrFile(null); setPreview(null) }}
              className="text-xs text-red-500 mt-1 hover:underline"
            >
              Quitar imagen
            </button>
          )}
        </div>

        {/* Orden y activo */}
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="label-sm">Orden de aparición</label>
            <input
              type="number" min="0"
              className="input mt-1"
              value={form.order}
              onChange={e => set('order', Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <div
              onClick={() => set('is_active', !form.is_active)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Activo</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de método ────────────────────────────────────────────────────────
function MethodCard({ method, onEdit, onDelete }) {
  const meta = providerMeta(method.provider)
  return (
    <div className={`card flex gap-4 items-start ${!method.is_active ? 'opacity-50' : ''}`}>
      {/* QR o placeholder */}
      <div className="w-20 h-20 rounded-xl border border-gray-100 flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden">
        {method.qr_image_url
          ? <img src={method.qr_image_url} alt="QR" className="w-full h-full object-contain" />
          : <Icon name="qr" className="w-8 h-8 text-gray-300" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
            {meta.label}
          </span>
          {!method.is_active && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactivo</span>
          )}
        </div>
        <p className="font-semibold text-gray-900 mt-1 truncate">{method.display_name}</p>
        {method.account_number && (
          <p className="text-sm text-gray-500 font-mono">{method.account_number}</p>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(method)} className="p-2 rounded-lg hover:bg-gray-100">
          <Icon name="edit" className="w-4 h-4 text-gray-500" />
        </button>
        <button onClick={() => onDelete(method)} className="p-2 rounded-lg hover:bg-red-50">
          <Icon name="trash" className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ConfigPOS() {
  const [methods, setMethods]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null) // null | 'new' | method obj

  const load = async () => {
    setLoading(true)
    try {
      const r = await getTransferMethods()
      setMethods(r.data?.results ?? r.data ?? [])
    } catch (e) {
      toast.error('Error cargando métodos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (m) => {
    if (!window.confirm(`¿Eliminar "${m.display_name}"?`)) return
    try {
      await deleteTransferMethod(m.id)
      toast.success('Eliminado')
      load()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métodos de pago</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            QR y números de transferencia que verá el cliente en el POS
          </p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
          <Icon name="plus" className="w-4 h-4" />
          Agregar método
        </button>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-brand-pink/10 border border-brand-pink/20 p-4 text-sm text-brand-pink flex gap-3">
        <Icon name="info" className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          Cuando el cliente pague por transferencia en el POS, verá automáticamente el QR y
          el número de cada método activo configurado aquí.
        </p>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando…</div>
      ) : methods.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="qr" className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin métodos configurados</p>
          <p className="text-sm mt-1">Agrega Bancolombia, Nequi u otro método de transferencia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(m => (
            <MethodCard
              key={m.id}
              method={m}
              onEdit={(m) => setModal(m)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <MethodModal
          method={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
