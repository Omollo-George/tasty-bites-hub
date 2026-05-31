import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAdminSession, getAdminToken } from '@/lib/admin-session'

const AdminHeader: React.FC<{title?:string}> = ({title}) => {
  const navigate = useNavigate()
  const token = getAdminToken()

  const clearToken = async () => {
    if (token) {
      await fetch('/api/payments/admin/signout/', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {})
    }
    clearAdminSession()
    navigate('/admin/login')
  }

  return (
    <header className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
      <h1 className="font-display text-2xl text-slate-100">{title}</h1>
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/orders')} className="bg-orange-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-md hover:bg-orange-600 transition-all active:scale-95">New Order</button>
        {token ? (
          <button onClick={clearToken} className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 transition-colors">Sign Out</button>
        ) : (
          <button onClick={() => navigate('/admin/login')} className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700 transition-colors">Admin Sign In</button>
        )}
      </div>
    </header>
  )
}

export default AdminHeader
