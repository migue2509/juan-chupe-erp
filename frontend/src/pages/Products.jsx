import { useEffect, useState } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import {
  getAllFlavors, createFlavor, updateFlavor, deleteFlavor,
  getAllCupSizes, createCupSize, updateCupSize, deleteCupSize,
  getAllToppings, createTopping, updateTopping, deleteTopping,
  updateBag,
} from '../api'
import { Icon } from '../components/Icons'
import toast from 'react-hot-toast'

const FLAVOR_CATS = [
  { value: 'creamy',        label: 'Cremoso' },
  { value: 'refreshing',    label: 'Refrescante' },
  { value: 'non_alcoholic', label: 'Sin Alcohol' },
]

const TABS = [
  { key: 'bags',     label: 'Bolsas de Granizado', icon: 'products' },
  { key: 'cups',     label: 'Vasos',               icon: 'cup' },
  { key: 'toppings', label: 'Toppings',            icon: 'promotions' },
]

const EMPTY_FLAVOR  = { name: '', category: 'water', emoji: '🍓', min_stock_ml: 500 }

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:border-gray-300 transition-all bg-white">
        <span className="text-2xl leading-none">{value || '❓'}</span>
        <span className="text-sm text-gray-400">Cambiar emoji</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="shadow-2xl rounded-2xl overflow-hidden">
            <Picker
              data={data}
              locale="es"
              onEmojiSelect={(em) => { onChange(em.native); setOpen(false) }}
              theme="light"
              previewPosition="none"
              skinTonePosition="none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
const EMPTY_CUP     = { size: '', ml: '', price: '', min_quantity: 10 }
const EMPTY_TOPPING = { name: '', price: 2000, min_stock: 0, linked_category: '' }

const TOPPING_CATS = [
  { value: 'creamy',       label: 'Bolsa Cremosos (auto)' },
  { value: 'refreshing',   label: 'Bolsa Refrescantes (auto)' },
  { value: 'non_alcoholic',label: 'Bolsa Sin Alcohol (auto)' },
]

