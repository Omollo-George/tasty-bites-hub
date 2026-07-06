import React from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from '@/components/AdminSidebar'
import AdminHeader from '@/components/AdminHeader'

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row overflow-x-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
          <AdminHeader />
        </div>
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 lg:pb-10">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
