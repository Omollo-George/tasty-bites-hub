import React from 'react'
import OrdersTable from '@/components/AdminOrdersTable'
import Totals from './Totals'

const AdminHome: React.FC = () => {
  return (
    <>
      <Totals />
      <div className="bg-slate-700 p-8 rounded-2xl shadow-sm border border-slate-600/60">
        <h4 className="font-display text-xl mb-4">Recent Orders</h4>
        <OrdersTable />
      </div>
    </>
  )
}

export default AdminHome
