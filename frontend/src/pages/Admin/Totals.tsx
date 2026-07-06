import React, { useEffect, useState } from 'react'
import { getApiUrl, apiFetch } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'

const Totals: React.FC = () => {
  const [totalOrders, setTotalOrders] = useState<number>(0)
  const [pending, setPending] = useState<number>(0)
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0)
  const [reportTotals, setReportTotals] = useState<{ revenue: number; cash_revenue: number; mpesa_revenue: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const token = getAdminToken()
      const headers = { Authorization: `Bearer ${token}` }
      const today = new Date().toISOString().split('T')[0]
      try {
        const [ordersResponse, pendingBillsResponse, reportSummary] = await Promise.all([
          apiFetch('/payments/orders/', { headers }),
          apiFetch('/payments/cashier/pending-bills/', { headers }),
          apiFetch(`/payments/reports/summary/?period_type=day&date=${today}`, { headers }),
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
    load()
  }, [])

  const revenue = reportTotals?.revenue ?? 0

  return (
    <div className="pb-2 mb-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700 min-w-0">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Total Orders</p>
          <h3 className="text-3xl font-display text-slate-100">{totalOrders}</h3>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700 min-w-0">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Pending Payments</p>
          <h3 className="text-3xl font-display text-slate-100">{pending}</h3>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700 min-w-0">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Outstanding Balance</p>
          <h3 className="text-3xl font-display text-amber-300">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(outstandingBalance)}</h3>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700 min-w-0">
          <p className="text-sm text-slate-400 truncate whitespace-nowrap">Revenue (24h)</p>
          <h3 className="text-3xl font-display text-slate-100">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(revenue)}</h3>
        </div>
      </div>
    </div>
  )
}

export default Totals
