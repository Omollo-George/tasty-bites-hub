import React, { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useNavigate } from 'react-router-dom'
import { clearAdminSession, getAdminToken, getAdminUser } from '@/lib/admin-session'
import { getApiUrl } from '@/lib/api'
import { Monitor, LogOut } from 'lucide-react'

const AdminHeader: React.FC<{title?:string}> = ({title}) => {
  const navigate = useNavigate()
  const token = getAdminToken()
  const [admin, setAdmin] = useState(getAdminUser())
  const { toast } = useToast()

  useEffect(() => {
    setAdmin(getAdminUser())
  }, [])

  // Listen for low-stock alerts via SSE and notify admin
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/payments/stream/')
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data)
          if (payload && payload.type === 'stock_alert') {
            const d = payload.data || {}
            toast({
              title: `Low stock: ${d.name}`,
              description: `Remaining ${d.stock_level}. Minimum ${d.min_stock_level}.`,
              variant: 'destructive',
            })
          }
        } catch (err) {
          // ignore
        }
      }
      es.onerror = () => { if (es) { es.close(); es = null } }
    } catch (err) {
      // ignore
    }
    return () => { if (es) es.close() }
  }, [toast])

  const clearToken = async () => {
    const currentToken = getAdminToken()
    if (currentToken) {
      await fetch(getApiUrl('/payments/admin/signout/'), {
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {})
    }
    clearAdminSession()
    navigate('/admin/login')
  }

  return (
    <header className="flex flex-col gap-4 mb-8 border-b border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-slate-100">{title}</h1>
        {admin && <p className="text-sm text-slate-400 mt-1 truncate">Signed in as <span className="font-semibold text-orange-400">{admin.display_name || admin.username}</span></p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 justify-end">
        <button type="button" onClick={() => navigate('/staff')} className="w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 transition-all font-semibold"><Monitor size={18} /> <span className="hidden sm:inline">Staff Portal</span></button>
        <button type="button" onClick={() => navigate('/admin/orders')} className="w-full sm:w-auto bg-[#1a365d] text-[#d69e2e] px-4 py-2.5 rounded-xl font-semibold shadow-md hover:bg-[#d69e2e] hover:text-white transition-all active:scale-95">New Order</button>
        {token ? (
          <button type="button" onClick={clearToken} className="w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 transition-colors"><LogOut size={16} /> <span className="hidden sm:inline">Sign Out</span></button>
        ) : (
          <button type="button" onClick={() => navigate('/admin/login')} className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 transition-colors">Admin Sign In</button>
        )}
      </div>
    </header>
  )
}

export default AdminHeader
