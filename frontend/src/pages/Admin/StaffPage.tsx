import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, UtensilsCrossed, Clock, CheckCircle, TrendingUp, Bell, LayoutGrid, Users, LogOut, Home, Monitor, CreditCard } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { clearStaffSession, getStaffRole, getStaffName, getStaffToken, getStaffId } from '@/lib/staff-session';

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
  const roleLower = staffRole?.toLowerCase() || '';

  const canAccessPOS = isAdmin || ['waiter', 'cashier', 'manager'].includes(roleLower);
  const canAccessKDS = isAdmin || ['chef', 'manager'].includes(roleLower);
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
        const res = await fetch(getApiUrl(`/payments/staff/activities/?role=${staffRole}`), {
          headers: getAuthHeaders()
        })

        if (res.status === 403) {
          // Unauthorized - likely removed from shift or token expired
          handleStaffUnauthorized(res)
          return
        }

        if (!res.ok) {
          console.warn('Shift check returned status:', res.status)
          // For now, allow access even if check fails - they might have network issues
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
        const res = await fetch(getApiUrl('/payments/pos/tables/'), {
          headers: getAuthHeaders()
        })
        if (await handleStaffUnauthorized(res)) {
          return
        }
        const data = await res.json()
        setTables(data.tables || [])
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
      const res = await fetch(getApiUrl(`/payments/staff/activities/?role=${staffRole}`), {
        headers
      })
      if (await handleStaffUnauthorized(res)) {
        return
      }

      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities || [])
        setSummary({
          orders_taken: data.summary?.orders_taken ?? 0,
          tables_served: data.summary?.tables_served ?? 0,
          completed_orders: data.summary?.completed_orders ?? 0,
        })
      } else {
        const errorText = await res.text()
        console.error("Failed to fetch activities:", res.status, errorText)
        if (res.status !== 404) {
          toast({
            title: "Activity Feed Error",
            description: `Could not load staff activities. Server responded with ${res.status}.`,
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
    const eventSource = new EventSource(getApiUrl('/payments/stream/'))
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
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-400 font-medium italic">Welcome back, {staffName || (isAdmin ? 'Administrator' : 'Team Member')}</p>
              {staffRole && <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">{staffRole}</span>}

            </div>
            <h1 className="font-display text-4xl text-slate-100 mt-1 uppercase tracking-tight">Staff Workstation</h1>
          </div>
          <div className="flex gap-3">
             {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95">
                <Monitor size={20} />
                <span className="hidden sm:inline">Admin Dashboard</span>
              </Link>
             )}
             <Link to="/" className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95">
                <Home size={20} />
                <span className="hidden sm:inline">Home</span>
             </Link>
             {!isAdmin && ( // Only show logout for non-admin staff
               <button onClick={handleLogout} className="bg-slate-800 border border-slate-700 text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2">
                 <LogOut size={20} /><span>Logout</span>
               </button>
             )}
             {(canAccessPOS && roleLower !== 'cashier') && (
               <Link to="/staff/pos" className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 flex items-center gap-2">
                  <ShoppingCart size={20} />
                  <span>Launch POS</span>
               </Link>
             )}
             {canAccessKDS && (
               <Link to="/staff/kds" className="bg-slate-800 border border-slate-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2">
                  <UtensilsCrossed size={20} />
                  <span>Kitchen Display</span>
               </Link>
             )}
          </div>
        </div>
        {canAccessCashier && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-6 shadow-xl shadow-slate-950/20">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cashier Workstation</p>
                <h2 className="text-3xl text-slate-100 font-display mt-3">Process payments and settle orders.</h2>
                <p className="mt-3 text-slate-400 text-sm sm:text-base">
                  Open the cashier console to confirm payments, print receipts, and manage open tickets with the same smooth interface as the cashier home page.
                </p>
              </div>
              <Link
                to="/staff/cashier"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-orange-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
              >
                <CreditCard size={20} />
                <span>Launch Cashier</span>
              </Link>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cashier Activity</p>
                  <h3 className="text-2xl font-display text-slate-100">Recent cashier events</h3>
                </div>
                <TrendingUp className="text-slate-500" size={20} />
              </div>

              <div className="space-y-4">
                {loadingActivities ? (
                  <p className="text-slate-400 animate-pulse">Loading cashier activity...</p>
                ) : activities.length === 0 ? (
                  <p className="text-slate-400">No recent cashier activity available.</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
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
          </section>
        )}

        {/* Performance Overview removed for cashier/staff landing */}
        
        {/* Table Status Overview (hidden for cashiers) */}
        {roleLower !== 'cashier' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-5 hover:border-slate-700 transition-colors">
              <div className="p-4 rounded-xl bg-blue-500/10 text-blue-400"><ShoppingCart size={28} /></div>
              <div><p className="text-sm text-slate-400 font-medium">Orders Taken</p><p className="text-2xl font-bold text-slate-100">{summary.orders_taken}</p></div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-5 hover:border-slate-700 transition-colors">
              <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400"><LayoutGrid size={28} /></div>
              <div><p className="text-sm text-slate-400 font-medium">Tables Served</p><p className="text-2xl font-bold text-slate-100">{summary.tables_served}</p></div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-5 hover:border-slate-700 transition-colors">
              <div className="p-4 rounded-xl bg-purple-500/10 text-purple-400"><CheckCircle size={28} /></div>
              <div><p className="text-sm text-slate-400 font-medium">Completed Orders</p><p className="text-2xl font-bold text-slate-100">{summary.completed_orders}</p></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                 {isAdmin && (
                   <Link to="/admin" className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95">
                      <Monitor size={20} />
                      <span className="hidden sm:inline">Admin Dashboard</span>
                   </Link>
                 )}
                 <Link to="/" className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95">
                    <Home size={20} />
                    <span className="hidden sm:inline">Home</span>
                 </Link>
                 {!isAdmin && ( // Only show logout for non-admin staff
                   <button onClick={handleLogout} className="bg-slate-800 border border-slate-700 text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2">
                     <LogOut size={20} /><span>Logout</span>
                   </button>
                 )}
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