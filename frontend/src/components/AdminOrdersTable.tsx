import React, { useEffect, useState } from 'react'
import { getApiUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'

const normalizeStatus = (status: string, isPaid?: boolean) => {
  if (isPaid) return 'paid'
  const normalized = (status || '').toLowerCase()
  return normalized === 'paid' ? 'paid' : 'pending'
}

const Badge: React.FC<{status:string; isPaid?: boolean}> = ({status, isPaid}) => {
  const normalized = normalizeStatus(status, isPaid)
  const cls = normalized === 'paid'
    ? 'bg-emerald-900/30 text-emerald-400'
    : 'bg-amber-900/30 text-amber-400'
  return (
    <span style={{minWidth: 84, display: 'inline-block', textAlign: 'center'}}>
      <span className={`px-3 py-1 rounded-full text-sm inline-block ${cls}`} style={{transition: 'opacity 160ms ease'}}>
        {normalized === 'paid' ? 'Paid' : 'Pending'}
      </span>
    </span>
  )
}

const OrdersTable: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [cachedOrders, setCachedOrders] = useState<any[]>([])
  const [rate, setRate] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  
  // Filter state
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [waiterFilter, setWaiterFilter] = useState<'all' | number | ''>('all')
  const [limit, setLimit] = useState(100)
  const [employees, setEmployees] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)

  const statusOptions: Array<{ value: 'all' | 'pending' | 'paid'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
  ]

  const requestIdRef = React.useRef(0)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const sseDebounceRef = React.useRef<number | null>(null)

  const fetchOrders = async (initial = false, waiterOverride: number | string | undefined = undefined) => {
    if (initial) {
      setLoading(true)
    }
    // bump request id to allow ignoring out-of-order responses
    requestIdRef.current += 1
    const reqId = requestIdRef.current
    // cancel any previous in-flight request
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    } catch (e) {}
    const controller = new AbortController()
    abortControllerRef.current = controller
    const token = getAdminToken()
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (statusFilter !== 'all') params.append('statuses', statusFilter)
    const wf = waiterOverride !== undefined ? waiterOverride : waiterFilter
    if (wf !== 'all' && wf !== '') params.append('waiter_id', String(wf))
    params.append('limit', limit.toString())
    
    try {
      const [r, c] = await Promise.all([
        fetch(getApiUrl(`/payments/orders/?${params}`), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
        fetch(getApiUrl('/payments/config/'), { signal: controller.signal }),
      ])

      if (!r.ok || !c.ok) return;
      if (!r.headers.get("content-type")?.includes("application/json") || !c.headers.get("content-type")?.includes("application/json")) return;

      const j = await r.json()
      const cfg = await c.json()
      // ignore this response if a newer request was issued
      if (reqId !== requestIdRef.current) return
      const results = (j.results || []).map((order: any) => ({
        ...order,
        status: normalizeStatus(order.status, order.is_paid),
      }))
      if (typeof j.total === 'number') setTotalCount(j.total)
      // update cache
      setCachedOrders(results)
      // only update visible list automatically when showing All
      if (statusFilter === 'all') {
        const prevMap = new Map(orders.map(o => [o.order_id, o]))
        const merged = results.map((r: any) => ({ ...(prevMap.get(r.order_id) || {}), ...r }))
        // preserve window and container scroll
        const winY = window.scrollY
        const contTop = containerRef.current ? containerRef.current.scrollTop : 0
        setOrders(merged)
        requestAnimationFrame(() => {
          window.scrollTo(0, winY)
          if (containerRef.current) containerRef.current.scrollTop = contTop
        })
      }
      setRate(cfg?.conversion_rate || 1)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Fetch orders when date/limit filters change. Status changes filter client-side.
  useEffect(() => {
    fetchOrders(true)
  }, [startDate, endDate, limit])

  // Fetch employees for waiter dropdown
  useEffect(() => {
    const token = getAdminToken()
    fetch(getApiUrl('/payments/admin/employees/'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && j.employees) {
          // Only include employees whose role indicates they are waiters
          const waiters = j.employees.filter((e:any) => ((e.role || '').toLowerCase().includes('waiter')))
          setEmployees(waiters)
        }
      })
      .catch(() => {})
  }, [])

  const assignWaiter = async (orderId: string, waiterId: string) => {
    if (!waiterId) return
    setAssigningOrderId(orderId)
    try {
      const token = getAdminToken()
      const res = await fetch(getApiUrl(`/payments/orders/${encodeURIComponent(orderId)}/update/`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ waiter_id: waiterId }),
      })
      if (!res.ok) {
        console.error('Failed to assign waiter', res.status)
        return
      }
      const json = await res.json()
      const updatedOrder = json.order || json
      const normalizedStatus = normalizeStatus(updatedOrder.status, updatedOrder.is_paid)
      setOrders(prev => prev.map(o => o.order_id === updatedOrder.order_id ? { ...o, ...updatedOrder, status: normalizedStatus } : o))
      setCachedOrders(prev => prev.map(o => o.order_id === updatedOrder.order_id ? { ...o, ...updatedOrder, status: normalizedStatus } : o))
    } catch (err) {
      console.error(err)
    } finally {
      setAssigningOrderId(null)
    }
  }

  // Auto-refresh: only enable periodic polling for the full (All) view.
  useEffect(() => {
    if (statusFilter !== 'all') return
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  // Server-Sent Events: subscribe for instant updates when orders change
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/payments/stream/');
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && payload.type === 'order_update') {
            // Debounce SSE-triggered refetches to batch rapid updates and
            // avoid small layout jumps caused by frequent refreshes.
            if (sseDebounceRef.current) window.clearTimeout(sseDebounceRef.current)
            sseDebounceRef.current = window.setTimeout(() => {
              fetchOrders()
              sseDebounceRef.current = null
            }, 300)
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
  }, [statusFilter]);

  // old checkbox toggle removed; using explicit status selector now

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setStatusFilter('all')
    setWaiterFilter('all')
    setLimit(100)
  }

  const updateVisibleFromCache = (preserve = true, waiterOverride: number | string | undefined = undefined) => {
    const wf = waiterOverride !== undefined ? waiterOverride : waiterFilter
    let filtered = cachedOrders
    if (statusFilter !== 'all') filtered = filtered.filter((o:any) => normalizeStatus(o.status) === statusFilter)
    if (wf !== 'all' && wf !== '') filtered = filtered.filter((o:any) => Number(o.waiter_id) === Number(wf))
    if (!preserve) {
      setOrders(filtered)
      return
    }
    const winY = window.scrollY
    const contTop = containerRef.current ? containerRef.current.scrollTop : 0
    setOrders(filtered)
    requestAnimationFrame(() => {
      window.scrollTo(0, winY)
      if (containerRef.current) containerRef.current.scrollTop = contTop
    })
  }


  return (
    <div ref={containerRef}>
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
            <select
              value={limit === 9999 ? 'all' : String(limit)}
              onChange={(e) => setLimit(e.target.value === 'all' ? 9999 : Math.max(1, parseInt(e.target.value) || 100))}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="all">All</option>
            </select>
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

        {/* Waiter filter + total count */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Waiter</label>
            <select className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm" value={waiterFilter === 'all' ? 'all' : String(waiterFilter)} onChange={(e) => {
              const v = e.target.value
              const next = v === 'all' ? 'all' : Number(v)
              // update visible list immediately using selected value to avoid stale-state clears
              updateVisibleFromCache(true, next)
              // trigger a server fetch using override so it doesn't rely on async setState
              fetchOrders(false, next)
              setWaiterFilter(next)
            }}>
              <option value="all">All Waiters</option>
              {employees.map(emp => (
                <option key={emp.id} value={String(emp.id)}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-300">
            {totalCount !== null ? <span>Total: <strong className="text-white">{totalCount}</strong></span> : null}
          </div>
        </div>

        {/* Status Selector */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">Statuses</label>
          <div className="flex flex-wrap gap-3">
            {statusOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusFilter(option.value)
                  // update visible from cache immediately to avoid jumps
                  const next = option.value
                  const filtered = next === 'all'
                    ? cachedOrders
                    : cachedOrders.filter((o:any) => normalizeStatus(o.status, o.is_paid) === next)
                  if (containerRef.current) {
                    const st = containerRef.current.scrollTop
                    setOrders(filtered)
                    requestAnimationFrame(() => { if (containerRef.current) containerRef.current.scrollTop = st })
                  } else {
                    setOrders(filtered)
                  }
                }}
                className={`px-3 py-2 rounded text-sm font-semibold ${statusFilter === option.value ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? <p className="text-slate-400">Loading...</p> : (
      <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/10">
        <table className="min-w-[820px] w-full text-left">

          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-2" style={{width: '28%'}}>Order</th>
            <th style={{width: '20%'}}>Items</th>
            <th style={{width: '8%'}}>Qty</th>
            <th style={{width: '14%'}}>Amount</th>
            <th style={{width: '15%'}}>Phone</th>
              <th style={{width: '12%'}}>Waiter</th>
              <th style={{width: '15%'}}>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((s) => (
            <tr key={s.order_id} className="border-t border-slate-700 hover:bg-slate-600 transition-colors" style={{height: 56}}>
              <td className="py-3 font-mono text-sm truncate" style={{paddingTop: 12, paddingBottom: 12}}>{s.order_id}</td>
              <td className="truncate" style={{paddingTop: 12, paddingBottom: 12}}>{s.table || 'Takeaway'}</td>
              <td className="truncate" style={{paddingTop: 12, paddingBottom: 12}}>{s.item_count}</td>
              <td className="font-mono text-right truncate" style={{paddingTop: 12, paddingBottom: 12}}>
                <div className="inline-block bg-slate-900/30 text-emerald-300 px-3 py-1 rounded text-right" style={{minWidth: 110}}>
                  {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format((s.total_amount || 0) * rate)}
                </div>
              </td>
              <td className="text-sm truncate" style={{paddingTop: 12, paddingBottom: 12}}>
                <div className="inline-block bg-slate-800/40 text-slate-100 px-3 py-1 rounded" style={{minWidth: 120}}>
                  {s.phone || '-'}
                </div>
              </td>
              <td className="text-sm truncate" style={{paddingTop: 12, paddingBottom: 12}}>
                <select
                  value={s.waiter_id ?? ''}
                  disabled={assigningOrderId === s.order_id}
                  onChange={(e) => assignWaiter(s.order_id, e.target.value)}
                  className="w-full px-2 py-1 bg-slate-800/40 border border-slate-600 text-slate-100 rounded text-sm"
                >
                  <option value="">{s.waiter_name ? `Assigned: ${s.waiter_name}` : 'Assign waiter'}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.special_id ? `${emp.special_id} - ${emp.name}` : emp.name}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{paddingTop: 12, paddingBottom: 12}}><Badge status={s.status} /></td>

            </tr>
          ))}
        </tbody>
      </table>
      </div>) }
    </div>
  )
}

export default OrdersTable
