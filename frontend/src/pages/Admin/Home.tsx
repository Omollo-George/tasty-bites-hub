import React, { useState } from 'react'
import Totals from './Totals'
import { getApiUrl } from '@/lib/api'
import { Download, ChevronDown } from 'lucide-react'

const AdminHome: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [clearCashierLoading, setClearCashierLoading] = useState(false)
  const [clearCashierMessage, setClearCashierMessage] = useState('')

  const downloadBackup = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token')
      const response = await fetch(getApiUrl('/payments/admin/backup/'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      if (response.ok) {
        const filename = response.headers
          .get('content-disposition')
          ?.match(/filename="(.+)"/)?.[1] || `tasty-bites-backup-${new Date().toISOString().split('T')[0]}.json`
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Failed to download backup.')
      }
    } catch (error) {
      alert('Error downloading backup.')
    }
  }

  const clearAllData = async () => {
    if (!window.confirm('WARNING: This will delete ALL orders, transactions, wastage logs, tables, and menu items. This cannot be undone. Proceed?')) {
      return
    }

    // Ask whether to perform a full system wipe (employees, staff activities, tokens)
    const fullWipe = window.confirm('Also wipe staff, stock logs, and admin session tokens?\n\nPress OK for FULL wipe (keeps Admin accounts), Cancel to clear operational data only.')

    setLoading(true)
    try {
      const adminToken = localStorage.getItem('admin_token')
      const response = await fetch(getApiUrl('/payments/admin/clear/') + (fullWipe ? '?scope=full' : ''), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scope: fullWipe ? 'full' : 'operational' })
      })
      if (response.ok) {
        alert(fullWipe ? 'Full system data has been cleared (admins preserved).' : 'All operational data has been cleared.')
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <p className="text-sm text-slate-400">Overview</p>
          <h2 className="font-display text-2xl sm:text-3xl text-slate-100">Admin Dashboard</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap w-full lg:w-auto">
          <button
            onClick={downloadBackup}
            className="w-full sm:w-auto rounded-xl border border-blue-900/50 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-blue-400 transition-all hover:bg-blue-950/30 shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Download Backup
          </button>
          <button
            onClick={clearAllData}
            disabled={loading}
            className="w-full sm:w-auto rounded-xl border border-red-900/50 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/30 disabled:opacity-50 shadow-lg shadow-red-900/10"
          >
            {loading ? 'Clearing...' : 'Clear All Operational Data'}
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('Clear cashier activity (payments, recent transactions) from the system? This cannot be undone.')) return
              const token = localStorage.getItem('admin_token')
              if (!token) {
                window.location.href = '/admin/login'
                return
              }
              setClearCashierMessage('')
              setClearCashierLoading(true)
              try {
                const data = await fetch(getApiUrl('/payments/admin/clear-cashier-activity/'), {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                })
                let body: any = {}
                try { body = await data.json() } catch (e) { /* ignore */ }
                setClearCashierMessage(body?.message || 'Cashier activity cleared successfully.')
              } catch (err: any) {
                setClearCashierMessage(err?.message || 'Failed to clear cashier activity')
              } finally {
                setClearCashierLoading(false)
              }
            }}
            disabled={clearCashierLoading}
            className="w-full sm:w-auto rounded-xl border border-red-900/50 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:opacity-50 shadow-lg shadow-red-900/10"
          >
            {clearCashierLoading ? 'Clearing…' : 'Clear Cashier Activity'}
          </button>
          {clearCashierMessage ? <p className="text-sm text-slate-300 mt-2 sm:mt-0">{clearCashierMessage}</p> : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl shadow-slate-950/40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-slate-100 hover:bg-slate-800"
        >
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin Snapshot</p>
            <h3 className="text-xl font-semibold text-white">Dashboard Metrics</h3>
          </div>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="px-6 pb-6 pt-0">
            <Totals />
          </div>
        )}
      </div>
    </>
  )
}

export default AdminHome
