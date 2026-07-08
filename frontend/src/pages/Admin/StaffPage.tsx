import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, UtensilsCrossed, Clock, CheckCircle, TrendingUp, Bell, LayoutGrid, Users, LogOut, Home, Monitor, CreditCard } from 'lucide-react';
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

const StaffPage: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [summary, setSummary] = useState<StaffSummary>({ orders_taken: 0, tables_served: 0, completed_orders: 0 });
  const [loadingActivities, setLoadingActivities] = useState(true); // New state for activities loading
  const [refreshingActivities, setRefreshingActivities] = useState(false); // background refresh indicator
  const [shiftCheckLoading, setShiftCheckLoading] = useState(true); // Check if staff is on shift
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

  // SSE listener for order ready notifications (waiter only)
  useEffect(() => {
    const eventSource = new EventSource(getSseUrl('/payments/stream/'))
    const staffId = getStaffId()
    const isWaiter = roleLower === 'waiter'

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)

        if (isWaiter && payload?.type === 'order_ready') {
          const data = payload.data || {}
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
  }, [toast, roleLower, staffName])


  const staffStats = [
    // Visible only to waiters
    { label: 'Orders Taken', value: summary.orders_taken.toString(), icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10', roles: ['waiter'] },
    { label: 'Tables Served', value: summary.tables_served.toString(), icon: UtensilsCrossed, color: 'text-orange-400', bg: 'bg-orange-500/10', roles: ['waiter'] },
    { label: 'Completed Orders', value: summary.completed_orders.toString(), icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', roles: ['waiter'] },
  ];

  const visibleStats = isAdmin 
    ? staffStats 
    : staffStats.filter(s => s.roles.includes(roleLower));

  // Calculate table counts
  const availableTables = tables.filter(t => t.status === 'available').length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;

  const handleLogout = () => {
    clearStaffSession();
    navigate('/staff/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="w-full space-y-8">
        {/* Header Section */}
        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr] items-start">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-300">{staffRole || (isAdmin ? 'Administrator' : 'Team Member')}</span>
                    <p className="text-sm text-slate-400">Welcome back, {staffName || (isAdmin ? 'Administrator' : 'Team Member')}</p>
                  </div>
                  <h1 className="font-display text-4xl sm:text-5xl text-slate-100 uppercase tracking-tight">Staff Workstation</h1>
                  <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300">Updated design active</span>
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">
                    Your staff dashboard puts POS, kitchen flow, and shift controls in one polished workspace. Launch actions fast and stay focused on service.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <Link to="/" className="w-full min-h-[104px] flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4 text-slate-100 transition hover:border-slate-700 hover:bg-slate-900/95 shadow-sm shadow-black/10">
                    <Home size={22} />
                    <span className="text-xs uppercase tracking-[0.16em] whitespace-nowrap">Home</span>
                  </Link>
                  {(canAccessPOS && roleLower !== 'cashier') && (
                    <Link to="/staff/pos" className="w-full min-h-[104px] flex flex-col items-center justify-center gap-2 rounded-3xl bg-orange-500 px-4 py-4 text-white transition hover:bg-orange-600 shadow-lg shadow-orange-500/20">
                      <ShoppingCart size={22} />
                      <span className="text-xs uppercase tracking-[0.16em] whitespace-nowrap">POS</span>
                    </Link>
                  )}
                  {canAccessKDS && (
                    <Link to="/staff/kds" className="w-full min-h-[104px] flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4 text-slate-100 transition hover:border-slate-700 hover:bg-slate-900/95 shadow-sm shadow-black/10">
                      <UtensilsCrossed size={22} />
                      <span className="text-xs uppercase tracking-[0.16em] whitespace-nowrap">KDS</span>
                    </Link>
                  )}
                  {canAccessCashier && (
                    <Link to="/staff/cashier" className="w-full min-h-[104px] flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4 text-slate-100 transition hover:border-slate-700 hover:bg-slate-900/95 shadow-sm shadow-black/10">
                      <CreditCard size={22} />
                      <span className="text-xs uppercase tracking-[0.16em] whitespace-nowrap">Cashier</span>
                    </Link>
                  )}
                  {!isAdmin && (
                    <button onClick={handleLogout} className="w-full min-h-[104px] flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-4 text-slate-100 transition hover:border-slate-700 hover:bg-slate-900/95 shadow-sm shadow-black/10">
                      <LogOut size={22} />
                      <span className="text-xs uppercase tracking-[0.16em] whitespace-nowrap">Logout</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {visibleStats.length > 0 && (
              <section className="grid gap-4 md:grid-cols-3">
                {visibleStats.map((stat) => (
                  <div key={stat.label} className={`rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/20 ${stat.bg}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{stat.label}</p>
                        <p className="mt-4 text-4xl font-semibold text-slate-100">{stat.value}</p>
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
              <section className="rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
                <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cashier Workstation</p>
                    <h2 className="mt-3 text-3xl text-slate-100 font-display">Process payments and settle orders</h2>
                    <p className="mt-4 text-slate-400 leading-7">
                      Open the cashier console to confirm payments, print receipts, and manage open tickets in one reliable workflow.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        to="/staff/cashier"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
                      >
                        <CreditCard size={20} />
                        <span>Launch Cashier</span>
                      </Link>
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                        <Bell size={18} />
                        <span>Live cash flow and ticket management</span>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cashier Activity</p>
                        <h3 className="mt-2 text-2xl font-display text-slate-100">Recent events</h3>
                      </div>
                      <TrendingUp className="text-slate-500" size={22} />
                    </div>
                    <div className="space-y-3">
                      {loadingActivities ? (
                        <p className="text-slate-400 animate-pulse">Loading cashier activity...</p>
                      ) : activities.length === 0 ? (
                        <p className="text-slate-400">No recent cashier activity available.</p>
                      ) : (
                        activities.map((activity) => (
                          <div key={activity.id} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-4 transition hover:border-slate-700">
                            <div>
                              <p className="font-semibold text-slate-200">{activity.action}</p>
                              {activity.table && <p className="text-xs text-slate-400">Table: {activity.table}</p>}
                              {activity.order_id && <p className="text-xs text-slate-400">Order: {activity.order_id}</p>}
                            </div>
                            <span className="text-xs text-slate-500 italic">{activity.time}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-6 h-full">
            <section className="flex-1 rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Staff Quick Panel</p>
                    <h2 className="mt-2 text-2xl font-display text-slate-100">Desktop-ready tools</h2>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] uppercase tracking-[0.32em] text-slate-400">Action Center</span>
                </div>
                <p className="text-sm leading-6 text-slate-400">
                  Optimize your shift with quick actions, live table counts, and operational guidance in a refined card layout.
                </p>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live Tables</p>
                  <p className="mt-3 text-4xl font-semibold text-slate-100">{availableTables}</p>
                  <p className="mt-2 text-sm text-slate-500">Available tables ready for service</p>
                </div>
                <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Occupied</p>
                  <p className="mt-3 text-4xl font-semibold text-slate-100">{occupiedTables}</p>
                  <p className="mt-2 text-sm text-slate-500">Currently in service</p>
                </div>
              </div>
            </section>
            {/* Mobile: keep Quick Instructions inside the sidebar area */}
            <section className="lg:hidden rounded-[2rem] border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-black/10">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Quick Instructions</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">Use the POS shortcut for new orders and split bills.</li>
                <li className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">Open KDS to track kitchen progress for live cooking orders.</li>
                <li className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3">Log out when your shift ends to keep the workstation secure.</li>
              </ul>
            </section>
          </aside>
        </div>

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
        
        {/* Table Status Overview (hidden for cashiers) */}
        {roleLower !== 'cashier' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-slate-700 transition-colors min-h-[130px]">
              <div className="p-4 rounded-xl bg-blue-500/10 text-blue-400"><ShoppingCart size={28} /></div>
              <div className="min-w-0">
                <p className="text-sm text-slate-400 font-medium">Orders Taken</p>
                <p className="text-2xl font-bold text-slate-100">{summary.orders_taken}</p>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-slate-700 transition-colors min-h-[130px]">
              <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400"><LayoutGrid size={28} /></div>
              <div className="min-w-0">
                <p className="text-sm text-slate-400 font-medium">Tables Served</p>
                <p className="text-2xl font-bold text-slate-100">{summary.tables_served}</p>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-start gap-4 hover:border-slate-700 transition-colors min-h-[130px]">
              <div className="p-4 rounded-xl bg-purple-500/10 text-purple-400"><CheckCircle size={28} /></div>
              <div className="min-w-0">
                <p className="text-sm text-slate-400 font-medium">Completed Orders</p>
                <p className="text-2xl font-bold text-slate-100">{summary.completed_orders}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {/* Announcements & Shift Checklist */}
          <section className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-2xl text-slate-100">Shift Announcements</h3>
              <Bell className="text-orange-500 animate-bounce" size={18} />
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl text-orange-200">
              <p className="font-bold mb-2">Today's Focus</p>
              <p className="text-sm leading-relaxed">
                Remember to promote the new Spicy Garlic Burger! We have limited stock on Avocado side salads. 
                Ensure all tables are sanitized within 5 minutes of customer departure.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Shift Checklist</h4>
              <div className="flex gap-3">
                 {canAccessKDS && (
                   <Link to="/staff/kds" className="bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2">
                      <UtensilsCrossed size={20} />
                      <span>Kitchen Display</span>
                   </Link>
                 )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

};

export default StaffPage;
