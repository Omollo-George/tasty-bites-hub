import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, ShoppingBag, BarChart3, Menu as MenuIcon, Settings, Users, Package } from 'lucide-react'
import { getAdminToken } from '@/lib/admin-session'
import TastyBitesIcon from './TastyBitesIcon'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: Home, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/menu', label: 'Menu', icon: MenuIcon },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/stock', label: 'Stock', icon: Package },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const AdminSidebar: React.FC = () => {
  const token = getAdminToken()

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 border-r border-slate-700 p-6 min-h-screen sticky top-0">
      <div className="mb-10 px-4 flex flex-col gap-4">
        <TastyBitesIcon size={40} />
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d69e2e] font-bold mb-1">Hotel Management</p>
          <h2 className="font-display text-2xl text-white tracking-tight">Tasty Bites Hub<span className="text-[#d69e2e]">.</span></h2>
        </div>
      </div>
      <nav className="flex flex-col gap-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[#1a365d] text-[#d69e2e] shadow-lg shadow-[#1a365d]/20 border border-[#d69e2e]/30'
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}

        {!token && (
          <NavLink
            to="/admin/login"
            className={({ isActive }) =>
              `px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
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
