import { useEffect, useState } from 'react'
import { getBags, getCupStocks, addBagStock, addCupStock } from '../api'
import toast from 'react-hot-toast'

export default function Inventory() {
  const [bags, setBags] = useState([])
  const [cups, setCups] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(null) // { type: 'bag'|'cup', id, label }
  const [addQty, setAddQty] = useState('')

  const load = async () => {
    const [b, c] = await Promise.all([getBags(), getCupStocks()])
    setBags(b.data.results || b.data)
    setCups(c.data.results || c.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!addQty || Number(addQty) <= 0) return
    try {
      if (adding.type === 'bag') {
        await addBagStock(adding.id, { quantity_ml: Number(addQty), notes: 'Entrada manual' })
      } else {
        await addCupStock(adding.id, { quantity_units: Number(addQty), notes: 'Entrada manual' })
      }
      toast.success('Stock actualizado')
      setAdding(null)
      setAddQty('')
      load()
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-brand-navy">Inventario</h1>

      {/* Bags */}
      <div className="card">
        <h2 className="mb-4">🧊 Bolsas de Sabores (ml)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bags.map(b => (
            <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl border-2 ${b.is_low_stock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{b.flavor_emoji || '🍧'}</span>
                <div>
                  <p className="font-medium text-sm">{b.flavor_name}</p>
                  <p className="text-xs text-gray-400">{b.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`font-bold text-sm ${b.is_low_stock ? 'text-yellow-600' : 'text-gray-800'}`}>
                    {Number(b.stock_ml).toFixed(0)} ml
                  </p>
                  {b.is_low_stock && <p className="text-xs text-yellow-500">⚠️ Stock bajo</p>}
                </div>
                <button onClick={() => setAdding({ type: 'bag', id: b.id, label: b.flavor_name })}
                  className="btn-cyan py-1 px-2 text-xs">+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cups */}
      <div className="card">
        <h2 className="mb-4">🥤 Stock de Vasos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cups.map(c => (
            <div key={c.id} className={`p-3 rounded-xl border-2 text-center ${c.is_low_stock ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100'}`}>
              <div className="text-2xl">🥤</div>
              <p className="font-bold">{c.size_label}</p>
              <p className={`text-lg font-extrabold ${c.is_low_stock ? 'text-yellow-600' : 'text-brand-navy'}`}>{c.quantity}</p>
              {c.is_low_stock && <p className="text-xs text-yellow-500">⚠️ Bajo</p>}
              <button onClick={() => setAdding({ type: 'cup', id: c.id, label: c.size_label })}
                className="btn-cyan py-1 px-3 text-xs mt-2">+ Stock</button>
            </div>
          ))}
        </div>
      </div>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <h2 className="text-brand-navy mb-4">Agregar stock — {adding.label}</h2>
            <label className="label">{adding.type === 'bag' ? 'Mililitros a agregar' : 'Unidades a agregar'}</label>
            <input className="input mb-4" type="number" min="1" placeholder="0"
              value={addQty} onChange={e => setAddQty(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="btn-primary flex-1">Agregar</button>
              <button onClick={() => { setAdding(null); setAddQty('') }} className="btn-secondary flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
