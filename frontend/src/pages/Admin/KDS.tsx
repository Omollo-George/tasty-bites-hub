import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AdminHeader from '@/components/AdminHeader';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';
import { getStaffRole } from '@/lib/staff-session';
import { getApiUrl } from '@/lib/api';
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
}

const AdminKDS: React.FC = () => {
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const adminToken = getAdminToken();
  const isAdmin = adminToken && isAdminSessionValid(); // Check if admin is logged in
  const staffRole = getStaffRole()?.toLowerCase();
  const authToken = getAuthToken(); // Get the appropriate token
  
  const canAccess = isAdmin || ['chef', 'manager'].includes(staffRole || '');

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
      setQueue(data.queue || []);
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

  useEffect(() => {
    fetchQueue(true);
    const interval = setInterval(fetchQueue, 5000); // Refresh every 5 seconds

    const eventSource = new EventSource('/payments/stream/');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type && ['order_update', 'new_order', 'order_ready'].includes(payload.type)) {
          fetchQueue();
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
      eventSource.close();
    };
  }, [authToken]);

  if (!canAccess && !loading) {
    toast({ title: "Access Denied", description: "You don't have permission to view the Kitchen Display System.", variant: "destructive" });
    return <Navigate to="/staff" replace />;
  }

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {queue.length === 0 ? (
          <div className="lg:col-span-3 text-center text-slate-500 py-12">
            <p className="text-xl">No active orders in the queue.</p>
            <p className="text-sm">Time to relax, chef!</p>
          </div>
        ) : (
          queue.map((order) => (
            <div key={order.order_id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display text-2xl text-[#d69e2e]">Order #{order.order_id.substring(0, 6)}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                    order.status === 'preparing' || order.status === 'sent_kitchen' ? 'bg-amber-900/30 text-amber-400' : // KDS should show 'sent_kitchen' as preparing
                    order.status === 'ready' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-emerald-900/30 text-emerald-400'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">Table: {order.table} | {new Date(order.created_at).toLocaleTimeString()}</p>
                {(order.waiter_name || order.waiter_id) && (
                  <p className="text-sm text-slate-300 mb-4">
                    Waiter: {order.waiter_name || 'Unknown'}{order.waiter_id ? ` (ID: ${order.waiter_id})` : ''}
                  </p>
                )}
                <ul className="space-y-2 mb-6">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-slate-200">
                      <span className="font-semibold">{item.quantity}x {item.name}</span>
                      {item.is_served && (
                        <span className="text-xs text-emerald-400 ml-2">(Served)</span>
                      )}
                      {(item.modifiers || []).length > 0 && !item.is_served && (
                        <span className="text-xs text-slate-500 ml-2">({item.modifiers.join(', ')})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => updateOrderStatus(order.order_id, 'ready')}
                  className="w-full bg-[#d69e2e] text-[#1a365d] px-6 py-3 rounded-full font-semibold hover:bg-[#d69e2e]/80 transition-colors"
                >
                  Mark Ready
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminKDS;