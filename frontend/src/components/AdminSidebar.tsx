import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, ShoppingBag, BarChart3, Menu as MenuIcon, Settings, Users, Package, Zap } from 'lucide-react'
import { getAdminToken } from '@/lib/admin-session'
import { preloadAdminRoute } from '@/lib/admin-route-prefetch'
import { preloadEmployeesData, preloadReportsData, preloadStockData } from '@/lib/admin-data-cache'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import TastyBitesIcon from './TastyBitesIcon' // Monitor is already imported here. No change needed.

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: Home, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/automation', label: 'Automation', icon: Zap },
  { to: '/admin/menu', label: 'Menu', icon: MenuIcon },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/stock', label: 'Stock', icon: Package },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const AdminSidebar: React.FC = () => {
  const token = getAdminToken()

  const handleNavItemHover = (path: string) => {
    preloadAdminRoute(path)
    // Preload data for specific routes
    // Schedule data preloads, but avoid blocking the main thread for heavy endpoints
    const schedule = (fn: () => void) => {
      if (typeof window === 'undefined') return
      const ric = (window as any).requestIdleCallback || function (cb: any) { return setTimeout(cb, 500) }
      try { ric(() => fn()) } catch { setTimeout(() => fn(), 500) }
    }

    if (path === '/admin/employees') {
      schedule(preloadEmployeesData)
    } else if (path === '/admin/reports') {
      // reports can be heavy; schedule when the browser is idle
      schedule(preloadReportsData)
    } else if (path === '/admin/stock') {
      schedule(preloadStockData)
    }
  }

  return (
    <Sidebar side="left" collapsible="offcanvas" className="bg-slate-900/95 text-slate-300 p-4 backdrop-blur md:border-b-0 md:border-r md:min-h-screen md:sticky md:top-0 md:flex-shrink-0 md:overflow-y-auto">
      <SidebarContent className="overflow-y-auto">
        <div className="mb-4 flex items-center gap-3 md:mb-10 md:flex-col md:items-start md:gap-4">
          <TastyBitesIcon size={36} />
          <div className="md:block">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#d69e2e] font-bold mb-1">Hotel Management</p>
            <h2 className="font-display text-lg md:text-2xl text-white tracking-tight">Tasty Bites Hub<span className="text-[#d69e2e]">.</span></h2>
          </div>
        </div>
        <nav className="flex flex-col gap-2 pb-2 md:gap-3 md:pb-0">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              onMouseEnter={() => handleNavItemHover(to)}
              onFocus={() => handleNavItemHover(to)}
              className={({ isActive }) =>
                `min-w-[100px] flex-[0_0_100px] flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200 md:min-w-0 md:flex-[unset] md:justify-start md:px-4 md:py-3.5 ${
                  isActive
                    ? 'bg-[#1a365d] text-[#d69e2e] shadow-lg shadow-[#1a365d]/20 border border-[#d69e2e]/30'
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-center md:text-left hidden sm:inline">{label}</span>
            </NavLink>
          ))}

          {!token && (
            <NavLink
              to="/admin/login"
              className={({ isActive }) =>
                `min-w-[100px] flex-[0_0_100px] flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all md:min-w-0 md:flex-[unset] md:justify-start md:px-4 md:py-3.5 ${
                  isActive
                    ? 'bg-[#1a365d] text-[#d69e2e] shadow-lg shadow-[#1a365d]/20 border border-[#d69e2e]/30'
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-center hidden sm:inline">Sign In</span>
            </NavLink>
          )}
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}

export default AdminSidebar
