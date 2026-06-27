import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  Line,
  Legend,
  Area,
} from 'recharts'
import { getApiUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'

type ReportData = {
  range_days: number
  range_label: string
  best_items: Array<{ name: string; quantity: number; revenue: number; food_cost: number }>
  worst_items: Array<{ name: string; quantity: number; revenue: number; food_cost: number }>
  hourly_sales: Array<{ hour: number; label: string; orders: number; revenue: number }>
  best_waiter?: { waiter_id?: number | null; waiter_name: string; orders: number }
  least_waiter?: { waiter_id?: number | null; waiter_name: string; orders: number }
  totals: { revenue: number; cash_revenue: number; mpesa_revenue: number; food_cost: number; wastage: number; miscellaneous: number; profit: number; food_cost_ratio: number }
}

type WastageLog = {
  id: number
  item_name: string
  quantity: number
  reason: string
  cost: number
  created_at: string
}

type MiscExpenseLog = {
  id: number
  item_name: string
  reason: string
  cost: number
  created_at: string
}

const ReportCard = ({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) => (
  <div className="bg-slate-800 p-5 rounded-xl shadow-card border border-slate-700 min-h-[140px] flex flex-col justify-between overflow-hidden">
    <p className="text-sm text-slate-400 break-words">{label}</p>
    <h3 className={`text-2xl sm:text-3xl font-display font-semibold leading-tight break-words whitespace-normal ${valueClassName || 'text-slate-100'}`}>{value}</h3>
  </div>
)

const Reports: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null)
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [selectedPeriodType, setSelectedPeriodType] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('week');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([]);
  const [miscLogs, setMiscLogs] = useState<MiscExpenseLog[]>([]);
  const [newWastage, setNewWastage] = useState({ item_name: '', quantity: 1, reason: '', cost: 0 })
  const [newMisc, setNewMisc] = useState({ item_name: '', reason: '', cost: 0 })
  const [loading, setLoading] = useState(false)
  const [savingWastage, setSavingWastage] = useState(false)
  const [savingMisc, setSavingMisc] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const makeReportParams = () => {
    const params = new URLSearchParams({ period_type: selectedPeriodType })
    if (selectedPeriodType === 'custom') {
      params.set('start_date', customStartDate)
      params.set('end_date', customEndDate)
    } else {
      params.set('date', selectedDate)
    }
    return params
  }

  const makeAuthHeaders = (token?: string | null): Record<string, string> => {
    if (!token) return {}
    return {
      Authorization: `Bearer ${token}`,
      'X-ADMIN-TOKEN': token,
    }
  }

  const parseJsonResponse = async (res: Response) => {
    const bodyText = await res.text()
    if (!res.headers.get('content-type')?.includes('application/json')) {
      return { bodyText, json: null }
    }

    try {
      return { bodyText, json: bodyText ? JSON.parse(bodyText) : null }
    } catch (err) {
      console.error('Invalid JSON from API:', err, bodyText)
      return { bodyText, json: null }
    }
  }

  const getApiErrorMessage = (res: Response, bodyText: string, json: any) => {
    if (json?.message && json?.error) {
      return `${json.error}: ${json.message}`
    }
    if (json?.message) {
      return json.message
    }
    if (json?.error) {
      return json.error
    }
    if (bodyText) {
      return bodyText
    }
    return `Request failed with status ${res.status} ${res.statusText}`
  }

  const withAdminToken = (url: string, token?: string | null) => {
    if (!token) return url
    try {
      const parsed = new URL(url, window.location.origin)
      parsed.searchParams.set('admin_token', token)
      return parsed.toString()
    } catch (_err) {
      return url
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    const token = getAdminToken()
    if (!token) {
      setError('Admin session token missing. Please sign out and sign in again.')
      setLoading(false)
      setData(null)
      return
    }

    const url = withAdminToken(getApiUrl(`/payments/reports/summary/?${makeReportParams().toString()}`), token)
    try {
      const res = await fetch(url, {
        headers: makeAuthHeaders(token),
      })

      const { bodyText, json } = await parseJsonResponse(res)
      if (!res.ok) {
        const message = getApiErrorMessage(res, bodyText, json)
        setError(`Report load failed: ${message}`)
        setData(null)
        return
      }

      if (json === null) {
        setError(`Report endpoint returned invalid JSON: ${bodyText || res.statusText}`)
        setData(null)
        return
      }

      setData(json)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching report:', message)
      setError(`Could not load report: ${message}`)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async () => {
    const token = getAdminToken()
    if (!token) {
      alert('Admin session expired. Please sign in again.')
      return
    }
    try {
      const url = withAdminToken(getApiUrl(`/payments/reports/download/?${makeReportParams().toString()}`), token)
      const res = await fetch(url, {
        headers: makeAuthHeaders(token),
      })
      if (!res.ok) {
        const errorJson = await res.text().catch(() => 'Download failed')
        console.error(errorJson)
        alert(`Failed to download report: ${errorJson.substring(0, 100)}`); // Show a user-friendly alert
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
      alert('Error initiating report download.')
    }
  }

  const fetchWastage = async () => {
    const token = getAdminToken()
    if (!token) {
      console.warn('Skipping wastage fetch because admin token is missing.')
      setWastageLogs([])
      return
    }
    const url = withAdminToken(getApiUrl(`/payments/reports/wastage/?${makeReportParams().toString()}`), token)
    console.log('Fetching wastage logs from:', url)
    try {
      const res = await fetch(url, {
        headers: makeAuthHeaders(token),
      })
      console.log('Wastage response status:', res.status)
      const { bodyText, json } = await parseJsonResponse(res)
      if (!res.ok) {
        const message = getApiErrorMessage(res, bodyText, json)
        console.error('Backend error fetching wastage logs:', message)
        setWastageLogs([])
        return
      }
      if (json === null) {
        console.error('Invalid response format from /reports/wastage/', res.status, bodyText)
        setWastageLogs([])
        return
      }
      console.log('Wastage data received:', json)
      setWastageLogs(json.wastage || [])
    } catch (error) {
      console.error('Error fetching wastage:', error)
      setWastageLogs([])
    }
  }

  const fetchMisc = async () => {
    const token = getAdminToken()
    if (!token) {
      console.warn('Skipping miscellaneous fetch because admin token is missing.')
      setMiscLogs([])
      return
    }
    const url = withAdminToken(getApiUrl(`/payments/reports/miscellaneous/?${makeReportParams().toString()}`), token)
    console.log('Fetching miscellaneous logs from:', url)
    try {
      const res = await fetch(url, {
        headers: makeAuthHeaders(token),
      })
      console.log('Miscellaneous response status:', res.status)
      const { bodyText, json } = await parseJsonResponse(res)
      if (!res.ok) {
        const message = getApiErrorMessage(res, bodyText, json)
        console.error('Backend error fetching miscellaneous logs:', message)
        setMiscLogs([])
        return
      }
      if (json === null) {
        console.error('Invalid response format from /reports/miscellaneous/', res.status, bodyText)
        setMiscLogs([])
        return
      }
      console.log('Miscellaneous data received:', json)
      setMiscLogs(json.miscellaneous || [])
    } catch (error) {
      console.error('Error fetching miscellaneous logs:', error)
      setMiscLogs([])
    }
  }

  useEffect(() => {
    fetchReport();
    fetchWastage();
    fetchMisc();
  }, [selectedPeriodType, selectedDate, customStartDate, customEndDate]);

  // Subscribe to SSE so reports refresh when orders are paid
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/payments/stream/')
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload && payload.type === 'order_update' && payload.data && payload.data.status === 'paid') {
            // Re-fetch report data when a new payment occurs
            fetchReport()
          }
        } catch (err) {
          // ignore parse errors
        }
      }
      es.onerror = () => { if (es) { es.close(); es = null } }
    } catch (err) {
      // ignore SSE setup errors
    }
    return () => { if (es) es.close() }
  }, [])

  const totalOrders = useMemo(
    () => data?.hourly_sales.reduce((sum, entry) => sum + entry.orders, 0) ?? 0,
    [data]
  )

  const hourlyData = useMemo(() => {
    const hourMap = new Map<number, { orders: number; revenue: number; label?: string }>()
    data?.hourly_sales.forEach((entry) => {
      hourMap.set(entry.hour, { orders: entry.orders, revenue: entry.revenue, label: entry.label })
    })

    return Array.from({ length: 24 }, (_, hour) => {
      const value = hourMap.get(hour) || { orders: 0, revenue: 0, label: `${hour.toString().padStart(2, '0')}:00` }
      return {
        hour,
        label: value.label || `${hour.toString().padStart(2, '0')}:00`,
        orders: value.orders,
        revenue: value.revenue,
      }
    })
  }, [data])

  const submitWastage = async () => {
    if (!newWastage.item_name.trim() || newWastage.quantity <= 0) return
    const token = getAdminToken()
    if (!token) {
      alert('Admin session expired. Please sign in again.')
      return
    }
    setSavingWastage(true)
    try {
      const url = withAdminToken(getApiUrl('/payments/reports/wastage/'), token)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...makeAuthHeaders(token),
        },
        body: JSON.stringify({
          ...newWastage,
          // Calculate and record the total cost (Quantity * Unit Cost)
          cost: newWastage.quantity * newWastage.cost,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setNewWastage({ item_name: '', quantity: 1, reason: '', cost: 0 })
        fetchWastage()
        fetchReport() // Refresh dashboard totals to include new wastage
      } else {
        console.error(json)
        alert(json.error || 'Failed to log wastage.');
      }
    } catch (error) {
      console.error(error)
      alert('Error logging wastage.')
    } finally {
      setSavingWastage(false)
    }
  }

  const deleteWastageLog = async (id: number) => {
    if (!window.confirm('Remove this wastage entry?')) return
    const token = getAdminToken()
    if (!token) {
      alert('Admin session expired. Please sign in again.')
      return
    }
    try {
      const url = withAdminToken(getApiUrl(`/payments/reports/wastage/${id}/`), token)
      const res = await fetch(url, {
        method: 'DELETE',
        headers: makeAuthHeaders(token),
      })
      if (res.ok) {
        fetchWastage()
        fetchReport()
      } else {
        const json = await res.json()
        alert(json.error || 'Delete failed')
      }
    } catch (error) {
      console.error(error)
      alert('Error deleting wastage log.')
    }
  }

  const clearWastageLogs = async () => {
    if (!window.confirm('Are you sure you want to delete ALL logged waste information? This cannot be undone.')) {
        return;
    }

    setSavingWastage(true); // Re-using this state for loading indicator
    try {
        const token = getAdminToken();
        if (!token) {
            alert('Admin session expired. Please sign in again.');
            return;
        }
        const url = withAdminToken(getApiUrl('/payments/admin/clear-wastage/'), token)
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...makeAuthHeaders(token),
            },
        });
        const json = await res.json();
        if (res.ok) {
            fetchWastage(); // Refresh the wastage logs table
            fetchReport(); // Refresh the report summary (profit, total logged cost)
        } else {
            console.error(json);
            alert(json.error || 'Failed to clear wastage logs.');
        }
    } catch (error) {
        console.error(error);
        alert('Error clearing wastage logs.');
    } finally {
        setSavingWastage(false);
    }
};

  const submitMisc = async () => {
    if (!newMisc.item_name.trim()) return alert('Please enter an item name');
    if (newMisc.cost <= 0) return alert('Please enter a valid cost amount');
    const token = getAdminToken()
    if (!token) {
      alert('Admin session expired. Please sign in again.')
      return
    }
    setSavingMisc(true)
    try {
      const url = withAdminToken(getApiUrl('/payments/reports/miscellaneous/'), token)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...makeAuthHeaders(token),
        },
        body: JSON.stringify(newMisc),
      })
      const json = await res.json()
      if (res.ok) {
        setNewMisc({ item_name: '', reason: '', cost: 0 })
        fetchMisc()
        fetchReport()
      } else {
        alert(json.error || 'Failed to log expense. Check your connection or session.');
      }
    } catch (error) {
      console.error(error)
      alert('An unexpected error occurred while logging the expense.');
    } finally {
      setSavingMisc(false)
    }
  }

  const deleteMiscLog = async (id: number) => {
    if (!window.confirm('Remove this expense entry?')) return
    const token = getAdminToken()
    if (!token) {
      alert('Admin session expired. Please sign in again.')
      return
    }
    try {
      const url = withAdminToken(getApiUrl(`/payments/reports/miscellaneous/${id}/`), token)
      const res = await fetch(url, {
        method: 'DELETE',
        headers: makeAuthHeaders(token),
      })
      if (res.ok) {
        fetchMisc()
        fetchReport()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const clearMiscLogs = async () => {
    if (!window.confirm('Delete all miscellaneous logs?')) return
    setSavingMisc(true)
    const token = getAdminToken()
    if (!token) {
      alert('Admin session expired. Please sign in again.')
      setSavingMisc(false)
      return
    }
    try {
      const url = withAdminToken(getApiUrl('/payments/admin/clear-miscellaneous/'), token)
      const res = await fetch(url, {
        method: 'POST',
        headers: makeAuthHeaders(token),
      })
      if (res.ok) {
        fetchMisc()
        fetchReport()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setSavingMisc(false)
    }
  }

  // Check if there's any meaningful data to display in the main report section
  const hasReportData = useMemo(() => {
    if (!data) return false;
    // Check if any of the key totals are non-zero, or if there are any best/worst items or hourly sales
    return (
      data.totals.revenue > 0 ||
      data.totals.cash_revenue > 0 ||
      data.totals.mpesa_revenue > 0 ||
      data.totals.food_cost > 0 ||
      data.totals.wastage > 0 ||
      data.totals.profit !== 0 || // Profit can be negative, so check if it's not zero
      data.best_items.length > 0 ||
      data.worst_items.length > 0 ||
      data.hourly_sales.some(entry => entry.orders > 0 || entry.revenue > 0)
    );
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[0.75fr_0.25fr] xl:items-end">
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Reports</p>
          <h2 className="font-display text-3xl text-slate-100">Sales & Cost Insights</h2>
          {error ? (
            <p className="text-xs text-red-400 mt-2">⚠️ {error}</p>
          ) : (!data && !loading ? (
            <p className="text-xs text-yellow-400 mt-2">⚠️ No data loaded. Click "Refresh Report" to fetch data. Make sure you are authenticated and the backend is reachable.</p>
          ) : null)}
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-5 rounded-xl border border-slate-700">
            <div>
              <label className="text-sm text-slate-400">Period Type</label>
              <select
                className="w-full rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200"
                value={selectedPeriodType}
                onChange={(event) => setSelectedPeriodType(event.target.value as 'day' | 'week' | 'month' | 'year' | 'custom')}
              >
                <option value="day">Day</option>
                <option value="week">Week (Mon-Sun)</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div>
              {selectedPeriodType === 'custom' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(event) => setCustomStartDate(event.target.value)}
                      className="w-full rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                      className="w-full rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm text-slate-400">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="w-full rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="w-full rounded-full border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-transform disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh Report'}
            </button>
            <button
              type="button"
              onClick={downloadReport}
              className="w-full rounded-full bg-hero-gradient px-5 py-2 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-400 text-center mb-4">
        Report for: <span className="font-semibold text-slate-100">{data?.range_label || 'Loading...'}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <ReportCard label="Revenue" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.revenue) : 'Loading...'} />
        <ReportCard label="Cash Revenue" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.cash_revenue) : 'Loading...'} />
        <ReportCard label="M-Pesa Revenue" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.mpesa_revenue) : 'Loading...'} />
        <ReportCard label="Food Cost" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.food_cost) : 'Loading...'} />
        <ReportCard label="Misc Expenses" value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.miscellaneous) : 'Loading...'} />
        <ReportCard 
          label="Profit" 
          value={data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.profit) : 'Loading...'} 
          valueClassName={data ? (data.totals.profit >= 0 ? 'text-green-400' : 'text-red-400') : ''}
        />
      </div>
      {data?.best_waiter || data?.least_waiter ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data?.best_waiter ? (
            <div className="bg-slate-800 p-5 rounded-xl shadow-card border border-slate-700">
              <p className="text-sm text-slate-400">Top Waiter</p>
              <h3 className="text-2xl sm:text-3xl font-display font-semibold text-slate-100">{data.best_waiter.waiter_name}</h3>
              <p className="text-sm text-slate-400">Orders: {data.best_waiter.orders}</p>
            </div>
          ) : null}
          {data?.least_waiter ? (
            <div className="bg-slate-800 p-5 rounded-xl shadow-card border border-slate-700">
              <p className="text-sm text-slate-400">Least Active Waiter</p>
              <h3 className="text-2xl sm:text-3xl font-display font-semibold text-slate-100">{data.least_waiter.waiter_name}</h3>
              <p className="text-sm text-slate-400">Orders: {data.least_waiter.orders}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[0.7fr_0.3fr] gap-6">
        <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
          <h3 className="font-semibold text-xl text-slate-100 mb-4">Hourly Sales</h3>
          {loading ? (
            <p className="text-slate-400">Loading hourly data…</p>
          ) : (
            <div className="space-y-6">
              <div className="w-full" style={{ minHeight: 320 }}>
                <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
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
              <p className="text-sm text-slate-400">Total Logged Cost</p>
              <p className="text-lg font-semibold text-red-400">{data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.wastage) : '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-4">
              <p className="text-sm text-slate-400">Misc Expenses</p>
              <p className="text-lg font-semibold text-red-400">{data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.miscellaneous) : '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-700 p-4 bg-slate-800/50">
              <p className="text-sm text-slate-400">Net Profit (Revenue - Food Cost - Logged - Misc)</p>
              <p className={`text-lg font-semibold ${data && data.totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{data ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(data.totals.profit) : '-'}</p>
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
            type="number"
            value={newWastage.cost}
            onChange={(event) => setNewWastage((cur) => ({ ...cur, cost: Number(event.target.value) }))}
            placeholder="Unit Cost"
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100"
          />
          <input
            value={newWastage.reason}
            onChange={(event) => setNewWastage((cur) => ({ ...cur, reason: event.target.value }))}
            placeholder="Reason"
            className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={submitWastage}
            disabled={savingWastage}
            className="rounded-full bg-hero-gradient px-5 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
          >
            {savingWastage ? 'Saving…' : 'Log Waste'}
          </button>
          <button
            onClick={clearWastageLogs}
            disabled={savingWastage}
            className="rounded-full border border-red-900/50 bg-slate-900 px-5 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/30 disabled:opacity-50"
          >
            {savingWastage ? 'Clearing…' : 'Clear All Logged Waste'}
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-sm text-slate-400">
                <th className="py-3">Item</th>
                <th className="py-3">Qty</th>
                <th className="py-3">Total Cost</th>
                <th className="py-3">Reason</th>
                <th className="py-3">When</th>
                <th className="py-3 text-right">Actions</th>
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
                  <td className="py-3 text-right">
                    <button 
                      onClick={() => deleteWastageLog(log.id)}
                      className="text-slate-500 hover:text-red-500 transition-colors px-2"
                      title="Delete entry"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {wastageLogs.length > 0 && (
                <tr className="border-t-2 border-slate-600 font-bold text-slate-100 bg-slate-800/40">
                  <td className="py-4 px-2">TOTAL LOGGED COST</td>
                  <td className="py-4">{wastageLogs.reduce((acc: number, log: WastageLog) => acc + log.quantity, 0)}</td>
                  <td className="py-4">
                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(
                      wastageLogs.reduce((acc: number, log: WastageLog) => acc + log.cost, 0)
                    )}
                  </td>
                  <td className="py-4" colSpan={3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
        <div className="mb-6">
          <h3 className="font-semibold text-xl text-slate-100">Miscellaneous Expenses</h3>
          <p className="text-sm text-slate-400">Log repairs, bills, and other overhead costs.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <input value={newMisc.item_name} onChange={(e) => setNewMisc(c => ({...c, item_name: e.target.value}))} placeholder="Item (e.g. Electricity)" className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100" />
          <input type="number" value={newMisc.cost} onChange={(e) => setNewMisc(c => ({...c, cost: Number(e.target.value)}))} placeholder="Amount" className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100" />
          <input value={newMisc.reason} onChange={(e) => setNewMisc(c => ({...c, reason: e.target.value}))} placeholder="Details" className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100" />
        </div>
        <div className="flex gap-3">
          <button onClick={submitMisc} disabled={savingMisc} className="rounded-full bg-hero-gradient px-5 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform">
            {savingMisc ? 'Saving...' : 'Log Expense'}
          </button>
          <button onClick={clearMiscLogs} disabled={savingMisc} className="rounded-full border border-red-900/50 bg-slate-900 px-5 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/30">
            Clear All Logs
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700 text-sm text-slate-400">
                <th className="py-3">Item</th>
                <th className="py-3">Cost</th>
                <th className="py-3">Reason</th>
                <th className="py-3">Date</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {miscLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-700 text-slate-100">
                  <td className="py-3">{log.item_name}</td>
                  <td className="py-3">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(log.cost)}</td>
                  <td className="py-3 text-slate-400">{log.reason}</td>
                  <td className="py-3 text-slate-400">{new Date(log.created_at).toLocaleDateString()}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => deleteMiscLog(log.id)} className="text-slate-500 hover:text-red-500">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Reports;
