import React, { useState } from 'react'
import Totals from './Totals'
import { getApiUrl } from '@/lib/api'
import { Download } from 'lucide-react'

const AdminHome: React.FC = () => {
  const [loading, setLoading] = useState(false)

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-slate-400">Overview</p>
          <h2 className="font-display text-3xl text-slate-100">Admin Dashboard</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadBackup}
            className="rounded-xl border border-blue-900/50 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-blue-400 transition-all hover:bg-blue-950/30 shadow-lg shadow-blue-900/10 flex items-center gap-2"
          >
            <Download size={16} />
            Download Backup
          </button>
          <button
            onClick={clearAllData}
            disabled={loading}
            className="rounded-xl border border-red-900/50 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/30 disabled:opacity-50 shadow-lg shadow-red-900/10"
          >
            {loading ? 'Clearing...' : 'Clear All Operational Data'}
          </button>
        </div>
      </div>

      <Totals />
    </>
  )
}

export default AdminHome
