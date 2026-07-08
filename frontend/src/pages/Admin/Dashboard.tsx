import React from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from '@/components/AdminSidebar'
import AdminTopNav from '@/components/AdminTopNav'
import AdminHeader from '@/components/AdminHeader'
import { SidebarProvider } from '@/components/ui/sidebar'

const Dashboard: React.FC = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="admin-layout min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden">
        <AdminTopNav />
        <div className="lg:hidden">
          <AdminSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
            <AdminHeader />
          </div>
          <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 lg:pb-10">
            <Outlet />
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}

export default Dashboard
