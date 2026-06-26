import { useEffect, useState } from 'react'
import { getShifts, openShift, closeShift, getActiveShift, getShiftDetail, getCashAuditPrefill, createCashAudit } from '../api'
import toast from 'react-hot-toast'

const fmt    = n => `$${Number(n || 0).toLocaleString('es-CO')}`
const fmtDt  = s => new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtHr  = s => new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const fmtDtShort = s => new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ─────────────────────────────────────────────────────────────────────────────
// Hook compartido: carga prefill de la jornada
// ─────────────────────────────────────────────────────────────────────────────
function usePrefill(shiftId) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const reload = () => {
    setLoading(true)
    getCashAuditPrefill({ shift_id: shiftId })
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [shiftId])
  return { data, loading, reload }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen POS — inventario + liquidación
// ─────────────────────────────────────────────────────────────────────────────
function POSResumenModal({ shiftId, onClose }) {
  const { data: p, loading, reload } = usePrefill(shiftId)
  const [saving, setSaving] = useState(false)

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-10 flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Cargando...</span>
      </div>
    </div>
  )
  if (!p) return null

  const cups     = (p.catalog || []).filter(r => r.product_type === 'cup')
  const toppings = (p.catalog || []).filter(r => r.product_type === 'topping')
  const totalLiq = (p.catalog || []).reduce((s, r) => s + (r.sales_revenue || 0), 0)
  const COL = '2fr 110px 70px 110px'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Resumen POS — Jornada #{shiftId}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Liquidación de ventas en punto de venta</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-gray-400">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cards POS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ventas POS</p>
              <p className="text-xl font-bold text-blue-700">{fmt(p.pos_total)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efectivo</p>
              <p className="text-xl font-bold text-gray-800">{fmt(p.pos_cash)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos caja</p>
              <p className="text-xl font-bold text-red-500">- {fmt(p.expenses_from_cash)}</p>
            </div>
            <div className="card p-4 text-center border-2 border-blue-200">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
              <p className="text-xl font-bold text-blue-700">{fmt(p.net_expected_cash)}</p>
            </div>
          </div>

          {/* Tabla liquidación */}
          {(cups.length > 0 || toppings.length > 0) && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Liquidación por producto</h3>
              </div>
              <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-2 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: COL }}>
                <span>Producto / Tipo</span>
                <span className="text-center">Precio unit.</span>
                <span className="text-center">Uds</span>
                <span className="text-center text-emerald-600">Total</span>
              </div>

              {cups.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Vasos</span>
                  </div>
                  {cups.map(row => {
                    const hasRegular = row.regular_qty > 0
                    const hasPromo   = row.promo_qty > 0
                    if (!hasRegular && !hasPromo) return null
                    return (
                      <div key={row.product_name}>
                        {/* Fila nombre del vaso */}
                        <div className="px-4 pt-2.5 pb-0.5">
                          <p className="text-sm font-semibold text-gray-800">{row.product_name}</p>
                        </div>
                        {/* Sub-fila Regular */}
                        {hasRegular && (
                          <div className="grid items-center px-4 py-1.5 border-b border-gray-50 bg-white"
                            style={{ gridTemplateColumns: COL }}>
                            <span className="text-xs text-gray-500 pl-3">Precio regular</span>
                            <span className="text-center text-xs text-gray-500">{fmt(row.unit_price)}</span>
                            <span className="text-center text-sm font-semibold text-gray-700">{row.regular_qty}</span>
                            <span className="text-center text-sm font-bold text-emerald-700">{fmt(row.regular_revenue)}</span>
                          </div>
                        )}
                        {/* Sub-fila Promo */}
                        {hasPromo && (
                          <div className="grid items-center px-4 py-1.5 border-b border-gray-100 bg-amber-50/50"
                            style={{ gridTemplateColumns: COL }}>
                            <span className="text-xs text-amber-700 pl-3">Promoción</span>
                            <span className="text-center text-xs text-amber-600">{row.promo_unit ? fmt(row.promo_unit) : '—'}</span>
                            <span className="text-center text-sm font-semibold text-amber-700">{row.promo_qty}</span>
                            <span className="text-center text-sm font-bold text-amber-700">{fmt(row.promo_revenue)}</span>
                          </div>
                        )}
                        {/* Sub-total del tamaño */}
                        {hasRegular && hasPromo && (
                          <div className="grid items-center px-4 py-1.5 border-b border-gray-200 bg-gray-50"
                            style={{ gridTemplateColumns: COL }}>
                            <span className="text-xs font-semibold text-gray-600 pl-3">Subtotal {row.product_name}</span>
                            <span />
                            <span className="text-center text-sm font-bold text-gray-700">{row.sales_qty}</span>
                            <span className="text-center text-sm font-bold text-emerald-800">{fmt(row.sales_revenue)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}

              {toppings.some(t => t.sales_qty > 0) && (
                <>
                  <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-100">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Toppings sueltos</span>
                  </div>
                  {toppings.filter(t => t.sales_qty > 0).map(row => (
                    <div key={row.product_name} className="grid items-center px-4 py-3 border-b border-gray-50"
                      style={{ gridTemplateColumns: COL }}>
                      <p className="text-sm font-medium text-gray-800">{row.product_name}</p>
                      <span className="text-center text-sm text-gray-500">{fmt(row.unit_price)}</span>
                      <span className="text-center text-sm font-semibold text-gray-700">{row.sales_qty}</span>
                      <span className="text-center text-sm font-bold text-emerald-700">{fmt(row.sales_revenue)}</span>
                    </div>
                  ))}
                </>
              )}

              <div className="grid px-4 py-3 bg-emerald-50 border-t-2 border-emerald-200 font-bold text-emerald-800"
                style={{ gridTemplateColumns: COL }}>
                <span className="text-sm">TOTAL LIQUIDACIÓN POS</span>
                <span /><span />
                <span className="text-center text-base">{fmt(totalLiq)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer: estado del arqueo POS */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {p?.arqueos?.pos ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <span className="font-semibold">POS entregado</span>
              <span className="text-gray-400">·</span>
              <span>{p.arqueos.pos.audited_by}</span>
              <span className="text-gray-400">·</span>
              <span>{fmtDtShort(p.arqueos.pos.created_at)}</span>
            </div>
          ) : (
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await createCashAudit({
                    shift:             shiftId,
                    channel:           'pos',
                    expected_cash:     p.net_expected_cash,
                    expected_transfer: p.pos_transfer,
                    actual_cash:       p.net_expected_cash,
                    actual_transfer:   0,
                  })
                  toast.success('POS marcado como entregado')
                  reload()
                } catch (e) {
                  toast.error(e?.response?.data?.detail || 'Error')
                }
                setSaving(false)
              }}
              className="btn-primary"
            >
              {saving ? 'Guardando...' : 'Marcar como entregado'}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen Domicilios — solo dinero
// ─────────────────────────────────────────────────────────────────────────────
function DomiciliosResumenModal({ shiftId, onClose }) {
  const { data: p, loading, reload } = usePrefill(shiftId)
  const [saving, setSaving] = useState(false)

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-10 flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Cargando...</span>
      </div>
    </div>
  )
  if (!p) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Resumen Domicilios — Jornada #{shiftId}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Dinero recibido por canal de domicilios</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-gray-400">✕</button>
        </div>

        <div className="p-6">
          {p.delivery_total > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total domicilios</p>
                <p className="text-xl font-bold text-orange-600">{fmt(p.delivery_total)}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efectivo</p>
                <p className="text-xl font-bold text-gray-800">{fmt(p.delivery_cash)}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos caja</p>
                <p className="text-xl font-bold text-red-500">- {fmt(p.delivery_expenses_cash)}</p>
              </div>
              <div className="card p-4 text-center border-2 border-orange-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
                <p className="text-xl font-bold text-orange-600">{fmt(p.delivery_net_cash)}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">Esta jornada no tuvo ventas de domicilios.</p>
            </div>
          )}
        </div>

        {/* Footer: estado arqueo Domicilios */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {p?.arqueos?.delivery ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <span className="font-semibold">Domicilios entregado</span>
              <span className="text-gray-400">·</span>
              <span>{p.arqueos.delivery.audited_by}</span>
              <span className="text-gray-400">·</span>
              <span>{fmtDtShort(p.arqueos.delivery.created_at)}</span>
            </div>
          ) : p.delivery_total > 0 ? (
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await createCashAudit({
                    shift:             shiftId,
                    channel:           'delivery',
                    expected_cash:     p.delivery_net_cash,
                    expected_transfer: p.delivery_transfer,
                    actual_cash:       p.delivery_net_cash,
                    actual_transfer:   0,
                  })
                  toast.success('Domicilios marcado como entregado')
                  reload()
                } catch (e) {
                  toast.error(e?.response?.data?.detail || 'Error')
                }
                setSaving(false)
              }}
              className="btn-primary"
            >
              {saving ? 'Guardando...' : 'Marcar como entregado'}
            </button>
          ) : <span />}
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// [LEGACY — no usado] Modal Arqueo con formulario
// ─────────────────────────────────────────────────────────────────────────────
function ArqueoModal({ shiftId, onClose, onSaved }) {
  const [prefill, setPrefill]   = useState(null)
  const [rows, setRows]         = useState([])
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getCashAuditPrefill({ shift_id: shiftId }).then(({ data }) => {
      setPrefill(data)
      setRows((data.catalog || []).map(item => ({
        ...item,
        // opening_stock = vasos que quedaron de la jornada anterior (cierre previo)
        opening_stock: item.prev_closing ?? 0,
        entries: 0,
        // closing_stock = conteo físico de lo que QUEDA al cerrar (empieza vacío para que el admin cuente)
        closing_stock: 0,
      })))
      setActualCash(String(data.net_expected_cash || ''))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [shiftId])

  const updateRow = (idx, field, val) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: Number(val) || 0 } : row))
  }

  const getAvailable = row => (row.opening_stock || 0) + (row.entries || 0)
  const getSold      = row => Math.max(0, getAvailable(row) - (row.closing_stock || 0))

  const cups   = rows.filter(r => r.product_type === 'cup')
  const toppings = rows.filter(r => r.product_type === 'topping')

  const totalByType = (type) => rows.filter(r => r.product_type === type).reduce((s, r) => s + getSold(r), 0)

  const diff = Number(actualCash || 0) - Number(prefill?.net_expected_cash || 0)

  const handleSave = async () => {
    if (!prefill) return
    setSaving(true)
    try {
      await createCashAudit({
        shift:             shiftId,
        expected_cash:     prefill.pos_cash || prefill.expected_cash,
        expected_transfer: prefill.pos_transfer || prefill.expected_transfer,
        actual_cash:       Number(actualCash) || 0,
        actual_transfer:   0,
        notes,
        items: rows.map(r => ({
          product_name:  r.product_name,
          product_type:  r.product_type,
          unit_price:    r.unit_price || 0,
          opening_stock: r.opening_stock || 0,
          entries:       r.entries || 0,
          closing_stock: r.closing_stock || 0,
        })),
      })
      toast.success('Arqueo guardado')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-10 flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Cargando datos...</span>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Arqueo de Jornada #{shiftId}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Inventario físico + reconciliación de caja</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-gray-400">✕</button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── POS ── */}
          {prefill && (
            <>
              <div>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">POS — Caja física</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="card p-4 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ventas POS</p>
                    <p className="text-xl font-bold text-blue-700">{fmt(prefill.pos_total)}</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efectivo POS</p>
                    <p className="text-xl font-bold text-gray-800">{fmt(prefill.pos_cash)}</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos en caja</p>
                    <p className="text-xl font-bold text-red-500">- {fmt(prefill.expenses_from_cash)}</p>
                  </div>
                  <div className="card p-4 text-center border-2 border-blue-200">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
                    <p className="text-xl font-bold text-blue-700">{fmt(prefill.net_expected_cash)}</p>
                  </div>
                </div>
              </div>

              {/* ── Domicilios ── */}
              {prefill.delivery_total > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">Domicilios — Dinero</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="card p-4 text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total domicilios</p>
                      <p className="text-xl font-bold text-orange-600">{fmt(prefill.delivery_total)}</p>
                    </div>
                    <div className="card p-4 text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efectivo</p>
                      <p className="text-xl font-bold text-gray-800">{fmt(prefill.delivery_cash)}</p>
                    </div>
                    <div className="card p-4 text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos en caja</p>
                      <p className="text-xl font-bold text-red-500">- {fmt(prefill.delivery_expenses_cash)}</p>
                    </div>
                    <div className="card p-4 text-center border-2 border-orange-200">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
                      <p className="text-xl font-bold text-orange-600">{fmt(prefill.delivery_net_cash)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tabla de inventario */}
          {rows.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Inventario Físico</h3>
              </div>

              {/* Headers */}
              <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-2 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 110px' }}>
                <span>Producto</span>
                <span className="text-center">Anterior</span>
                <span className="text-center">Entrada</span>
                <span className="text-center">Disponible</span>
                <span className="text-center">Cierre</span>
                <span className="text-center text-blue-600">Vendidos</span>
                <span className="text-center text-emerald-600">Liquidación</span>
              </div>

              {/* Cups section */}
              {cups.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Vasos</span>
                  </div>
                  {cups.map((row, idx) => {
                    const realIdx = rows.indexOf(row)
                    const avail = getAvailable(row)
                    const sold  = getSold(row)
                    return (
                      <div key={idx} className="grid items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50"
                        style={{ gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 110px' }}>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{row.product_name}</p>
                          {row.unit_price > 0 && <p className="text-[11px] text-gray-400">{fmt(row.unit_price)} c/u regular</p>}
                        </div>
                        {/* Anterior: vasos que quedaron de la jornada anterior */}
                        <input type="number" min="0" value={row.opening_stock}
                          onChange={e => updateRow(realIdx, 'opening_stock', e.target.value)}
                          className="input text-center py-1.5 text-sm" />
                        {/* Entrada: vasos ingresados durante esta jornada */}
                        <input type="number" min="0" value={row.entries}
                          onChange={e => updateRow(realIdx, 'entries', e.target.value)}
                          className="input text-center py-1.5 text-sm" />
                        {/* Disponible = Anterior + Entrada */}
                        <span className="text-center text-sm font-semibold text-gray-700">{avail}</span>
                        {/* Cierre: conteo físico de los que QUEDARON al cerrar */}
                        <input type="number" min="0" value={row.closing_stock}
                          onChange={e => updateRow(realIdx, 'closing_stock', e.target.value)}
                          className="input text-center py-1.5 text-sm" />
                        {/* Vendidos = Disponible - Cierre */}
                        <span className={`text-center text-sm font-bold ${sold > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                          {sold}
                        </span>
                        {/* Liquidación: revenue real de ventas (incluye precio promo) */}
                        <div className="text-center">
                          <span className={`text-sm font-bold ${row.sales_revenue > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                            {fmt(row.sales_revenue || 0)}
                          </span>
                          {row.sales_qty > 0 && (
                            <p className="text-[10px] text-gray-400">{row.sales_qty} uds</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div className="grid px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-700"
                    style={{ gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 110px' }}>
                    <span>Total vasos vendidos</span>
                    <span /><span /><span /><span />
                    <span className="text-center text-base">{totalByType('cup')}</span>
                    <span className="text-center text-base text-emerald-700">
                      {fmt(cups.reduce((s, r) => s + (r.sales_revenue || 0), 0))}
                    </span>
                  </div>
                </>
              )}

              {/* Toppings section */}
              {toppings.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-100">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Toppings</span>
                  </div>
                  {toppings.map((row, idx) => {
                    const realIdx = rows.indexOf(row)
                    const avail = getAvailable(row)
                    const sold  = getSold(row)
                    return (
                      <div key={idx} className="grid items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50"
                        style={{ gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 110px' }}>
                        <p className="text-sm font-medium text-gray-800">{row.product_name}</p>
                        <input type="number" min="0" value={row.opening_stock}
                          onChange={e => updateRow(realIdx, 'opening_stock', e.target.value)}
                          className="input text-center py-1.5 text-sm" />
                        <input type="number" min="0" value={row.entries}
                          onChange={e => updateRow(realIdx, 'entries', e.target.value)}
                          className="input text-center py-1.5 text-sm" />
                        <span className="text-center text-sm font-semibold text-gray-700">{avail}</span>
                        <input type="number" min="0" value={row.closing_stock}
                          onChange={e => updateRow(realIdx, 'closing_stock', e.target.value)}
                          className="input text-center py-1.5 text-sm" />
                        <span className={`text-center text-sm font-bold ${sold > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
                          {sold}
                        </span>
                        {/* Revenue de toppings sueltos vendidos */}
                        <div className="text-center">
                          {row.sales_revenue > 0 ? (
                            <>
                              <span className="text-sm font-bold text-emerald-700">{fmt(row.sales_revenue)}</span>
                              <p className="text-[10px] text-gray-400">{row.sales_qty} uds</p>
                            </>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {/* Total general liquidación */}
              {rows.length > 0 && (() => {
                const totalLiq = rows.reduce((s, r) => s + (r.sales_revenue || 0), 0)
                return totalLiq > 0 ? (
                  <div className="grid px-4 py-3 bg-emerald-50 border-t-2 border-emerald-200 text-sm font-bold text-emerald-800"
                    style={{ gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 110px' }}>
                    <span>TOTAL LIQUIDACIÓN JORNADA</span>
                    <span /><span /><span /><span /><span />
                    <span className="text-center text-base">{fmt(totalLiq)}</span>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Reconciliación de caja */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Reconciliación de Caja</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Efectivo esperado (sistema)</label>
                <input className="input bg-gray-50 font-semibold" readOnly
                  value={fmt(prefill?.net_expected_cash)} />
              </div>
              <div>
                <label className="label">Efectivo entregado por encargada</label>
                <input className="input" type="number" placeholder="0"
                  value={actualCash}
                  onChange={e => setActualCash(e.target.value)} />
              </div>
            </div>

            {/* Diferencia */}
            {actualCash !== '' && (
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                diff === 0 ? 'bg-green-50 border border-green-200' :
                diff > 0   ? 'bg-blue-50 border border-blue-200' :
                             'bg-red-50 border border-red-200'
              }`}>
                <span className="text-sm font-semibold">
                  {diff === 0 ? '✅ Cuadre perfecto' : diff > 0 ? '↑ Sobrante' : '↓ Faltante'}
                </span>
                <span className={`text-lg font-bold ${
                  diff === 0 ? 'text-green-700' : diff > 0 ? 'text-blue-700' : 'text-red-600'
                }`}>
                  {diff >= 0 ? '+' : ''}{fmt(diff)}
                </span>
              </div>
            )}

            <div>
              <label className="label">Notas</label>
              <textarea className="input" rows={2} placeholder="Observaciones del arqueo..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar Arqueo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Ver Arqueo guardado
// ─────────────────────────────────────────────────────────────────────────────
function ViewArqueoModal({ arqueoId, shiftId, onClose }) {
  const [audit, setAudit]     = useState(null)
  const [prefill, setPrefill] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getCashAudit(arqueoId),
      getCashAuditPrefill({ shift_id: shiftId }),
    ]).then(([a, p]) => {
      setAudit(a.data)
      setPrefill(p.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [arqueoId, shiftId])

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-10 flex items-center gap-3">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Cargando arqueo...</span>
      </div>
    </div>
  )

  if (!audit) return null

  const cups     = audit.items?.filter(r => r.product_type === 'cup') || []
  const toppings = audit.items?.filter(r => r.product_type === 'topping') || []

  // Merge sales_revenue del prefill en los items del arqueo guardado
  const prefillMap = {}
  ;(prefill?.catalog || []).forEach(c => { prefillMap[c.product_name] = c })

  const totalLiq = (prefill?.catalog || []).reduce((s, c) => s + (c.sales_revenue || 0), 0)
  const diff = Number(audit.actual_cash) - Number(audit.expected_cash)

  const COL = '2fr 80px 80px 80px 80px 80px 110px'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Arqueo #{audit.id} — Jornada #{audit.shift}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Registrado por {audit.audited_by_name || '—'} · {new Date(audit.created_at).toLocaleString('es-CO')}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-gray-400">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* POS */}
          {prefill && (
            <div>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">POS — Caja física</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ventas POS</p>
                  <p className="text-xl font-bold text-blue-700">{fmt(prefill.pos_total)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efectivo POS</p>
                  <p className="text-xl font-bold text-gray-800">{fmt(prefill.pos_cash)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos en caja</p>
                  <p className="text-xl font-bold text-red-500">- {fmt(prefill.expenses_from_cash)}</p>
                </div>
                <div className="card p-4 text-center border-2 border-blue-200">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
                  <p className="text-xl font-bold text-blue-700">{fmt(prefill.net_expected_cash)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Domicilios */}
          {prefill && prefill.delivery_total > 0 && (
            <div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">Domicilios — Dinero</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total domicilios</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(prefill.delivery_total)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efectivo</p>
                  <p className="text-xl font-bold text-gray-800">{fmt(prefill.delivery_cash)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos en caja</p>
                  <p className="text-xl font-bold text-red-500">- {fmt(prefill.delivery_expenses_cash)}</p>
                </div>
                <div className="card p-4 text-center border-2 border-orange-200">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(prefill.delivery_net_cash)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Diferencia caja POS */}
          {audit && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
              diff === 0 ? 'bg-green-50 border border-green-200' :
              diff > 0   ? 'bg-blue-50 border border-blue-200' :
                           'bg-red-50 border border-red-200'
            }`}>
              <span className="text-sm font-semibold text-gray-700">
                Entregado por encargada: {fmt(audit.actual_cash)}
              </span>
              <span className={`text-lg font-bold ${diff === 0 ? 'text-green-700' : diff > 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {diff === 0 ? 'Cuadre perfecto' : diff > 0 ? `Sobrante ${fmt(diff)}` : `Faltante ${fmt(Math.abs(diff))}`}
              </span>
            </div>
          )}

          {/* Tabla inventario */}
          {audit.items?.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Inventario Físico</h3>
              </div>
              {/* Headers */}
              <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-2 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: COL }}>
                <span>Producto</span>
                <span className="text-center">Anterior</span>
                <span className="text-center">Entrada</span>
                <span className="text-center">Disponible</span>
                <span className="text-center">Cierre</span>
                <span className="text-center text-blue-600">Vendidos</span>
                <span className="text-center text-emerald-600">Liquidación</span>
              </div>

              {/* Vasos */}
              {cups.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Vasos</span>
                  </div>
                  {cups.map(row => {
                    const p = prefillMap[row.product_name] || {}
                    return (
                      <div key={row.id} className="grid items-center px-4 py-2.5 border-b border-gray-50"
                        style={{ gridTemplateColumns: COL }}>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{row.product_name}</p>
                          {row.unit_price > 0 && <p className="text-[11px] text-gray-400">{fmt(row.unit_price)} c/u</p>}
                        </div>
                        <span className="text-center text-sm text-gray-700">{row.opening_stock}</span>
                        <span className="text-center text-sm text-gray-700">{row.entries}</span>
                        <span className="text-center text-sm font-semibold text-gray-700">{row.available}</span>
                        <span className="text-center text-sm text-gray-700">{row.closing_stock}</span>
                        <span className={`text-center text-sm font-bold ${row.sold > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{row.sold}</span>
                        <div className="text-center">
                          {p.sales_revenue > 0 ? (
                            <>
                              <span className="text-sm font-bold text-emerald-700">{fmt(p.sales_revenue)}</span>
                              <p className="text-[10px] text-gray-400">{p.sales_qty} uds</p>
                            </>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </div>
                    )
                  })}
                  <div className="grid px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-700"
                    style={{ gridTemplateColumns: COL }}>
                    <span>Total vasos vendidos</span>
                    <span /><span /><span /><span />
                    <span className="text-center">{cups.reduce((s, r) => s + r.sold, 0)}</span>
                    <span className="text-center text-emerald-700">{fmt(cups.reduce((s, r) => s + (prefillMap[r.product_name]?.sales_revenue || 0), 0))}</span>
                  </div>
                </>
              )}

              {/* Toppings */}
              {toppings.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-100">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Toppings</span>
                  </div>
                  {toppings.map(row => {
                    const p = prefillMap[row.product_name] || {}
                    return (
                      <div key={row.id} className="grid items-center px-4 py-2.5 border-b border-gray-50"
                        style={{ gridTemplateColumns: COL }}>
                        <p className="text-sm font-medium text-gray-800">{row.product_name}</p>
                        <span className="text-center text-sm text-gray-700">{row.opening_stock}</span>
                        <span className="text-center text-sm text-gray-700">{row.entries}</span>
                        <span className="text-center text-sm font-semibold text-gray-700">{row.available}</span>
                        <span className="text-center text-sm text-gray-700">{row.closing_stock}</span>
                        <span className={`text-center text-sm font-bold ${row.sold > 0 ? 'text-purple-700' : 'text-gray-400'}`}>{row.sold}</span>
                        <div className="text-center">
                          {p.sales_revenue > 0 ? (
                            <>
                              <span className="text-sm font-bold text-emerald-700">{fmt(p.sales_revenue)}</span>
                              <p className="text-[10px] text-gray-400">{p.sales_qty} uds</p>
                            </>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {/* Total general */}
              {totalLiq > 0 && (
                <div className="grid px-4 py-3 bg-emerald-50 border-t-2 border-emerald-200 text-sm font-bold text-emerald-800"
                  style={{ gridTemplateColumns: COL }}>
                  <span>TOTAL LIQUIDACIÓN JORNADA</span>
                  <span /><span /><span /><span /><span />
                  <span className="text-center text-base">{fmt(totalLiq)}</span>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          {audit.notes && (
            <div className="card p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notas</p>
              <p className="text-sm text-gray-700">{audit.notes}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de detalle de jornada
// ─────────────────────────────────────────────────────────────────────────────
function ShiftDetail({ shift, onBack, onShiftUpdate }) {
  const [channel, setChannel]   = useState('all')
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showPOS, setShowPOS]           = useState(false)
  const [showDom, setShowDom]           = useState(false)
  const [expandedSale, setExpandedSale] = useState(null)

  const load = async (ch = channel) => {
    setLoading(true)
    try {
      const { data } = await getShiftDetail(shift.id, ch)
      setDetail(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load(channel) }, [channel])

  const CHANNELS = [
    { key: 'all',      label: 'Todos' },
    { key: 'pos',      label: 'POS' },
    { key: 'delivery', label: 'Domicilios' },
  ]

  const PAYMENT_LABELS = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto' }
  const PAYMENT_BADGE  = { cash: 'badge-gray', transfer: 'badge-cyan', mixed: 'badge-lime' }
  const CAT_LABELS = {
    business: 'Negocio', personal: 'Personal', supply: 'Mercancía', petty_cash: 'Caja Menor',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost px-2 py-1.5 text-gray-400">← Volver</button>
        <div className="flex-1">
          <h1>Jornada #{shift.id}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmtDt(shift.opened_at)}
            {shift.closed_at && ` → ${fmtDt(shift.closed_at)}`}
          </p>
        </div>
        <span className={`badge-${shift.status === 'open' ? 'lime' : 'gray'} text-xs`}>
          {shift.status === 'open' ? 'Abierta' : 'Cerrada'}
        </span>
        {shift.status === 'closed' && (
          <div className="flex gap-2">
            <button onClick={() => setShowPOS(true)}
              className={`text-xs py-1.5 px-3 ${detail?.arqueos?.pos ? 'badge-lime cursor-pointer' : 'btn-secondary'}`}>
              {detail?.arqueos?.pos ? 'POS entregado' : 'Resumen POS'}
            </button>
            <button onClick={() => setShowDom(true)}
              className={`text-xs py-1.5 px-3 ${detail?.arqueos?.delivery ? 'badge-lime cursor-pointer' : 'btn-secondary'}`}>
              {detail?.arqueos?.delivery ? 'Domicilios entregado' : 'Resumen Domicilios'}
            </button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {CHANNELS.map(c => (
          <button key={c.key}
            onClick={() => setChannel(c.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              channel === c.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && detail && (
        <>
          {/* KPI cards — cambian según el canal seleccionado */}
          {channel === 'all' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <p className="stat-label">Total (POS + Domicilios)</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{fmt(detail.summary.all_total)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Efectivo POS</p>
                <p className="text-xl font-bold text-green-600 tabular-nums">{fmt(detail.summary.pos_cash)}</p>
                <p className="text-xs text-gray-400">Transfer: {fmt(detail.summary.pos_transfer)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Caja Domicilios</p>
                <p className="text-xl font-bold text-purple-600 tabular-nums">{fmt(detail.summary.dom_cash)}</p>
                <p className="text-xs text-gray-400">Transfer: {fmt(detail.summary.dom_transfer)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Gastos jornada</p>
                <p className="text-xl font-bold text-red-500 tabular-nums">- {fmt(detail.summary.total_expenses)}</p>
                <p className="text-xs text-gray-400">
                  Neto efectivo: {fmt((detail.summary.pos_cash || 0) - (detail.summary.total_expenses || 0))}
                </p>
              </div>
            </div>
          )}

          {channel === 'pos' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <p className="stat-label">Total POS</p>
                <p className="text-xl font-bold text-blue-700 tabular-nums">{fmt(detail.summary.pos_total)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Efectivo POS</p>
                <p className="text-xl font-bold text-green-600 tabular-nums">{fmt(detail.summary.pos_cash)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Transferencias POS</p>
                <p className="text-xl font-bold text-indigo-600 tabular-nums">{fmt(detail.summary.pos_transfer)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Gastos jornada</p>
                <p className="text-xl font-bold text-red-500 tabular-nums">- {fmt(detail.summary.pos_expenses)}</p>
                <p className="text-xs text-gray-400">
                  Neto: {fmt((detail.summary.pos_cash || 0) - (detail.summary.pos_expenses || 0))}
                </p>
              </div>
            </div>
          )}

          {channel === 'delivery' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <p className="stat-label">Total Domicilios</p>
                <p className="text-xl font-bold text-purple-600 tabular-nums">{fmt(detail.summary.dom_total)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Efectivo Domicilios</p>
                <p className="text-xl font-bold text-green-600 tabular-nums">{fmt(detail.summary.dom_cash)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Transferencias Domicilios</p>
                <p className="text-xl font-bold text-indigo-600 tabular-nums">{fmt(detail.summary.dom_transfer)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Gastos domicilios</p>
                <p className="text-xl font-bold text-red-500 tabular-nums">- {fmt(detail.summary.dom_expenses)}</p>
              </div>
            </div>
          )}

          {/* Ventas */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2>Ventas</h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-navy border border-blue-100">
                  Jornada #{detail.shift.id} · {new Date(detail.shift.opened_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>
              <span className="text-xs text-gray-400">{detail.sales.length} registros</span>
            </div>
            {/* Header tabla — mismo estilo que Billing */}
            {detail.sales.length > 0 && (
              <div className="grid px-5 py-3 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
                style={{ gridTemplateColumns: '40px 130px 60px 1fr 100px 90px 90px 24px' }}>
                {['#', 'Factura', 'Hora', 'Vendedora', 'Total', 'Canal', 'Pago', ''].map(h => <span key={h}>{h}</span>)}
              </div>
            )}
            {detail.sales.length === 0
              ? <p className="text-center text-gray-400 text-sm py-8">Sin ventas en este canal</p>
              : (
                <div className="divide-y divide-gray-50">
                  {detail.sales.map((s, idx) => {
                    const saleNum = detail.sales.length - idx
                    const isOpen = expandedSale === s.id
                    return (
                      <div key={s.id}>
                        {/* Fila principal — mismo grid que Billing */}
                        <button
                          type="button"
                          onClick={() => setExpandedSale(isOpen ? null : s.id)}
                          className="w-full grid px-5 py-3.5 items-center gap-3 hover:bg-slate-50 text-left transition-colors"
                          style={{ gridTemplateColumns: '40px 130px 60px 1fr 100px 90px 90px 24px' }}
                        >
                          <span className="text-sm font-semibold text-gray-500">#{saleNum}</span>
                          <span className="font-mono font-semibold text-brand-navy text-sm">
                            {s.invoice_number || '—'}
                          </span>
                          <span className="text-sm tabular-nums text-gray-500">{fmtHr(s.created_at)}</span>
                          <span className="text-sm text-gray-700 truncate">{s.seller}</span>
                          <span className="text-sm font-bold text-brand-pink tabular-nums">{fmt(s.total)}</span>
                          <span className={`badge text-xs w-fit ${
                            s.is_courtesy ? 'bg-pink-100 text-pink-600' :
                            s.is_delivery ? 'badge-cyan' : 'badge-pink'}`}>
                            {s.is_courtesy ? 'Cortesía' : s.is_delivery ? 'Domicilio' : 'POS'}
                          </span>
                          <span className={`badge text-xs w-fit ${PAYMENT_BADGE[s.payment_method] ?? 'badge-gray'}`}>
                            {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {/* Detalle expandible */}
                        {isOpen && (
                          <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 space-y-2">
                            {/* Items */}
                            {(s.items || []).length > 0 && (
                              <div className="space-y-1.5">
                                {s.items.map((item, idx) => (
                                  <div key={idx} className="flex items-start justify-between gap-2">
                                    <div className="text-xs text-gray-700 flex-1">
                                      <span className="font-semibold">
                                        {item.cup_size ? `Vaso ${item.cup_size}` : item.topping || 'Ítem'}
                                        {item.qty > 1 && ` ×${item.qty}`}
                                      </span>
                                      {item.flavors?.length > 0 && (
                                        <span className="text-gray-400"> · {item.flavors.join(' + ')}</span>
                                      )}
                                      {item.topping && item.cup_size && (
                                        <span className="text-gray-400"> · {item.topping}</span>
                                      )}
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 shrink-0">{fmt(item.subtotal)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Pago */}
                            <div className="border-t border-gray-200 pt-2 flex flex-col gap-0.5 text-xs text-gray-500">
                              {/* Bloque cortesía — igual que en Facturas */}
                              {s.is_courtesy ? (
                                <div className="p-3 bg-pink-50 border border-pink-100 rounded-xl space-y-1 mb-1">
                                  <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide">Cortesía</p>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Valor de la factura</span>
                                    <span className="font-medium text-gray-700">{fmt(s.total)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Dinero recibido</span>
                                    <span className="font-medium text-green-600">{fmt(s.courtesy_paid || 0)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm border-t border-pink-100 pt-1">
                                    <span className="text-gray-500">Gasto generado</span>
                                    <span className="font-bold text-red-500">{fmt(Number(s.total) - Number(s.courtesy_paid || 0))}</span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {(s.payment_method === 'cash' || s.payment_method === 'mixed') && (
                                    <div className="flex justify-between">
                                      <span>Efectivo recibido</span>
                                      <span>{fmt(s.cash_received)}</span>
                                    </div>
                                  )}
                                  {s.change_given > 0 && (
                                    <div className="flex justify-between">
                                      <span>Cambio</span>
                                      <span>{fmt(s.change_given)}</span>
                                    </div>
                                  )}
                                  {s.transfer_amount > 0 && (
                                    <div className="flex justify-between">
                                      <span>Transferencia</span>
                                      <span>{fmt(s.transfer_amount)}</span>
                                    </div>
                                  )}
                                  {s.transfer_reference && (
                                    <div className="flex justify-between">
                                      <span>Referencia</span>
                                      <span className="font-mono">{s.transfer_reference}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {s.notes && (
                                <div className="flex justify-between gap-4">
                                  <span>Notas</span>
                                  <span className="text-right text-gray-600">{s.notes}</span>
                                </div>
                              )}
                            </div>
                            {/* Total / Recibido */}
                            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                              <span className="text-xs font-semibold text-gray-500">
                                {s.is_courtesy ? 'Recibido' : 'Total'}
                              </span>
                              <span className="text-base font-bold text-brand-pink">
                                {fmt(s.is_courtesy ? (s.courtesy_paid || 0) : s.total)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
            {detail.sales.length > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-sm font-semibold">
                <span className="text-gray-600">Total ({channel === 'all' ? 'todos los canales' : CHANNELS.find(c=>c.key===channel)?.label})</span>
                <span className="text-gray-900">{fmt(detail.summary.total_sales)}</span>
              </div>
            )}
          </div>

          {/* Gastos */}
          {detail.expenses.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2>Gastos de la jornada</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-navy border border-blue-100">
                    Jornada #{detail.shift.id} · {new Date(detail.shift.opened_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{detail.expenses.length} registros</span>
              </div>

              {/* Header — mismo estilo que Expenses.jsx */}
              <div className="grid px-5 py-2.5 bg-slate-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest gap-3"
                style={{ gridTemplateColumns: '60px 130px 80px 1fr 90px 90px 80px' }}>
                {['Hora', 'Categoría', 'Canal', 'Descripción', 'Caja', 'Método', 'Monto'].map(h => (
                  <span key={h}>{h}</span>
                ))}
              </div>

              <div className="divide-y divide-gray-50">
                {detail.expenses.map(e => {
                  const CAT_BADGE = {
                    business:   'bg-blue-50 text-blue-700',
                    personal:   'bg-purple-50 text-purple-700',
                    petty_cash: 'bg-amber-50 text-amber-700',
                    supply:     'bg-green-50 text-green-700',
                  }
                  const ORIGIN_BADGE = { pos: 'badge-pink', delivery: 'badge-cyan' }
                  const CAT_LABEL = {
                    business: 'Negocio', personal: 'Personal',
                    petty_cash: 'Caja Menor', supply: 'Mercancía',
                  }
                  return (
                    <div key={e.id}
                      className="grid px-5 py-3 items-center gap-3 hover:bg-slate-50 transition-colors"
                      style={{ gridTemplateColumns: '60px 130px 80px 1fr 90px 90px 80px' }}>
                      <span className="text-sm tabular-nums text-gray-500">{fmtHr(e.created_at)}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${CAT_BADGE[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CAT_LABEL[e.category] ?? e.category}
                      </span>
                      <span className={`badge text-xs w-fit ${ORIGIN_BADGE[e.origin] ?? 'badge-gray'}`}>
                        {e.origin === 'delivery' ? 'Domicilios' : 'POS'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${e.from_daily_cash ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {e.from_daily_cash ? 'Sí' : 'No'}
                      </span>
                      {e.from_daily_cash ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${
                          e.payment_method === 'transfer' ? 'bg-cyan-50 text-cyan-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {e.payment_method === 'transfer' ? 'Transf.' : 'Efectivo'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                      <span className={`text-sm font-bold tabular-nums ${e.from_daily_cash ? 'text-red-500' : 'text-gray-400'}`}>
                        {fmt(e.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {(() => {
                const afectaCaja = detail.expenses.filter(e => e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)
                const noAfecta   = detail.expenses.filter(e => !e.from_daily_cash).reduce((s, e) => s + Number(e.amount), 0)
                const totalG     = afectaCaja + noAfecta
                return (
                  <div className="px-5 py-3 bg-red-50 border-t border-red-100 space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Gastos que afectan caja</span>
                      <span className="font-semibold text-red-500">- {fmt(afectaCaja)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Gastos que no afectan caja</span>
                      <span className="font-semibold text-gray-400">- {fmt(noAfecta)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-red-100">
                      <span className="text-sm font-bold text-red-700">Total gastos</span>
                      <span className="text-sm font-bold text-red-600">- {fmt(totalG)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {showPOS && (
        <POSResumenModal shiftId={shift.id} onClose={() => setShowPOS(false)} />
      )}

      {showDom && (
        <DomiciliosResumenModal shiftId={shift.id} onClose={() => setShowDom(false)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal: lista de jornadas
// ─────────────────────────────────────────────────────────────────────────────
export default function Shifts() {
  const [shifts, setShifts]       = useState([])
  const [active, setActive]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)

  const load = async () => {
    setLoading(true)
    const [s, a] = await Promise.all([getShifts(), getActiveShift()])
    setShifts(s.data.results || s.data)
    setActive(a.data.shift)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleOpen = async () => {
    try { await openShift(); toast.success('Jornada abierta'); load() } catch {}
  }
  const handleClose = async () => {
    if (!confirm('¿Cerrar jornada actual?')) return
    try { await closeShift(); toast.success('Jornada cerrada'); load() } catch {}
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Vista de detalle
  if (selected) return (
    <ShiftDetail
      shift={selected}
      onBack={() => setSelected(null)}
      onShiftUpdate={load}
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Jornadas</h1>
        {active
          ? <button onClick={handleClose} className="btn-danger">Cerrar Jornada</button>
          : <button onClick={handleOpen} className="btn-lime">Abrir Jornada</button>
        }
      </div>

      {active && (
        <div className="card border-green-300 border-2 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-green-800 text-sm">Jornada activa #{active.id}</p>
              <p className="text-xs text-gray-500 mt-0.5">Abierta: {fmtDt(active.opened_at)}</p>
            </div>
            <button onClick={() => setSelected(active)} className="btn-secondary text-xs py-1.5">
              Ver detalle →
            </button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2>Historial de jornadas</h2>
        </div>
        {/* Header */}
        <div className="grid px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-widest"
          style={{ gridTemplateColumns: '60px 1fr 1fr 90px 90px' }}>
          <span>#</span>
          <span>Apertura</span>
          <span>Cierre</span>
          <span className="text-center">Estado</span>
          <span className="text-center">Arqueo</span>
        </div>
        <div className="divide-y divide-gray-50">
          {shifts.map(s => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className="grid px-5 py-3.5 items-center cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ gridTemplateColumns: '60px 1fr 1fr 90px 90px' }}
            >
              <span className="text-sm font-semibold text-gray-700">#{s.id}</span>
              <span className="text-sm text-gray-600">{fmtDt(s.opened_at)}</span>
              <span className="text-sm text-gray-400">{s.closed_at ? fmtDt(s.closed_at) : '—'}</span>
              <span className="text-center">
                <span className={`badge-${s.status === 'open' ? 'lime' : 'gray'}`}>
                  {s.status === 'open' ? 'Abierta' : 'Cerrada'}
                </span>
              </span>
              <span className="text-center text-xs text-gray-400">
                {s.has_audit ? <span className="badge-cyan">Listo</span> : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
