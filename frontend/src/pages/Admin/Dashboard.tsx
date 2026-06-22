import React from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from '@/components/AdminSidebar'
import AdminHeader from '@/components/AdminHeader'

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-x-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <div className="pt-8 px-4 sm:px-6 md:px-10 max-w-7xl w-full mx-auto">
          <AdminHeader />
        </div>
        <div className="flex-1 p-4 sm:p-6 md:p-10 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
