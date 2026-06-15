import React, { useEffect, useState } from 'react'
import { getApiUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'

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
  
  // Filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['paid', 'bill_pending', 'pending', 'ready'])
  const [limit, setLimit] = useState(100)

  const allStatuses = ['paid', 'pending', 'bill_pending', 'ready', 'completed', 'cancelled']

  const fetchOrders = async (initial = false) => {
    if (initial) {
      setLoading(true)
    }
    const token = getAdminToken()
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (selectedStatuses.length > 0) params.append('statuses', selectedStatuses.join(','))
    params.append('limit', limit.toString())
    
    try {
      const [r, c] = await Promise.all([
        fetch(getApiUrl(`/payments/orders/?${params}`), {
          headers: { Authorization: `Bearer ${token}` }
        }),
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

  // Fetch orders when filters change
  useEffect(() => {
    fetchOrders(true)
  }, [startDate, endDate, selectedStatuses, limit])

  // Auto-refresh and SSE
  useEffect(() => {
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  // Server-Sent Events: subscribe for instant updates when orders change
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(getApiUrl('/payments/stream/'));
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && payload.type === 'order_update') {
            const d = payload.data;
            setOrders(prev => prev.map(o => o.order_id === d.order_id ? { ...o, status: d.status } : o));
          }
        } catch (err) {
          // ignore parse errors
        }
      };
      es.onerror = (err) => {
        console.error('SSE error', err);
        if (es) { es.close(); es = null; }
      };
    } catch (err) {
      console.error('Failed to open EventSource', err);
    }
    return () => { if (es) es.close(); };
  }, []);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
  }

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedStatuses(['paid', 'bill_pending', 'pending', 'ready'])
    setLimit(100)
  }


  return (
    <div>
      {/* Filter Controls */}
      <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase">Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>

          {/* Limit */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 100))}
              min="1"
              max="1000"
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
            />
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-3 py-1 bg-slate-600 text-slate-100 rounded hover:bg-slate-500 text-sm font-semibold"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Status Checkboxes */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">Statuses</label>
          <div className="flex flex-wrap gap-3">
            {allStatuses.map(status => (
              <label key={status} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                  className="w-4 h-4 bg-slate-700 border border-slate-600 rounded"
                />
                <span className="text-xs text-slate-300 capitalize">{status}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? <p className="text-slate-400">Loading...</p> : (
      <table className="w-full text-left">

        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <th className="py-2">Order</th>
            <th>Items</th>
            <th>Qty</th>
            <th>Amount</th>
            <th>Phone</th>
            <th>Status</th>
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

            </tr>
          ))}
        </tbody>
      </table>) }
    </div>
  )
}

export default OrdersTable
