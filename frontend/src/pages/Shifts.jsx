import { useEffect, useState } from 'react'
import { getShifts, openShift, closeShift, getActiveShift, getShiftDetail, getCashAuditPrefill, createCashAudit } from '../api'
import toast from 'react-hot-toast'

const fmt    = n => `$${Number(n || 0).toLocaleString('es-CO')}`
const fmtDt  = s => new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtHr  = s => new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

// ─────────────────────────────────────────────────────────────────────────────
// Modal Arqueo
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
      // Inicializar filas del catálogo con closing_stock sugerido = current_stock
      setRows((data.catalog || []).map(item => ({
        ...item,
        opening_stock: 0,
        entries: 0,
        closing_stock: item.current_stock ?? 0,
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

          {/* KPI del sistema */}
          {prefill && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ventas POS</p>
                <p className="text-xl font-bold text-blue-700">{fmt(prefill.pos_total)}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gastos del día</p>
                <p className="text-xl font-bold text-red-500">- {fmt(prefill.expenses_from_cash)}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Neto a entregar</p>
                <p className="text-xl font-bold text-gray-900">{fmt(prefill.net_expected_cash)}</p>
              </div>
            </div>
          )}

          {/* Tabla de inventario */}
          {rows.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Inventario Físico</h3>
              </div>

              {/* Headers */}
              <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-2 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: '2fr 90px 90px 90px 90px 90px' }}>
                <span>Producto</span>
                <span className="text-center">Anterior</span>
                <span className="text-center">Entradas</span>
                <span className="text-center">Disponible</span>
                <span className="text-center">Cierre</span>
                <span className="text-center text-blue-600">Vendidos</span>
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
                        style={{ gridTemplateColumns: '2fr 90px 90px 90px 90px 90px' }}>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{row.product_name}</p>
                          {row.unit_price > 0 && <p className="text-[11px] text-gray-400">{fmt(row.unit_price)} c/u</p>}
                        </div>
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
                        <span className={`text-center text-sm font-bold ${sold > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                          {sold}
                        </span>
                      </div>
                    )
                  })}
                  <div className="grid px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-700"
                    style={{ gridTemplateColumns: '2fr 90px 90px 90px 90px 90px' }}>
                    <span>Total vasos vendidos</span>
                    <span /><span /><span /><span />
                    <span className="text-center text-base">{totalByType('cup')}</span>
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
                        style={{ gridTemplateColumns: '2fr 90px 90px 90px 90px 90px' }}>
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
                      </div>
                    )
                  })}
                </>
              )}
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
// Panel de detalle de jornada
// ─────────────────────────────────────────────────────────────────────────────
function ShiftDetail({ shift, onBack, onShiftUpdate }) {
  const [channel, setChannel]   = useState('all')
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showArqueo, setShowArqueo] = useState(false)
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
          detail?.arqueo
            ? <span className="badge-cyan text-xs">Arqueo #{detail.arqueo.id}</span>
            : <button onClick={() => setShowArqueo(true)} className="btn-primary text-xs py-1.5 px-3">
                + Crear Arqueo
              </button>
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
              <h2>Ventas</h2>
              <span className="text-xs text-gray-400">{detail.sales.length} registros</span>
            </div>
            {detail.sales.length === 0
              ? <p className="text-center text-gray-400 text-sm py-8">Sin ventas en este canal</p>
              : (
                <div className="divide-y divide-gray-50">
                  {detail.sales.map(s => {
                    const isOpen = expandedSale === s.id
                    return (
                      <div key={s.id}>
                        {/* Fila principal — clickeable */}
                        <button
                          type="button"
                          onClick={() => setExpandedSale(isOpen ? null : s.id)}
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 text-left transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">#{s.id}</span>
                              {s.is_delivery && <span className="badge-cyan text-[10px]">Domicilio</span>}
                              {s.is_courtesy && <span className="badge-amber text-[10px]">Cortesía</span>}
                              <span className="text-xs text-gray-400">{s.seller}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fmtHr(s.created_at)} · {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                              {s.transfer_amount > 0 && ` · Transfer: ${fmt(s.transfer_amount)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-gray-900">{fmt(s.total)}</span>
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
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
                              {s.payment_method === 'cash' || s.payment_method === 'mixed' ? (
                                <div className="flex justify-between">
                                  <span>Efectivo recibido</span>
                                  <span>{fmt(s.cash_received)}</span>
                                </div>
                              ) : null}
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
                              {s.is_courtesy && s.courtesy_paid > 0 && (
                                <div className="flex justify-between">
                                  <span>Pagado (cortesía)</span>
                                  <span>{fmt(s.courtesy_paid)}</span>
                                </div>
                              )}
                              {s.notes && (
                                <div className="flex justify-between gap-4">
                                  <span>Notas</span>
                                  <span className="text-right text-gray-600">{s.notes}</span>
                                </div>
                              )}
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
                <h2>Gastos de la jornada</h2>
                <span className="text-xs text-gray-400">{detail.expenses.length} registros</span>
              </div>
              <div className="divide-y divide-gray-50">
                {detail.expenses.map(e => (
                  <div key={e.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{e.description}</p>
                      <p className="text-xs text-gray-400">{CAT_LABELS[e.category] || e.category}</p>
                    </div>
                    <span className="text-sm font-bold text-red-500">- {fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex justify-between text-sm font-semibold">
                <span className="text-red-700">Total gastos</span>
                <span className="text-red-600">- {fmt(detail.summary.total_expenses)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {showArqueo && (
        <ArqueoModal
          shiftId={shift.id}
          onClose={() => setShowArqueo(false)}
          onSaved={() => { load(); onShiftUpdate && onShiftUpdate() }}
        />
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
