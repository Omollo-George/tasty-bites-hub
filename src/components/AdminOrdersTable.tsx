import React, { useEffect, useState } from 'react'
import { getApiUrl } from '@/lib/api'

const Badge: React.FC<{status:string}> = ({status}) => {
  const normalized = (status || '').toLowerCase()
  const cls = normalized === 'paid'
    ? 'bg-emerald-900/30 text-emerald-400'
    : normalized === 'pending' || normalized === 'preparing' || normalized === 'ready'
    ? 'bg-amber-900/30 text-amber-400'
    : 'bg-red-900/30 text-red-400'
  return <span className={`px-3 py-1 rounded-full text-sm ${cls}`}>{status}</span>
}

const OrdersTable: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [rate, setRate] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  // Edit price flow removed from admin Orders section.


  const fetchOrders = async (initial = false) => {
    if (initial) {
      setLoading(true)
    }
    try {
      const [r, c] = await Promise.all([
        fetch(getApiUrl('/payments/orders/')),
        fetch(getApiUrl('/payments/config/')),
      ])

      if (!r.ok || !c.ok) return;
      if (!r.headers.get("content-type")?.includes("application/json") || !c.headers.get("content-type")?.includes("application/json")) return;

      const j = await r.json()
      const cfg = await c.json()
      setOrders(j.results || [])
      setRate(cfg?.conversion_rate || 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Handle scale: Auto-refresh the dashboard every 3 seconds for real-time tracking
  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (order_id: string, status: string) => {
    const token = localStorage.getItem('admin_token') || ''
    
    // Optimistic UI Update: Instantly update the local state for high-volume responsiveness
    const previousOrders = [...orders];
    setOrders(current => current.map(o => 
      o.order_id === order_id ? { ...o, status } : o
    ));

    try {
      const r = await fetch(getApiUrl(`/payments/orders/${encodeURIComponent(order_id)}/update/`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      const j = await r.json()
      if (r.ok) {
        // Status confirmed by server
      } else {
        // Rollback on failure
        setOrders(previousOrders);
        alert(j.error || 'Failed')
      }
    } catch (e) {
      console.error(e)
      setOrders(previousOrders);
      const message = e instanceof Error ? e.message : String(e)
      alert(`Network error: ${message}`)
    }
  }

  return (
    <div>
      {loading ? <p>Loading...</p> : (
      <table className="w-full text-left">

        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <th className="py-2">Order</th>
            <th>Items</th>
            <th>Qty</th>
            <th>Amount</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((s) => (
            <tr key={s.order_id} className="border-t border-slate-700 hover:bg-slate-600 transition-colors">
              <td className="py-3 font-mono text-sm">{s.order_id}</td>
              <td>{s.table || 'Takeaway'}</td>
              <td>{s.item_count}</td>
              <td>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format((s.total_amount || 0) * rate)}</td>
              <td>{s.phone}</td>
              <td><Badge status={s.status} /></td>
              <td className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateStatus(s.order_id, 'completed')}
                  className="px-2 py-1 rounded bg-green-600 text-white"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => updateStatus(s.order_id, 'cancelled')}
                  className="px-2 py-1 rounded bg-red-600 text-white"
                >
                  Cancel
                </button>
              </td>

            </tr>
          ))}
        </tbody>
      </table>) }
    </div>
  )
}

export default OrdersTable
