import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AdminHeader from '@/components/AdminHeader';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';
import { getStaffId, getStaffName, getNormalizedStaffRole } from '@/lib/staff-session';
import { getApiUrl, getSseUrl } from '@/lib/api';
import { getAuthToken, getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  modifiers: string[];
  is_served?: boolean; // Added for item-level status
  seat: number;
}

interface Order {
  order_id: string;
  table: string;
  items: OrderItem[];
  created_at: string;
  status: string;
  phone: string;
  total_amount: number;
  split_count: number;
  waiter_name?: string;
  waiter_id?: string | number;
  order_type?: string;
  claimed_by_id?: string | number | null;
  claimed_by_name?: string;
  claimed_at?: string | null;
}

const AdminKDS: React.FC = () => {
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'takeaway' | 'dinein'>('all');
  const { toast } = useToast();
  const adminToken = getAdminToken();
  const isAdmin = adminToken && isAdminSessionValid(); // Check if admin is logged in
  const staffRole = getNormalizedStaffRole();
  const authToken = getAuthToken(); // Get the appropriate token
  
  const staffName = getStaffName() || '';
  const staffId = getStaffId();
  const canAccess = isAdmin || ['chef', 'manager', 'cook', 'kitchen'].includes(staffRole);

  const getOrderCategory = (orderType?: string) => {
    const normalized = (orderType || '').toLowerCase();
    if (normalized === 'takeaway' || normalized === 'delivery') return 'takeaway';
    return 'dinein';
  };

  const filteredQueue = queue.filter((order) => {
    if (ticketFilter === 'all') return true;
    return getOrderCategory(order.order_type) === ticketFilter;
  });

  const formatElapsedTime = (createdAt: string) => {
    try {
      const createdDate = new Date(createdAt);
      if (Number.isNaN(createdDate.getTime())) {
        return '--:--';
      }

      return createdDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '--:--';
    }
  };
  
  const sseDebounceRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = React.useRef<number>(0);

  const fetchQueue = async (initial = false) => {
    if (initial) {
      setLoading(true);
    }
    try {
      const res = await fetch(getApiUrl('/payments/kds/queue/'), {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });
      
      // Check content type first
      const contentType = res.headers.get("content-type") || '';
      if (!contentType.includes("application/json")) {
        throw new Error(`Server Error (${res.status}): Invalid response format. Expected JSON.`);
      }
      
      if (!res.ok) {
        try {
          const errorData = await res.json();
          throw new Error(errorData.error || `Server Error (${res.status}): Failed to fetch KDS queue`);
        } catch (e: any) {
          throw new Error(`Server Error (${res.status}): ${e.message || 'Failed to fetch KDS queue'}`);
        }
      }
      const data = await res.json();
      const queueItems = Array.isArray(data.queue) ? data.queue : [];
      const sortedQueueItems = [...queueItems].sort((a: any, b: any) => {
        const aTime = new Date(a?.created_at || 0).getTime();
        const bTime = new Date(b?.created_at || 0).getTime();
        return aTime - bTime;
      });
      setQueue(sortedQueueItems.map((order: any) => ({
        items: Array.isArray(order.items) ? order.items : [],
        ...order,
      })));
      lastFetchRef.current = Date.now();
    } catch (error) {
      console.error("Error fetching KDS queue:", error);
      toast({
        title: "KDS Error",
        description: "Could not load kitchen queue. Please check backend connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Debounced fetch for SSE events to prevent hammering the server
  const debouncedFetchQueue = React.useCallback(() => {
    // Clear existing timer
    if (sseDebounceRef.current) {
      clearTimeout(sseDebounceRef.current);
    }
    
    // Don't fetch more than once per 2 seconds
    const timeSinceLastFetch = Date.now() - lastFetchRef.current;
    if (timeSinceLastFetch < 2000) {
      sseDebounceRef.current = setTimeout(() => {
        fetchQueue();
      }, 2000 - timeSinceLastFetch);
    } else {
      fetchQueue();
    }
  }, []);

  useEffect(() => {
    fetchQueue(true);
    // Reduce polling from 5s to 15s since we have SSE for real-time updates
    const interval = setInterval(fetchQueue, 15000);

    const eventSource = new EventSource(getSseUrl('/payments/stream/'));
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type && ['order_update', 'new_order', 'order_ready', 'order_complete', 'order_claimed'].includes(payload.type)) {
          // Use debounced fetch to avoid excessive requests
          debouncedFetchQueue();
        }
      } catch (err) {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      clearInterval(interval);
      if (sseDebounceRef.current) {
        clearTimeout(sseDebounceRef.current);
      }
      eventSource.close();
    };
  }, [authToken, debouncedFetchQueue]);

  if (!canAccess && !loading) {
    toast({ title: "Access Denied", description: "You don't have permission to view the Kitchen Display System.", variant: "destructive" });
    return <Navigate to="/staff" replace />;
  }

  const claimOrder = async (orderId: string) => {
    try {
      const res = await fetch(getApiUrl(`/payments/kds/claim/${encodeURIComponent(orderId)}/`), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ? `${data.error}: ${data.claimed_by_name || ''}` : 'Failed to claim order');
      }
      toast({
        title: 'Order Claimed',
        description: `You have claimed order ${orderId}.`,
      });
      fetchQueue();
    } catch (error) {
      console.error('Error claiming order:', error);
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Could not claim this order.',
        variant: 'destructive',
      });
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(getApiUrl(`/payments/orders/${encodeURIComponent(orderId)}/update/`), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      // Check content type first
      const contentType = res.headers.get("content-type") || '';
      if (!contentType.includes("application/json")) {
        throw new Error(`Server Error (${res.status}): Invalid response format. Expected JSON.`);
      }
      
      if (!res.ok) {
        try {
          const errorData = await res.json();
          throw new Error(errorData.error || `Server Error (${res.status}): Failed to update order status`);
        } catch (e: any) {
          throw new Error(`Server Error (${res.status}): ${e.message || 'Failed to update order status'}`);
        }
      }
      
      toast({
        title: "Order Updated",
        description: `Order ${orderId} status changed to ${newStatus}.`,
      });
      fetchQueue(); // Re-fetch to update UI
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({
        title: "Update Failed",
        description: `Could not update status for order ${orderId}.`,
        variant: "destructive",
      });
    }
  };

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading Kitchen Display System...</div>;

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-slate-100">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/staff" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="font-display text-3xl text-slate-100">Kitchen Display System</h1>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'takeaway', 'dinein'] as const).map((filter) => {
          const isActive = ticketFilter === filter;
          const label = filter === 'all' ? 'All' : filter === 'takeaway' ? 'Takeaway' : 'Dine-in';
          return (
            <button
              key={filter}
              onClick={() => setTicketFilter(filter)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${isActive ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 pb-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950 max-h-[70vh]">
        {filteredQueue.length === 0 ? (
          <div className="min-w-full text-center text-slate-500 py-8">
            <p className="text-base">No active orders in the queue.</p>
            <p className="text-xs">Time to relax, chef!</p>
          </div>
        ) : (
          filteredQueue.map((order) => (
            <div key={order.order_id} className="relative overflow-visible rounded-xl border border-slate-800 bg-slate-950/95 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.55)] aspect-square md:aspect-auto md:min-h-[12rem]">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-transparent to-slate-950/95" />
              <div className="relative p-3 flex flex-col justify-between h-full">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.6rem] uppercase tracking-[0.28em] text-slate-500">Order</p>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">#{order.order_id.substring(0, 6).toUpperCase()}</h2>
                  </div>
                  <div className="flex-shrink-0 rounded-2xl border border-slate-800 bg-slate-900/90 px-2 py-1 text-right">
                    <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">Elapsed</p>
                    <p className="mt-0.5 text-xs font-semibold text-amber-400">{formatElapsedTime(order.created_at)}</p>
                  </div>
                </div>

                <div className="grid gap-2 grid-cols-2 mb-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-2">
                    <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">Table</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{order.table}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-2">
                    <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-semibold uppercase text-slate-100">{order.status}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-2 mb-2">
                  <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">Waiter</p>
                  <p className="mt-1 text-sm font-semibold leading-tight text-white">{order.waiter_name?.trim() ? order.waiter_name : 'Unassigned'}</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-2 mb-2">
                  <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">Preparing</p>
                  <p className="mt-1 text-sm font-semibold leading-tight text-white">{order.items.length}x {order.items[0]?.name || 'Item'}</p>
                </div>

                <div className="space-y-2 text-slate-300 mb-3">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900/95 px-2 py-1">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.quantity}x {item.name}</p>
                        {(item.modifiers || []).length > 0 && (
                          <p className="mt-0.5 text-[0.68rem] text-slate-500">{item.modifiers.join(', ')}</p>
                        )}
                      </div>
                      {item.is_served ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.25em] text-emerald-300">Served</span>
                      ) : null}
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="text-[0.68rem] text-slate-500">+{order.items.length - 3} more item{order.items.length - 3 === 1 ? '' : 's'}</div>
                  )}
                </div>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  <button
                    onClick={() => claimOrder(order.order_id)}
                    disabled={Boolean(order.claimed_by_id && String(order.claimed_by_id) !== staffId)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-2 text-[0.78rem] font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {order.claimed_by_id ? (String(order.claimed_by_id) === staffId ? 'Claimed' : 'Claimed') : 'Claim'}
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.order_id, 'ready')}
                    disabled={Boolean(order.claimed_by_id && String(order.claimed_by_id) !== staffId)}
                    className="w-full rounded-lg bg-amber-400 px-2 py-2 text-[0.78rem] font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ready
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] text-slate-500">
                  {order.waiter_name ? <span className="rounded-2xl border border-slate-800 bg-slate-900/95 px-2 py-1">Waiter: {order.waiter_name}</span> : null}
                  {order.claimed_by_name ? <span className="rounded-2xl border border-slate-800 bg-slate-900/95 px-2 py-1">Chef: {order.claimed_by_name}</span> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminKDS;