import React, { useEffect, useState } from 'react'
import { getApiUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'

const Totals: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [rate, setRate] = useState<number>(1)

  useEffect(() => {
    const load = async () => {
      const token = getAdminToken()
      const headers = { Authorization: `Bearer ${token}` }
      try {
        const [o, c] = await Promise.all([
          fetch(getApiUrl('/payments/orders/'), { headers }),
          fetch(getApiUrl('/payments/config/'), { headers })
        ])

        if (!o.ok || !c.ok) {
          console.error("Dashboard failed to load data:", o.status, c.status);
          return;
        }

        if (!o.headers.get("content-type")?.includes("application/json") || !c.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Invalid response format");
        }

        const oj = await o.json()
        const cj = await c.json()
        setOrders(oj.results || [])
        setRate(cj?.conversion_rate || 1)
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  const paidOrders = orders.filter(o => o.is_paid)
  const totalOrders = orders.length
  const pending = orders.filter(o => {
    const status = (o.status || '').toLowerCase()
    return !o.is_paid && !['paid', 'completed', 'cancelled'].includes(status)
  }).length
  const revenue = paidOrders.reduce((s, o) => s + ((o.total_amount || 0)), 0) * rate

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <p className="text-sm text-slate-400">Total Orders</p>
        <h3 className="text-3xl font-display text-slate-100">{totalOrders}</h3>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <p className="text-sm text-slate-400">Pending Payments</p>
        <h3 className="text-3xl font-display text-slate-100">{pending}</h3>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <p className="text-sm text-slate-400">Revenue (24h)</p>
        <h3 className="text-3xl font-display text-slate-100">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(revenue)}</h3>
      </div>
    </div>
  )
}

export default Totals
