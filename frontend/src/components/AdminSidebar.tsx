import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Home, ShoppingBag, BarChart3, Menu as MenuIcon, Settings, Users, Package, Zap } from 'lucide-react'
import { getAdminToken } from '@/lib/admin-session'
import { preloadAdminRoute } from '@/lib/admin-route-prefetch'
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

  return (
    <aside className="w-full border-b border-slate-700 bg-slate-900/95 text-slate-300 p-4 backdrop-blur md:w-72 md:border-b-0 md:border-r md:min-h-screen md:sticky md:top-0 md:flex-shrink-0 md:overflow-y-auto">
      <div className="mb-4 flex items-center justify-between gap-4 md:mb-10 md:flex-col md:items-start md:gap-4">
        <div className="flex items-center gap-3">
          <TastyBitesIcon size={36} />
          <div className="md:block">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#d69e2e] font-bold mb-1">Hotel Management</p>
            <h2 className="font-display text-lg md:text-2xl text-white tracking-tight">Tasty Bites Hub<span className="text-[#d69e2e]">.</span></h2>
          </div>
        </div>
      </div>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-col md:gap-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            onMouseEnter={() => preloadAdminRoute(to)}
            onFocus={() => preloadAdminRoute(to)}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200 md:justify-start md:px-4 md:py-3.5 ${
                isActive
                  ? 'bg-[#1a365d] text-[#d69e2e] shadow-lg shadow-[#1a365d]/20 border border-[#d69e2e]/30'
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-center md:text-left">{label}</span>
          </NavLink>
        ))}

        {!token && (
          <NavLink
            to="/admin/login"
            className={({ isActive }) =>
              `col-span-2 flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-all sm:col-span-3 md:col-span-1 md:justify-start md:px-4 md:py-3.5 ${
                isActive
                  ? 'bg-[#1a365d] text-[#d69e2e] shadow-lg shadow-[#1a365d]/20 border border-[#d69e2e]/30'
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            Admin Sign In
          </NavLink>
        )}
      </nav>
    </aside>
  )
}

export default AdminSidebar
