import { useEffect, useState } from 'react'
import { getDailyReport, getWeeklyReport, getMonthlyReport } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const fmt = n => `$${Number(n).toLocaleString('es-CO')}`

export default function Reports() {
  const [tab, setTab] = useState('daily')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      let res
      if (tab === 'daily') res = await getDailyReport()
      else if (tab === 'weekly') res = await getWeeklyReport()
      else res = await getMonthlyReport()
      setData(res.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  return (
    <div className="space-y-6">
      <h1 className="text-brand-navy">Reportes</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {['daily', 'weekly', 'monthly'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-brand-pink text-white shadow-neon' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-pink'}`}>
            {t === 'daily' ? '📅 Diario' : t === 'weekly' ? '📆 Semanal' : '🗓 Mensual'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>
      ) : data && (
        <div className="space-y-4">
          {/* Daily report */}
          {tab === 'daily' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card border-l-4 border-brand-pink">
                  <span className="stat-label">Total Ventas</span>
                  <span className="stat-value text-brand-pink">{fmt(data.total_sales)}</span>
                </div>
                <div className="stat-card border-l-4 border-brand-cyan">
                  <span className="stat-label">Efectivo</span>
                  <span className="stat-value text-cyan-700">{fmt(data.total_cash)}</span>
                </div>
                <div className="stat-card border-l-4 border-brand-purple">
                  <span className="stat-label">Transferencias</span>
                  <span className="stat-value text-brand-purple">{fmt(data.total_transfer)}</span>
                </div>
                <div className="stat-card border-l-4 border-red-400">
                  <span className="stat-label">Gastos</span>
                  <span className="stat-value text-red-500">{fmt(data.total_expenses)}</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* By cup size */}
                <div className="card">
                  <h2 className="text-sm font-semibold mb-3">Ventas por Tamaño</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.cup_sales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="cup_size__size" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="total" fill="#FF0099" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Flavor sales */}
                <div className="card">
                  <h2 className="text-sm font-semibold mb-3">Sabores más vendidos (ml)</h2>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.entries(
                      data.flavor_sales.reduce((acc, { flavor, ml }) => {
                        acc[flavor] = (acc[flavor] || 0) + ml
                        return acc
                      }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([name, ml]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span>{name}</span>
                        <span className="font-medium text-brand-pink">{ml.toFixed(0)} ml</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card border-t-4 border-brand-lime">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Neto en Caja</span>
                  <span className="text-xl font-bold text-brand-lime">{fmt(data.net_cash)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">(Efectivo - Gastos del negocio)</p>
              </div>
            </>
          )}

          {/* Weekly report */}
          {tab === 'weekly' && (
            <div className="card">
              <h2 className="mb-4">Últimos 7 días</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="total" fill="#00E5FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-between">
                <span className="text-gray-500 text-sm">Total 7 días</span>
                <span className="font-bold text-brand-cyan">{fmt(data.grand_total)}</span>
              </div>
            </div>
          )}

          {/* Monthly report */}
          {tab === 'monthly' && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="stat-card border-l-4 border-brand-pink">
                <span className="stat-label">{data.month}</span>
                <span className="stat-value text-brand-pink">{fmt(data.total_sales)}</span>
                <span className="text-xs text-gray-400">Ventas totales</span>
              </div>
              <div className="stat-card border-l-4 border-red-400">
                <span className="stat-label">Gastos</span>
                <span className="stat-value text-red-500">{fmt(data.total_expenses)}</span>
              </div>
              <div className="stat-card border-l-4 border-brand-lime">
                <span className="stat-label">Neto</span>
                <span className="stat-value text-green-600">{fmt(data.net)}</span>
                <span className="text-xs text-gray-400">{data.shifts_count} jornadas</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
