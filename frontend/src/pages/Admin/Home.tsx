import React, { useState } from 'react'
import Totals from './Totals'
import { getApiUrl } from '@/lib/api'

const AdminHome: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const clearAllData = async () => {
    if (!window.confirm('WARNING: This will delete ALL orders, transactions, wastage logs, tables, and menu items. This cannot be undone. Proceed?')) {
      return
    }

    setLoading(true)
    try {
      const adminToken = localStorage.getItem('admin_token')
      const response = await fetch(getApiUrl('/payments/admin/clear/'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      if (response.ok) {
        alert('All operational data has been cleared.')
        window.location.reload() // Refresh to update all stats
      } else {
        alert('Failed to clear data.')
      }
    } catch (error) {
      alert('Error connecting to server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-slate-400">Overview</p>
          <h2 className="font-display text-3xl text-slate-100">Admin Dashboard</h2>
        </div>
        <button
          onClick={clearAllData}
          disabled={loading}
          className="rounded-xl border border-red-900/50 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/30 disabled:opacity-50 shadow-lg shadow-red-900/10"
        >
          {loading ? 'Clearing...' : 'Clear All Operational Data'}
        </button>
      </div>

      <Totals />
    </>
  )
}

export default AdminHome
