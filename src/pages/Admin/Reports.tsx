import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  Line,
  Legend,
} from 'recharts'
import { getApiUrl } from '@/lib/api'

type ReportData = {
  range_days: number
  range_label: string
  best_items: Array<{ name: string; quantity: number; revenue: number; food_cost: number }>
  worst_items: Array<{ name: string; quantity: number; revenue: number; food_cost: number }>
  hourly_sales: Array<{ hour: number; orders: number; revenue: number }>
  totals: { revenue: number; cash_revenue: number; mpesa_revenue: number; food_cost: number; profit: number; food_cost_ratio: number }
}

type WastageLog = {
  id: number
  item_name: string
  quantity: number
  reason: string
  cost: number
  created_at: string
}

const ReportCard = ({ label, value }: { label: string; value: string }) => ( // Changed styling for ReportCard component.
  <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
    <p className="text-sm text-slate-400">{label}</p>
    <h3 className="text-3xl font-display text-slate-100">{value}</h3>
  </div>
)

const Reports: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null)
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([])
  const [newWastage, setNewWastage] = useState({ item_name: '', quantity: 1, reason: '', cost: 0 })
  const [loading, setLoading] = useState(false)
  const [savingWastage, setSavingWastage] = useState(false)

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl(`/payments/reports/summary/?range=${range}`))
      if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid response");
      const json = await res.json()
      if (res.ok) setData(json)
      else console.error(json)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async () => {
    try {
      const url = getApiUrl(`/payments/reports/download/?range=${range}`)
      const res = await fetch(url)
      if (!res.ok) {
        const errorJson = await res.text().catch(() => 'Download failed')
        console.error(errorJson)
        return
      }

      const blob = await res.blob()
      const filename = res.headers.get('Content-Disposition')?.split('filename=')?.[1]?.replace(/"/g, '') || `tastybites-report.csv`
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchWastage = async () => {
    try {
      const res = await fetch(getApiUrl('/payments/reports/wastage/'))
      if (!res.headers.get("content-type")?.includes("application/json")) return;
      const json = await res.json()
      if (res.ok) setWastageLogs(json.wastage || [])
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchReport()
    fetchWastage()
  }, [range])

  const totalOrders = useMemo(
    () => data?.hourly_sales.reduce((sum, entry) => sum + entry.orders, 0) ?? 0,
    [data]
  )

  const hourlyData = useMemo(() => {
    const hourMap = new Map<number, { orders: number; revenue: number }>()
    data?.hourly_sales.forEach((entry) => {
      hourMap.set(entry.hour, { orders: entry.orders, revenue: entry.revenue })
    })

    return Array.from({ length: 24 }, (_, hour) => {
      const value = hourMap.get(hour) || { orders: 0, revenue: 0 }
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        orders: value.orders,
        revenue: value.revenue,
      }
    })
  }, [data])

  const submitWastage = async () => {
    if (!newWastage.item_name.trim() || newWastage.quantity <= 0) return
    setSavingWastage(true)
    try {
      const adminToken = localStorage.getItem('admin_token')
      const res = await fetch(getApiUrl('/payments/reports/wastage/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(newWastage),
      })
      const json = await res.json()
      if (res.ok) {
        setNewWastage({ item_name: '', quantity: 1, reason: '', cost: 0 })
        fetchWastage()
      } else {
        console.error(json)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setSavingWastage(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-slate-400">Reports</p>
          <h2 className="font-display text-3xl text-slate-100">Sales & Cost Insights</h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Range</label>
          <select
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200"
            value={range}
            onChange={(event) => setRange(event.target.value as 'daily' | 'weekly' | 'monthly')}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button
            type="button"
            onClick={downloadReport}
            className="rounded-full bg-hero-gradient px-5 py-2 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <ReportCard label="Revenue" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.revenue) : 'Loading...'} />
        <ReportCard label="Cash Revenue" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.cash_revenue) : 'Loading...'} />
        <ReportCard label="M-Pesa Revenue" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.mpesa_revenue) : 'Loading...'} />
        <ReportCard label="Food Cost" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.food_cost) : 'Loading...'} />
        <ReportCard label="Profit" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.profit) : 'Loading...'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.7fr_0.3fr] gap-6">
        <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
          <h3 className="font-semibold text-xl text-slate-100 mb-4">Hourly Sales</h3>
          {loading ? (
            <p className="text-slate-400">Loading hourly data…</p>
          ) : (
            <div className="space-y-6">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={hourlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" /> {/* Changed stroke color */}
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#cbd5e1' }} interval={2} minTickGap={10} /> {/* Added fill color */}
                    <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: '#cbd5e1' }} /> {/* Added fill color */}
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#cbd5e1' }} /> {/* Added fill color */}
                    <Tooltip formatter={(value: any) => typeof value === 'number' ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value) : value} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#fb923c" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {hourlyData.slice(0, 24).map((row) => (
                  <div key={row.hour} className="flex items-center justify-between rounded-xl border border-slate-700 p-4"> {/* Changed border and padding */}
                    <span className="text-slate-100">{row.label}</span> {/* Added text color */}
                    <span>{row.orders} orders • {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(row.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
          <h3 className="font-semibold text-xl text-slate-100 mb-4">Food Cost vs Sales</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-700 p-4">
              <p className="text-sm text-slate-400">Revenue</p>
              <p className="text-lg font-semibold text-slate-100">{data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.revenue) : '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-4">
              <p className="text-sm text-slate-400">Food Cost</p>
              <p className="text-lg font-semibold text-slate-100">{data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.food_cost) : '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-4">
              <p className="text-sm text-slate-400">Cost Ratio</p>
              <p className="text-lg font-semibold text-slate-100">{data ? `${data.totals.food_cost_ratio}%` : '-'}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
          <h3 className="font-semibold text-xl text-slate-100 mb-4">Best Selling Items</h3>
          <div className="space-y-3">
            {(data?.best_items || []).map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-700 p-4">
                <p className="font-semibold text-slate-100">{item.name}</p>
                <p className="text-sm text-slate-400">Qty: {item.quantity} • Revenue: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.revenue)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
          <h3 className="font-semibold text-xl text-slate-100 mb-4">Worst Selling Items</h3>
          <div className="space-y-3">
            {(data?.worst_items || []).map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-700 p-4">
                <p className="font-semibold text-slate-100">{item.name}</p>
                <p className="text-sm text-slate-400">Qty: {item.quantity} • Revenue: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.revenue)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <h3 className="font-semibold text-xl text-slate-100">Wastage Tracking</h3>
            <p className="text-sm text-slate-400">Log the food thrown away and track waste cost.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4 mb-4">
          <input
            value={newWastage.item_name}
            onChange={(event) => setNewWastage((cur) => ({ ...cur, item_name: event.target.value }))}
            placeholder="Item name"
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100"
          />
          <input
            type="number"
            min={1}
            value={newWastage.quantity}
            onChange={(event) => setNewWastage((cur) => ({ ...cur, quantity: Number(event.target.value) }))}
            placeholder="Quantity"
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100"
          />
          <input
            value={newWastage.cost}
            onChange={(event) => setNewWastage((cur) => ({ ...cur, cost: Number(event.target.value) }))}
            placeholder="Cost"
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100"
          />
          <input
            value={newWastage.reason}
            onChange={(event) => setNewWastage((cur) => ({ ...cur, reason: event.target.value }))}
            placeholder="Reason"
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100"
          />
        </div>
        <button
          onClick={submitWastage}
          disabled={savingWastage}
          className="rounded-full bg-hero-gradient px-5 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
        >
          {savingWastage ? 'Saving…' : 'Log Waste'}
        </button>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-sm text-slate-400">
                <th className="py-3">Item</th>
                <th className="py-3">Qty</th>
                <th className="py-3">Cost</th>
                <th className="py-3">Reason</th>
                <th className="py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {wastageLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-700 last:border-b-0">
                  <td className="py-3">{log.item_name}</td>
                  <td className="py-3">{log.quantity}</td>
                  <td className="py-3">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(log.cost)}</td>
                  <td className="py-3">{log.reason}</td>
                  <td className="py-3">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Reports
