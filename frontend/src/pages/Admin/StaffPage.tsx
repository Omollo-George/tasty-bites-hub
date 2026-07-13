import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, UtensilsCrossed, Clock, CheckCircle, TrendingUp, Bell, LayoutGrid, Users, LogOut, Home, Monitor, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { getApiUrl, apiFetch, getSseUrl } from '@/lib/api';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { clearStaffSession, getNormalizedStaffRole, getStaffRole, getStaffName, getStaffToken, getStaffId } from '@/lib/staff-session';

interface Table {
  id: number;
  number: string;
  name: string;
  status: string;
}

interface StaffActivity {
  id?: string;
  action: string;
  description: string;
  time: string; // e.g., "5 mins ago"
  table?: string; // Optional, for table-related activities (e.g., "Table 4")
  order_id?: string; // Optional, for order-related activities
}

interface StaffSummary {
  orders_taken: number;
  tables_served: number;
  completed_orders: number;
}

interface StaffBriefingSection {
  type: string;
  title: string;
  messages?: string[];
  metrics?: Record<string, any>;
}

interface StaffBriefing {
  sections: StaffBriefingSection[];
}

const StaffPage: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [summary, setSummary] = useState<StaffSummary>({ orders_taken: 0, tables_served: 0, completed_orders: 0 });
  const [loadingActivities, setLoadingActivities] = useState(true); // New state for activities loading
  const [refreshingActivities, setRefreshingActivities] = useState(false); // background refresh indicator
  const [shiftCheckLoading, setShiftCheckLoading] = useState(true); // Check if staff is on shift
  const [briefing, setBriefing] = useState<StaffBriefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [cashierCollapsed, setCashierCollapsed] = useState(false);
  const isFirstLoadRef = useRef(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast(); // Initialize useToast hook
  const adminToken = getAdminToken();
  const staffToken = getStaffToken();
  const isAdmin = adminToken && isAdminSessionValid();
  const staffRole = getStaffRole();
  const authToken = staffToken || adminToken;
  const staffName = getStaffName();
  const roleLower = getNormalizedStaffRole();

  const canAccessPOS = isAdmin || ['waiter', 'cashier', 'manager'].includes(roleLower);
  const canAccessKDS = isAdmin || ['chef', 'manager', 'cook', 'kitchen'].includes(roleLower);
  const canAccessCashier = isAdmin || ['cashier', 'manager'].includes(roleLower);
  const canSeeTables = isAdmin || ['waiter', 'cashier', 'manager'].includes(roleLower);
  const isWaiter = roleLower === 'waiter'
  const isChef = ['chef', 'cook', 'kitchen'].includes(roleLower)

  const handleStaffUnauthorized = async (response: Response) => {
    if (response.status !== 403) {
      return false
    }

    try {
      const body = await response.json()
      console.warn('Staff auth invalid, clearing session:', body)
    } catch {
      console.warn('Staff auth invalid, clearing session: 403 response')
    }

    clearStaffSession()
    navigate('/staff/login', { replace: true })
    toast({
      title: 'Session expired',
      description: 'Your staff session has expired or is no longer valid. Please sign in again.',
      variant: 'destructive',
    })
    return true
  }

  // Check if staff member is on shift (verify auth is valid and they haven't been removed from shift)
  useEffect(() => {
    if (isAdmin) {
      // Admins bypass shift check
      setShiftCheckLoading(false)
      return
    }

    if (!staffToken) {
      // No staff token, not logged in
      setShiftCheckLoading(false)
      return
    }

    const checkShiftStatus = async () => {
      try {
        // Try to fetch staff activities - this will validate if token is still valid and staff is on shift
        try {
          await apiFetch(`/payments/staff/activities/?role=${staffRole}`, { headers: getAuthHeaders() })
        } catch (err: any) {
          if (err?.status === 403) {
            await handleStaffUnauthorized(err)
            return
          }
          console.warn('Shift check returned error:', err)
        }
      } catch (error) {
        console.error('Shift check error:', error)
        // Don't block access on network errors
      } finally {
        setShiftCheckLoading(false)
      }
    }

    checkShiftStatus()
  }, [staffToken, isAdmin, staffRole])

  useEffect(() => {
    const fetchTables = async () => {
      try {
        try {
          const data: any = await apiFetch('/payments/pos/tables/', { headers: getAuthHeaders() })
          setTables(data.tables || [])
        } catch (err: any) {
          if (err?.status === 403) {
            await handleStaffUnauthorized(err)
            return
          }
          console.error("Failed to fetch tables:", err)
        }
      } catch (error) {
        console.error("Failed to fetch tables:", error)
      } finally {
        setLoadingTables(false)
      }
    }
    fetchTables()
  }, [authToken, adminToken, location.pathname]) // Re-fetch tables if authToken changes or on route change

  const fetchActivities = async () => {
    if (!staffRole) {
      setLoadingActivities(false)
      return
    }

    const headers = getAuthHeaders()
    if (!headers.Authorization && !headers['X-ADMIN-TOKEN'] && !headers['X-STAFF-TOKEN']) {
      setLoadingActivities(false)
      return
    }

    if (isFirstLoadRef.current) {
      setLoadingActivities(true)
    } else {
      setRefreshingActivities(true)
    }
    console.debug('Staff activities fetch headers:', headers)
    try {
      try {
        const data: any = await apiFetch(`/payments/staff/activities/?role=${staffRole}`, { headers })
        setActivities(data.activities || [])
        setSummary({
          orders_taken: data.summary?.orders_taken ?? 0,
          tables_served: data.summary?.tables_served ?? 0,
          completed_orders: data.summary?.completed_orders ?? 0,
        })
      } catch (err: any) {
        if (err?.status === 403) {
          await handleStaffUnauthorized(err)
          return
        }
        const status = err?.status
        console.error("Failed to fetch activities:", status, err?.body || err)
        if (status !== 404) {
          toast({
            title: "Activity Feed Error",
            description: `Could not load staff activities. Server responded with ${status || 'error'}.`,
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error fetching activities:", error)
      setActivities([])
      setSummary({ orders_taken: 0, tables_served: 0, completed_orders: 0 })
    } finally {
      setLoadingActivities(false)
      setRefreshingActivities(false)
      isFirstLoadRef.current = false
    }
  }

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 10000)
    return () => clearInterval(interval)
  }, [staffRole, authToken, adminToken, staffToken, toast])

  const fetchBriefing = async () => {
    const hasStaffSession = !!staffToken
    const hasAnyAuth = !!authToken
    if (!hasAnyAuth) {
      setLoadingBriefing(false)
      return
    }

    setLoadingBriefing(true)
    try {
      const data: any = await apiFetch('/payments/staff/briefing/', { headers: getAuthHeaders() })
      setBriefing(data)
      setBriefingError(null)
    } catch (err: any) {
      if (err?.status === 403) {
        await handleStaffUnauthorized(err)
        return
      }
      console.error('Failed to fetch AI staff briefing:', err)
      setBriefing(null)
      setBriefingError('AI briefing unavailable. Refresh to try again.')
    } finally {
      setLoadingBriefing(false)
    }
  }

  useEffect(() => {
    fetchBriefing()
    const briefingInterval = setInterval(fetchBriefing, 300000)
    return () => clearInterval(briefingInterval)
  }, [authToken, adminToken, staffToken, toast])

  // SSE listener for order ready notifications (waiter only)
  useEffect(() => {
    const eventSource = new EventSource(getSseUrl('/payments/stream/'))
    const staffId = getStaffId()
    const isWaiter = roleLower === 'waiter'

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)

        if (payload?.type === 'order_ready' && payload.data?.source === 'kds') {
          const data = payload.data || {}
          const isTakeaway = data.order_type === 'takeaway'

          if (isWaiter && isTakeaway) {
            return
          }

          if (isWaiter) {
            const waiterIdMatch = staffId && data.waiter_id && String(data.waiter_id) === String(staffId)
            const waiterNameMatch = !waiterIdMatch && staffName && data.waiter_name && String(data.waiter_name).toLowerCase() === staffName.toLowerCase()

            if (waiterIdMatch || waiterNameMatch) {
              const orderLabel = data.order_id ? `Order #${String(data.order_id).substring(0, 6)}` : 'Your order'
              const locationLabel = data.table || 'Order'

              toast({
                title: `🔔 ${orderLabel} is ready!`,
                description: `${locationLabel} is ready to be picked up!`,
                variant: 'default',
              })

              fetchActivities().catch(() => {
                const newActivity: StaffActivity = {
                  action: 'Order Ready Notification',
                  description: `${locationLabel} ${orderLabel} is ready`,
                  order_id: data.order_id,
                  table: data.table,
                  time: data.created_at || new Date().toISOString(),
                }
                setActivities((prev) => [newActivity, ...prev].slice(0, 30))
              })

              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==')
                audio.play().catch(() => {})
              } catch (err) {
                // Silently ignore audio errors
              }
            }
          }

          if (isChef) {
            const chefIdMatch = staffId && data.assigned_chef_id && String(data.assigned_chef_id) === String(staffId)
            const chefNameMatch = !chefIdMatch && staffName && data.assigned_chef_name && String(data.assigned_chef_name).toLowerCase() === staffName.toLowerCase()

            if (chefIdMatch || chefNameMatch) {
              const orderLabel = data.order_id ? `Order #${String(data.order_id).substring(0, 6)}` : 'Order'
              const locationLabel = data.table || 'Order'

              toast({
                title: `🚨 ${orderLabel} assigned`,
                description: `You are assigned to receive ${locationLabel}.`,
                variant: 'default',
              })

              fetchActivities().catch(() => {
                const newActivity: StaffActivity = {
                  action: 'Order Pickup Assignment',
                  description: `${locationLabel} ${orderLabel} assigned to you for pickup`,
                  order_id: data.order_id,
                  table: data.table,
                  time: data.created_at || new Date().toISOString(),
                }
                setActivities((prev) => [newActivity, ...prev].slice(0, 30))
              })

              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==')
                audio.play().catch(() => {})
              } catch (err) {
                // Silently ignore audio errors
              }
            }
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [toast, roleLower, staffName, isChef])

  const staffStats = [
    // Visible only to waiters
    { label: 'Orders Taken', value: summary.orders_taken.toString(), icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10', roles: ['waiter'] },
    { label: 'Tables Served', value: summary.tables_served.toString(), icon: UtensilsCrossed, color: 'text-orange-400', bg: 'bg-orange-500/10', roles: ['waiter'] },
    { label: 'Completed Orders', value: summary.completed_orders.toString(), icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', roles: ['waiter'] },
  ];

  const visibleStats = staffStats.filter(s => s.roles.includes(roleLower));

  // Calculate table counts
  const availableTables = tables.filter(t => t.status === 'available').length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;

  const handleLogout = () => {
    clearStaffSession();
    navigate('/staff/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 overflow-x-hidden">
      <div className="w-full space-y-8 overflow-x-hidden">
        {/* Header Section */}
        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr] items-start">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-700/50 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-950 p-10 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)]">
              {/* Animated background elements */}
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-3xl"></div>
              <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full blur-3xl"></div>
              
              <div className="relative space-y-8">
                {/* Welcome Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="rounded-full border border-orange-500/40 bg-gradient-to-r from-orange-500/20 to-orange-400/10 px-4 py-2 text-[11px] font-bold font-display uppercase tracking-[0.4em] text-orange-300 shadow-lg shadow-orange-500/10">
                      {staffRole || (isAdmin ? 'Administrator' : 'Team Member')}
                    </span>
                    <div className="h-1 w-1 rounded-full bg-slate-600"></div>
                    <p className="text-xs font-medium font-display text-slate-400">Welcome back</p>
                  </div>
                  <div>
                    <p className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight">
                      Hey, <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{staffName || 'Team Member'}</span>
                    </p>
                    <p className="text-sm text-slate-400 mt-2">Ready to serve? Your workstation awaits.</p>
                  </div>
                </div>

                {/* Main Action Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
                  <Link 
                    to="/" 
                    className="group relative overflow-hidden rounded-[1.25rem] border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 transition-all duration-300 hover:border-slate-600 hover:from-slate-800/80 hover:to-slate-900/80 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-700/0 via-white/5 to-slate-700/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex flex-col items-center justify-center gap-3 h-full">
                      <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-3 group-hover:scale-110 transition-transform duration-300">
                        <Home size={24} className="text-blue-400" />
                      </div>
                      <span className="text-xs font-bold font-display uppercase tracking-[0.15em] text-slate-300 group-hover:text-white transition-colors">Home</span>
                    </div>
                  </Link>

                  {(canAccessPOS && roleLower !== 'cashier') && (
                    <Link 
                      to="/staff/pos" 
                      className="group relative overflow-hidden rounded-[1.25rem] border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-amber-500/10 p-5 shadow-[0_15px_40px_-15px_rgba(249,115,22,0.3)] transition-all duration-300 hover:border-orange-400/50 hover:from-orange-500/30 hover:to-amber-500/20 hover:shadow-[0_25px_60px_-15px_rgba(249,115,22,0.4)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-600/0 via-white/10 to-orange-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex flex-col items-center justify-center gap-3 h-full">
                        <div className="rounded-xl bg-gradient-to-br from-orange-500/40 to-orange-600/20 p-3 group-hover:scale-110 transition-transform duration-300">
                          <ShoppingCart size={24} className="text-orange-300" />
                        </div>
                        <span className="text-xs font-bold font-display uppercase tracking-[0.15em] text-orange-200 group-hover:text-orange-100 transition-colors">POS</span>
                      </div>
                    </Link>
                  )}

                  {canAccessKDS && (
                    <Link 
                      to="/staff/kds" 
                      className="group relative overflow-hidden rounded-[1.25rem] border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-pink-500/10 p-5 shadow-[0_15px_40px_-15px_rgba(168,85,247,0.3)] transition-all duration-300 hover:border-purple-400/50 hover:from-purple-500/30 hover:to-pink-500/20 hover:shadow-[0_25px_60px_-15px_rgba(168,85,247,0.4)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-white/10 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex flex-col items-center justify-center gap-3 h-full">
                        <div className="rounded-xl bg-gradient-to-br from-purple-500/40 to-purple-600/20 p-3 group-hover:scale-110 transition-transform duration-300">
                          <UtensilsCrossed size={24} className="text-purple-300" />
                        </div>
                        <span className="text-xs font-bold font-display uppercase tracking-[0.15em] text-purple-200 group-hover:text-purple-100 transition-colors">Kitchen</span>
                      </div>
                    </Link>
                  )}

                  {canAccessCashier && (
                    <Link 
                      to="/staff/cashier" 
                      className="group relative overflow-hidden rounded-[1.25rem] border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 p-5 shadow-[0_15px_40px_-15px_rgba(16,185,129,0.3)] transition-all duration-300 hover:border-emerald-400/50 hover:from-emerald-500/30 hover:to-teal-500/20 hover:shadow-[0_25px_60px_-15px_rgba(16,185,129,0.4)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/0 via-white/10 to-emerald-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex flex-col items-center justify-center gap-3 h-full">
                        <div className="rounded-xl bg-gradient-to-br from-emerald-500/40 to-emerald-600/20 p-3 group-hover:scale-110 transition-transform duration-300">
                          <CreditCard size={24} className="text-emerald-300" />
                        </div>
                        <span className="text-xs font-bold font-display uppercase tracking-[0.15em] text-emerald-200 group-hover:text-emerald-100 transition-colors">Cashier</span>
                      </div>
                    </Link>
                  )}

                  {!isAdmin && (
                    <button 
                      onClick={handleLogout} 
                      className="group relative overflow-hidden rounded-[1.25rem] border border-red-500/20 bg-gradient-to-br from-red-500/15 to-red-600/5 p-5 transition-all duration-300 hover:border-red-500/40 hover:from-red-500/25 hover:to-red-600/15 hover:shadow-[0_20px_60px_-20px_rgba(239,68,68,0.3)]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-white/5 to-red-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex flex-col items-center justify-center gap-3 h-full">
                        <div className="rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 p-3 group-hover:scale-110 transition-transform duration-300">
                          <LogOut size={24} className="text-red-400" />
                        </div>
                        <span className="text-xs font-bold font-display uppercase tracking-[0.15em] text-red-300 group-hover:text-red-200 transition-colors">Logout</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Status Bar */}
                <div className="pt-4 border-t border-slate-700/30 flex items-center justify-between text-xs font-display text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span>Station active</span>
                  </div>
                  <span className="text-slate-500">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            {visibleStats.length > 0 && (
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleStats.map((stat) => (
                  <div key={stat.label} className={`rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.60)] ${stat.bg}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-display uppercase tracking-[0.3em] text-slate-500">{stat.label}</p>
                        <p className="mt-4 text-4xl font-semibold font-display text-slate-100">{stat.value}</p>
                      </div>
                      <div className={`grid h-14 w-14 place-items-center rounded-3xl ${stat.color} bg-white/5`}>
                        <stat.icon size={24} />
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {canAccessCashier && (
              <section className="rounded-[2rem] border border-slate-800 bg-slate-950/90 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] backdrop-blur-xl overflow-hidden max-w-full">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-display uppercase tracking-[0.3em] text-slate-500">Cashier Workstation</p>
                    <h2 className="mt-3 text-3xl text-slate-100 font-display font-bold">Process payments and settle orders</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCashierCollapsed((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900 transition"
                    aria-expanded={!cashierCollapsed}
                  >
                    {cashierCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    {cashierCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>
                {!cashierCollapsed && (
                  <div className="mt-6 grid grid-cols-1 w-full max-w-full gap-8 lg:grid-cols-[1.5fr_1fr] items-start">
                    <div className="min-w-0">
                      <p className="mt-0 text-slate-400 leading-7 max-w-2xl">
                        Open the cashier console to confirm payments, print receipts, and manage open tickets in one reliable workflow.
                      </p>
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap w-full max-w-full">
                        <Link
                          to="/staff/cashier"
                          className="inline-flex min-w-0 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold font-display text-slate-950 shadow-lg shadow-orange-500/20 transition duration-300 hover:from-orange-400 hover:to-amber-400 sm:w-auto"
                        >
                          <CreditCard size={20} />
                          <span>Launch Cashier</span>
                        </Link>
                        <span className="inline-flex min-w-0 w-full items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm font-display text-slate-300 sm:w-auto">
                          <Bell size={18} />
                          <span>Live cash flow and ticket management</span>
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-6 shadow-sm shadow-black/20 w-full max-w-full min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                        <div className="min-w-0">
                          <p className="text-sm font-display uppercase tracking-[0.3em] text-slate-500">Cashier Activity</p>
                          <h3 className="mt-2 text-2xl font-display font-bold text-slate-100">Recent events</h3>
                        </div>
                        <TrendingUp className="text-slate-500" size={22} />
                      </div>
                      <div className="space-y-3">
                        {loadingActivities ? (
                          <p className="text-slate-400 animate-pulse">Loading cashier activity...</p>
                        ) : activities.length === 0 ? (
                          <p className="text-slate-400">No recent cashier activity available.</p>
                        ) : (
                          activities.map((activity, activityIndex) => {
                            const activityId = activity.id
                            return (
                              <div key={activityId ?? `${activity.action}-${activity.time}-${activityIndex}`} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-slate-800 bg-slate-900/95 px-5 py-4 shadow-sm shadow-slate-950/20 transition duration-300 hover:border-slate-700">
                                <div className="min-w-0" className="min-w-0">
                                  <p className="font-semibold font-display text-slate-200">{activity.action}</p>
                                  {activity.table && <p className="text-xs text-slate-400 truncate">Table: {activity.table}</p>}
                                  {activity.order_id && <p className="text-xs text-slate-400 truncate">Order: {activity.order_id}</p>}
                                </div>
                                <span className="text-xs text-slate-500 italic whitespace-nowrap">{activity.time}</span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-6 h-full">
            <section className="flex-1 rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-display uppercase tracking-[0.3em] text-slate-500">Staff Quick Panel</p>
                    <h2 className="mt-2 text-2xl font-display font-bold text-slate-100">Desktop-ready tools</h2>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] font-display uppercase tracking-[0.32em] text-slate-400">Action Center</span>
                </div>
                <p className="text-sm leading-6 text-slate-400">
                  Optimize your shift with quick actions, live table counts, and operational guidance in a refined card layout.
                </p>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-5">
                  <p className="text-xs font-display uppercase tracking-[0.3em] text-slate-500">Live Tables</p>
                  <p className="mt-3 text-4xl font-semibold font-display text-slate-100">{availableTables}</p>
                  <p className="mt-2 text-sm font-display text-slate-500">Available tables ready for service</p>
                </div>
                <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-5">
                  <p className="text-xs font-display uppercase tracking-[0.3em] text-slate-500">Occupied</p>
                  <p className="mt-3 text-4xl font-semibold font-display text-slate-100">{occupiedTables}</p>
                  <p className="mt-2 text-sm font-display text-slate-500">Currently in service</p>
                </div>
              </div>
            </section>
            {/* Mobile: keep Quick Instructions inside the sidebar area */}
            <section className="lg:hidden rounded-[2rem] border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-black/10">
              <p className="text-sm font-display uppercase tracking-[0.3em] text-slate-500">Quick Instructions</p>
              <ul className="mt-3 space-y-2 text-sm font-display text-slate-400">
                <li className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">Use the POS shortcut for new orders and split bills.</li>
                <li className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">Open KDS to track kitchen progress for live cooking orders.</li>
                <li className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">Log out when your shift ends to keep the workstation secure.</li>
              </ul>
            </section>
          </aside>
        </div>

        <section className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl shadow-slate-950/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-2xl text-slate-100">Shift Announcements</h3>
                <span className="rounded-full bg-slate-800/90 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-slate-400">Powered by AI</span>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                {loadingBriefing
                  ? 'Generating your AI-powered shift briefing…'
                  : briefing
                  ? 'Updated by Tasty Bites AI with the latest order flow, staffing, and performance signals.'
                  : briefingError || 'AI briefing is unavailable right now.'}
              </p>
            </div>
            <Bell className="text-orange-500" size={24} />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-3xl border border-orange-500/20 bg-orange-500/10 p-6 min-h-[170px]">
              <p className="text-xs uppercase tracking-[0.32em] text-orange-300">AI Staff Briefing</p>
              <div className="mt-3 space-y-4 text-slate-100 text-sm leading-7">
                {loadingBriefing ? (
                  <p className="text-slate-300">Loading briefing…</p>
                ) : briefing ? (
                  briefing.sections.slice(0, 3).map((section) => (
                    <div key={section.title}>
                      <p className="font-semibold text-slate-100">{section.title}</p>
                      {section.messages?.slice(0, 2).map((message, index) => (
                        <p key={index} className="text-slate-200">{message}</p>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-300">No briefing available. Refresh the page or try again later.</p>
                )}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Shift Checklist</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {canAccessKDS && (
                  <Link to="/staff/kds" className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-5 py-3 text-sm text-slate-200 hover:border-slate-600">
                    <UtensilsCrossed size={18} />
                    Kitchen Display
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Instructions moved to top as full-width card */}
        <section className="hidden lg:block bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl shadow-slate-950/10">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Quick Instructions</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-400">
            <li className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-sm shadow-black/5">Use the POS shortcut for new orders and split bills.</li>
            <li className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-sm shadow-black/5">Open KDS to track kitchen progress for live cooking orders.</li>
            <li className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 shadow-sm shadow-black/5">Log out when your shift ends to keep the workstation secure.</li>
          </ul>
        </section>

        {/* Performance Overview removed for cashier/staff landing */}
        
      </div>
    </div>
  );

};

export default StaffPage;
