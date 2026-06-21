import { useEffect, useState } from 'react'
import { getInvoices } from '../api'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInvoices().then(r => {
      setInvoices(r.data.results || r.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-brand-navy">Facturas</h1>
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="pb-3 pr-4">Número</th>
                <th className="pb-3 pr-4">Hora</th>
                <th className="pb-3 pr-4">Vendedora</th>
                <th className="pb-3 pr-4">Total</th>
                <th className="pb-3 pr-4">Pago</th>
                <th className="pb-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length === 0 && (
                <tr><td colSpan="6" className="py-8 text-center text-gray-400">Sin facturas</td></tr>
              )}
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="py-3 pr-4 font-mono font-medium text-brand-navy">{inv.invoice_number}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(inv.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 pr-4">{inv.sale_detail?.seller_name || '—'}</td>
                  <td className="py-3 pr-4 font-bold text-brand-pink">{fmt(inv.sale_detail?.total || 0)}</td>
                  <td className="py-3 pr-4">
                    <span className="badge-gray capitalize">{inv.sale_detail?.payment_method}</span>
                  </td>
                  <td className="py-3">
                    {inv.voided
                      ? <span className="badge-pink">Anulada</span>
                      : <span className="badge-lime">Válida</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