const fmt     = (n) => `$${Number(n).toLocaleString('es-CO')}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''

function Timestamp({ label, date }) {
  return (
    <span className="text-[11px] text-gray-400 whitespace-nowrap" title={date}>
      {label}: {fmtDate(date)} {fmtTime(date)}
    </span>
  )
}

// Inline edit row
function EditRow({ fields, initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  return (
    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-3 items-end">
      {fields.map(f => (
        <div key={f.key} style={{ width: f.width || 140 }}>
          <label className="label">{f.label}</label>
          {f.type === 'select' ? (
            <select className="input text-sm" value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === 'emoji' ? (
            <EmojiPicker value={form[f.key]} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
          ) : (
            <input className="input text-sm" type={f.type || 'text'} placeholder={f.placeholder}
              value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          )}
        </div>
      ))}
      <div className="flex gap-2 pb-0.5">
        <button onClick={() => onSave(form)} disabled={saving} className="btn-primary py-1.5 text-xs">
          {saving
            ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Icon name="check" className="w-3.5 h-3.5" />}
          Guardar
        </button>
        <button onClick={onCancel} className="btn-secondary py-1.5 text-xs">Cancelar</button>
      </div>
    </div>
  )
}

// Row action buttons
function RowActions({ isActive, onToggle, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
          isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}>
        {isActive ? 'Activo' : 'Inactivo'}
      </button>
      <button onClick={onEdit} title="Editar"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button onClick={onDelete} title="Eliminar"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  )
}

export default function Products() {
  const [tab, setTab] = useState('bags')
  const [flavors,  setFlavors]  = useState([])
  const [cups,     setCups]     = useState([])
  const [toppings, setToppings] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [flavorForm,  setFlavorForm]  = useState(EMPTY_FLAVOR)
  const [cupForm,     setCupForm]     = useState(EMPTY_CUP)
  const [toppingForm, setToppingForm] = useState(EMPTY_TOPPING)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    try {
      const [f, c, t] = await Promise.all([getAllFlavors(), getAllCupSizes(), getAllToppings()])
      setFlavors(f.data?.results ?? f.data ?? [])
      setCups(c.data?.results ?? c.data ?? [])
      setToppings(t.data?.results ?? t.data ?? [])
    } catch {}
  }

  useEffect(() => { load() }, [])

  const handleTabChange = (key) => { setTab(key); setShowCreate(false); setEditing(null); setSearch('') }

  const q = search.toLowerCase()
  const filteredFlavors  = q ? flavors.filter(f  => f.name.toLowerCase().includes(q))  : flavors
  const filteredCups     = q ? cups.filter(c    => c.size.toLowerCase().includes(q))    : cups
  const filteredToppings = q ? toppings.filter(t => t.name.toLowerCase().includes(q))   : toppings
  const confirmDelete = (name) => confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)

  // ── FLAVORS ──
  const handleFlavorCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await createFlavor({ name: flavorForm.name, category: flavorForm.category, emoji: flavorForm.emoji, min_stock_ml: flavorForm.min_stock_ml })
      toast.success(`Bolsa "${flavorForm.name}" creada`)
      setFlavorForm(EMPTY_FLAVOR); setShowCreate(false); load()
    } catch { toast.error('Error al crear bolsa') }
    setSaving(false)
  }
  const handleFlavorSave = async (form) => {
    setSaving(true)
    try {
      await updateFlavor(editing.id, { name: form.name, category: form.category, emoji: form.emoji })
      if (editing.bagId && form.min_stock_ml !== undefined) {
        await updateBag(editing.bagId, { min_stock_ml: Number(form.min_stock_ml) })
      }
      toast.success('Bolsa actualizada'); setEditing(null); load()
    } catch { toast.error('Error al actualizar') }
    setSaving(false)
  }
  const handleFlavorDelete = async (f) => {
    if (!confirmDelete(f.name)) return
    try { await deleteFlavor(f.id); toast.success(`"${f.name}" eliminado`); load() }
    catch { toast.error('No se puede eliminar si tiene stock o ventas asociadas') }
  }
  const toggleFlavor = async (f) => {
    await updateFlavor(f.id, { is_active: !f.is_active })
    toast.success(f.is_active ? 'Desactivado' : 'Activado'); load()
  }

  // ── CUPS ──
  const handleCupCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await createCupSize({ size: cupForm.size, ml: Number(cupForm.ml), price: Number(cupForm.price), min_quantity: Number(cupForm.min_quantity) })
      toast.success(`Vaso "${cupForm.size}" creado`)
      setCupForm(EMPTY_CUP); setShowCreate(false); load()
    } catch { toast.error('Error al crear vaso') }
    setSaving(false)
  }
  const handleCupSave = async (form) => {
    setSaving(true)
    try {
      await updateCupSize(editing.id, { size: form.size, ml: Number(form.ml), price: Number(form.price), min_quantity: Number(form.min_quantity) })
      toast.success('Vaso actualizado'); setEditing(null); load()
    } catch { toast.error('Error al actualizar') }
    setSaving(false)
  }
  const handleCupDelete = async (c) => {
    if (!confirmDelete(c.size)) return
    try { await deleteCupSize(c.id); toast.success(`"${c.size}" eliminado`); load() }
    catch { toast.error('No se puede eliminar si tiene ventas asociadas') }
  }
  const toggleCup = async (c) => {
    await updateCupSize(c.id, { is_active: !c.is_active })
    toast.success(c.is_active ? 'Desactivado' : 'Activado'); load()
  }

  // ── TOPPINGS ──
  const handleToppingCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await createTopping({ ...toppingForm, price: Number(toppingForm.price), linked_category: toppingForm.linked_category || null })
      toast.success(`Topping "${toppingForm.name}" creado`)
      setToppingForm(EMPTY_TOPPING); setShowCreate(false); load()
    } catch { toast.error('Error al crear topping') }
    setSaving(false)
  }
  const handleToppingSave = async (form) => {
    setSaving(true)
    try {
      await updateTopping(editing.id, {
        name: form.name,
        price: Number(form.price),
        min_stock: Number(form.min_stock),
        linked_category: form.linked_category || null,
      })
      toast.success('Topping actualizado'); setEditing(null); load()
    } catch { toast.error('Error al actualizar') }
    setSaving(false)
  }
  const handleToppingDelete = async (t) => {
    if (!confirmDelete(t.name)) return
    try { await deleteTopping(t.id); toast.success(`"${t.name}" eliminado`); load() }
    catch { toast.error('No se puede eliminar si está en uso') }
  }
  const toggleTopping = async (t) => {
    await updateTopping(t.id, { is_active: !t.is_active })
    toast.success(t.is_active ? 'Desactivado' : 'Activado'); load()
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Productos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vasos, bolsas de granizado y toppings</p>
        </div>
        <button onClick={() => { setShowCreate(v => !v); setEditing(null) }} className="btn-primary">
          <Icon name="plus" className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon name={t.icon} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ CREATE FORMS ══ */}

      {showCreate && tab === 'bags' && (
        <div className="card border-l-4 border-brand-pink">
          <h2 className="mb-4">Nueva Bolsa de Granizado</h2>
          <form onSubmit={handleFlavorCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Nombre del sabor</label>
                <input className="input" placeholder="Ej: Fresa, Mango, Limón" required
                  value={flavorForm.name} onChange={e => setFlavorForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={flavorForm.category}
                  onChange={e => setFlavorForm(f => ({ ...f, category: e.target.value }))}>
                  {FLAVOR_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Emoji del sabor</label>
                <EmojiPicker value={flavorForm.emoji} onChange={v => setFlavorForm(f => ({ ...f, emoji: v }))} />
              </div>
              <div>
                <label className="label">Stock mínimo (ml)</label>
                <input type="number" className="input" placeholder="500" value={flavorForm.min_stock_ml}
                  onChange={e => setFlavorForm(f => ({ ...f, min_stock_ml: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Alerta cuando baje de este valor</p>
              </div>
              <div className="flex items-end">
                <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-700">
                  Al agregar al inventario se suman <strong>6,500 ml</strong> por bolsa.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Crear Bolsa
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showCreate && tab === 'cups' && (
        <div className="card border-l-4 border-brand-cyan">
          <h2 className="mb-4">Nuevo Vaso</h2>
          <form onSubmit={handleCupCreate} className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="label">Nombre / Tamaño</label>
                <input className="input" placeholder="Ej: 8oz, Grande" required
                  value={cupForm.size} onChange={e => setCupForm(f => ({ ...f, size: e.target.value }))} />
              </div>
              <div>
                <label className="label">Mililitros</label>
                <input type="number" className="input" placeholder="473" required
                  value={cupForm.ml} onChange={e => setCupForm(f => ({ ...f, ml: e.target.value }))} />
              </div>
              <div>
                <label className="label">Precio (COP)</label>
                <input type="number" className="input" placeholder="5000" required
                  value={cupForm.price} onChange={e => setCupForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="label">Mínimo (unidades)</label>
                <input type="number" className="input" placeholder="10"
                  value={cupForm.min_quantity} onChange={e => setCupForm(f => ({ ...f, min_quantity: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-cyan">
                {saving && <span className="w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />}
                Crear Vaso
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {showCreate && tab === 'toppings' && (
        <div className="card border-l-4 border-brand-purple">
          <h2 className="mb-4">Nuevo Topping</h2>
          <form onSubmit={handleToppingCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="label">Nombre</label>
                <input className="input" placeholder="Ej: Bolsa Cremosos, Gomitas" required
                  value={toppingForm.name} onChange={e => setToppingForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Precio de venta</label>
                <input type="number" className="input" placeholder="2000"
                  value={toppingForm.price} onChange={e => setToppingForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="label">Mínimo (unidades)</label>
                <input type="number" className="input" placeholder="0"
                  value={toppingForm.min_stock} onChange={e => setToppingForm(f => ({ ...f, min_stock: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Bolsa automática para categoría</label>
                <select className="input" value={toppingForm.linked_category}
                  onChange={e => setToppingForm(f => ({ ...f, linked_category: e.target.value }))}>
                  <option value="">Sin descuento automático</option>
                  {TOPPING_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Si asignas una categoría, esta bolsa se descuenta automáticamente en cada venta de ese tipo de sabor.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Crear Topping
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* ══ BOLSAS ══ */}
      {tab === 'bags' && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <input className="input py-1.5 text-sm w-52" placeholder="Buscar bolsa..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
            style={{ gridTemplateColumns: '2.5rem 1fr 140px 100px 1fr 180px' }}>
            {['', 'Nombre', 'Categoría', 'Mín. ml', 'Fechas', 'Acciones'].map(h => <span key={h}>{h}</span>)}
          </div>
          <div className="divide-y divide-gray-50">
            {filteredFlavors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                <Icon name="products" className="w-10 h-10 mb-2" />
                <p className="text-sm">No hay bolsas registradas</p>
              </div>
            ) : filteredFlavors.map(f => (
              <div key={f.id}>
                {editing?.type === 'flavor' && editing.id === f.id ? (
                  <EditRow
                    fields={[
                      { key: 'name',         label: 'Nombre',    width: 160 },
                      { key: 'category',     label: 'Categoría', type: 'select', width: 180, options: FLAVOR_CATS.map(c => ({ value: c.value, label: c.label })) },
                      { key: 'emoji',        label: 'Emoji',     type: 'emoji',  width: 300 },
                      { key: 'min_stock_ml', label: 'Mín. ml',  type: 'number', width: 100, placeholder: '500' },
                    ]}
                    initial={{ name: f.name, category: f.category, emoji: f.emoji ?? '', min_stock_ml: f.bag?.min_stock_ml ?? 500 }}
                    onSave={handleFlavorSave}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                ) : (
                  <div className={`grid px-5 py-3 items-center gap-3 hover:bg-slate-50 transition-colors ${!f.is_active ? 'opacity-40' : ''}`}
                    style={{ gridTemplateColumns: '2.5rem 1fr 140px 100px 1fr 180px' }}>
                    <span className="text-2xl leading-none">{f.emoji || '❓'}</span>
                    <span className="font-medium text-sm text-gray-800">{f.name}</span>
                    <span className="text-sm text-gray-500">
                      {FLAVOR_CATS.find(c => c.value === f.category)?.label ?? f.category}
                    </span>
                    <span className="text-sm text-gray-600 tabular-nums">{f.bag?.min_stock_ml ?? '—'} ml</span>
                    <div className="flex flex-col gap-0.5">
                      <Timestamp label="Creado" date={f.created_at} />
                      <Timestamp label="Editado" date={f.updated_at} />
                    </div>
                    <RowActions
                      isActive={f.is_active}
                      onToggle={() => toggleFlavor(f)}
                      onEdit={() => setEditing({ type: 'flavor', id: f.id, bagId: f.bag?.id })}
                      onDelete={() => handleFlavorDelete(f)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ VASOS ══ */}
      {tab === 'cups' && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <input className="input py-1.5 text-sm w-52" placeholder="Buscar vaso..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
            style={{ gridTemplateColumns: '1fr 100px 130px 110px 1fr 180px' }}>
            {['Nombre', 'ml', 'Precio', 'Mín. uds.', 'Fechas', 'Acciones'].map(h => <span key={h}>{h}</span>)}
          </div>
          <div className="divide-y divide-gray-50">
            {filteredCups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                <Icon name="cup" className="w-10 h-10 mb-2" />
                <p className="text-sm">No hay vasos registrados</p>
              </div>
            ) : filteredCups.map(c => (
              <div key={c.id}>
                {editing?.type === 'cup' && editing.id === c.id ? (
                  <EditRow
                    fields={[
                      { key: 'size',         label: 'Nombre',    width: 130 },
                      { key: 'ml',           label: 'ml',        type: 'number', width: 90 },
                      { key: 'price',        label: 'Precio',    type: 'number', width: 110 },
                      { key: 'min_quantity', label: 'Mín. uds', type: 'number', width: 90 },
                    ]}
                    initial={{ size: c.size, ml: String(c.ml), price: String(c.price), min_quantity: String(c.min_quantity ?? 10) }}
                    onSave={handleCupSave}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                ) : (
                  <div className={`grid px-5 py-3.5 items-center gap-3 hover:bg-slate-50 transition-colors ${!c.is_active ? 'opacity-40' : ''}`}
                    style={{ gridTemplateColumns: '1fr 100px 130px 110px 1fr 180px' }}>
                    <span className="font-semibold text-sm text-gray-800">{c.size}</span>
                    <span className="text-sm text-gray-500">{Number(c.ml).toFixed(0)} ml</span>
                    <span className="text-sm font-semibold text-gray-900">{fmt(c.price)}</span>
                    <span className="text-sm text-gray-600">{c.min_quantity ?? 10} uds.</span>
                    <div className="flex flex-col gap-0.5">
                      <Timestamp label="Creado" date={c.created_at} />
                      <Timestamp label="Editado" date={c.updated_at} />
                    </div>
                    <RowActions
                      isActive={c.is_active}
                      onToggle={() => toggleCup(c)}
                      onEdit={() => setEditing({ type: 'cup', id: c.id })}
                      onDelete={() => handleCupDelete(c)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ TOPPINGS ══ */}
      {tab === 'toppings' && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <input className="input py-1.5 text-sm w-52" placeholder="Buscar topping..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
            style={{ gridTemplateColumns: '1fr 90px 100px 160px 1fr 180px' }}>
            {['Nombre', 'Precio', 'Mín. uds.', 'Bolsa auto', 'Fechas', 'Acciones'].map(h => <span key={h}>{h}</span>)}
          </div>
          <div className="divide-y divide-gray-50">
            {filteredToppings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                <Icon name="promotions" className="w-10 h-10 mb-2" />
                <p className="text-sm">No hay toppings registrados</p>
              </div>
            ) : filteredToppings.map(t => (
              <div key={t.id}>
                {editing?.type === 'topping' && editing.id === t.id ? (
                  <EditRow
                    fields={[
                      { key: 'name',           label: 'Nombre',    width: 180 },
                      { key: 'price',          label: 'Precio',    type: 'number', width: 90 },
                      { key: 'min_stock',      label: 'Mín. uds', type: 'number', width: 80 },
                      { key: 'linked_category', label: 'Bolsa auto', type: 'select', width: 160,
                        options: [{ value: '', label: 'Sin auto' }, ...TOPPING_CATS.map(c => ({ value: c.value, label: c.label }))] },
                    ]}
                    initial={{ name: t.name, price: String(t.price ?? 2000), min_stock: String(t.min_stock ?? 0), linked_category: t.linked_category ?? '' }}
                    onSave={handleToppingSave}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                ) : (
                  <div className={`grid px-5 py-3.5 items-center gap-3 hover:bg-slate-50 transition-colors ${!t.is_active ? 'opacity-40' : ''}`}
                    style={{ gridTemplateColumns: '1fr 90px 100px 160px 1fr 180px' }}>
                    <span className="font-semibold text-sm text-gray-800">{t.name}</span>
                    <span className="text-sm font-semibold text-brand-pink">{fmt(t.price ?? 2000)}</span>
                    <span className="text-sm text-gray-600">{t.min_stock ?? 0} uds.</span>
                    <span>
                      {t.linked_category
                        ? <span className="badge-cyan text-xs">{TOPPING_CATS.find(c => c.value === t.linked_category)?.label ?? t.linked_category}</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <Timestamp label="Creado" date={t.created_at} />
                      <Timestamp label="Editado" date={t.updated_at} />
                    </div>
                    <RowActions
                      isActive={t.is_active}
                      onToggle={() => toggleTopping(t)}
                      onEdit={() => setEditing({ type: 'topping', id: t.id })}
                      onDelete={() => handleToppingDelete(t)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
