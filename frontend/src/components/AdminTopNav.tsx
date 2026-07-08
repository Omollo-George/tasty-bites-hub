import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, ShoppingBag, BarChart3, Menu as MenuIcon, Settings, Users, Package, Zap } from 'lucide-react'
import TastyBitesIcon from './TastyBitesIcon'

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

const AdminTopNav: React.FC = () => {
  return (
    <div className="hidden lg:flex items-center justify-between w-full bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <TastyBitesIcon size={28} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d69e2e] font-bold mb-1">Hotel Management</p>
          <h2 className="font-display text-lg md:text-2xl text-white tracking-tight">Tasty Bites Hub<span className="text-[#d69e2e]">.</span></h2>
        </div>
      </div>

      <nav className="flex items-center gap-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              `px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                isActive
                  ? 'bg-[#1a365d] text-[#d69e2e] shadow-lg shadow-[#1a365d]/20 border border-[#d69e2e]/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="hidden md:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default AdminTopNav
