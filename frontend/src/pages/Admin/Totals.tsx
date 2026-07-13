import React, { useEffect, useState } from 'react'
import { apiFetch, getSseUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'

const Totals: React.FC = () => {
  const [totalOrders, setTotalOrders] = useState<number>(0)
  const [pending, setPending] = useState<number>(0)
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0)
  const [reportTotals, setReportTotals] = useState<{ revenue: number; cash_revenue: number; mpesa_revenue: number } | null>(null)
  const [selectedPeriodType, setSelectedPeriodType] = useState<'day' | 'week' | 'month'>('day')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])

  const fetchTotals = async () => {
    const token = getAdminToken()
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const [ordersResponse, pendingBillsResponse, reportSummary] = await Promise.all([
        apiFetch('/payments/orders/', { headers }),
        apiFetch('/payments/cashier/pending-bills/', { headers }),
        apiFetch(`/payments/reports/summary/?period_type=${selectedPeriodType}&date=${selectedDate}`, { headers }),
      ])

      // Use backend totals to keep admin data consistent with system metrics
      const totalOrdersValue = Number(ordersResponse?.pagination?.total ?? 0)
      setTotalOrders(totalOrdersValue)

      const pendingValue = Number(pendingBillsResponse?.pagination?.total ?? 0)
      setPending(pendingValue)

      // Get outstanding balance from pending bills
      const bills = pendingBillsResponse?.bills || []
      setOutstandingBalance(bills.reduce((sum: number, bill: any) => sum + Number(bill.outstanding_amount ?? (bill.total_amount || 0)), 0))

      // Get revenue from report (single source of truth for financial data)
      if (reportSummary?.totals) {
        setReportTotals({
          revenue: Number(reportSummary.totals.revenue || 0),
          cash_revenue: Number(reportSummary.totals.cash_revenue || 0),
          mpesa_revenue: Number(reportSummary.totals.mpesa_revenue || 0),
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchTotals()
  }, [selectedPeriodType, selectedDate])

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource(getSseUrl('/payments/stream/'))
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload && payload.type === 'order_update' && payload.data && payload.data.status === 'paid') {
            fetchTotals()
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

  const revenue = reportTotals?.revenue ?? 0

  return (
    <div className="pb-2 mb-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300">
          Timeframe
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedPeriodType('day')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedPeriodType === 'day' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriodType('week')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedPeriodType === 'week' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriodType('month')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedPeriodType === 'month' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        <div className="min-w-[240px] flex-[0_0_240px] bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Total Orders</p>
          <h3 className="text-3xl font-display text-slate-100">{totalOrders}</h3>
        </div>
        <div className="min-w-[240px] flex-[0_0_240px] bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Pending Payments</p>
          <h3 className="text-3xl font-display text-slate-100">{pending}</h3>
        </div>
        <div className="min-w-[240px] flex-[0_0_240px] bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Outstanding Balance</p>
          <h3 className="text-3xl font-display text-amber-300">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(outstandingBalance)}</h3>
        </div>
        <div className="min-w-[240px] flex-[0_0_240px] bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Revenue ({selectedPeriodType === 'day' ? '24h' : selectedPeriodType === 'week' ? '7d' : '30d'})</p>
          <h3 className="text-3xl font-display text-slate-100">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(revenue)}</h3>
        </div>
      </div>
    </div>
  )
}

export default Totals
