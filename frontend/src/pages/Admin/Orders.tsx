import React from 'react'
import OrdersTable from '@/components/AdminOrdersTable'

const AdminOrders: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-slate-400">Orders</p>
          <h2 className="font-display text-3xl text-slate-100">Manage Orders</h2>
        </div>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <div className="bg-slate-700 p-8 rounded-2xl shadow-sm border border-slate-600/60">
          <OrdersTable />
        </div>
      </div>
    </div>
  )
}

export default AdminOrders
