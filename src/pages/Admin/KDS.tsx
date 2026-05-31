import React, { useEffect, useState } from 'react';
import AdminHeader from '@/components/AdminHeader';
import { getAdminToken } from '@/lib/admin-session';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  name: string;
  quantity: number;
  modifiers: string[];
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
}

const AdminKDS: React.FC = () => {
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const adminToken = getAdminToken();

  const fetchQueue = async (initial = false) => {
    if (initial) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/payments/kds/queue/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch KDS queue');
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
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/payments/orders/${encodeURIComponent(orderId)}/update/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update order status');
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
      <AdminHeader title="Kitchen Display System" />
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
                    order.status === 'preparing' ? 'bg-amber-900/30 text-amber-400' :
                    order.status === 'ready' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-emerald-900/30 text-emerald-400'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">Table: {order.table} | {new Date(order.created_at).toLocaleTimeString()}</p>
                <ul className="space-y-2 mb-6">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-slate-200">
                      <span className="font-semibold">{item.quantity}x {item.name}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <span className="text-xs text-slate-500 ml-2">({item.modifiers.join(', ')})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => updateOrderStatus(order.order_id, 'ready')}
                  className="flex-1 bg-[#d69e2e] text-[#1a365d] px-4 py-2 rounded-full font-semibold hover:bg-[#d69e2e]/80 transition-colors"
                >
                  Mark Ready
                </button>
                <button
                  onClick={() => updateOrderStatus(order.order_id, 'served')}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-blue-700 transition-colors"
                >
                  Mark Served
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