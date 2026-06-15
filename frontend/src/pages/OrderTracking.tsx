import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import TastyBitesIcon from '@/components/TastyBitesIcon';
import { ArrowLeft } from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  modifiers: string[];
}

interface OrderDetails {
  order_id: string;
  table: string;
  phone: string;
  status: string;
  total_amount: number;
  is_paid: boolean;
  created_at: string;
  items: OrderItem[];
}

const OrderTracking: React.FC = () => {
  const { orderId: paramOrderId } = useParams<{ orderId?: string }>();
  const [orderIdInput, setOrderIdInput] = useState(paramOrderId || '');
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(value);

  const fetchOrderDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`/api/payments/orders/${encodeURIComponent(id)}/`);
      if (res.status === 404) {
        throw new Error("Order not found. Please check the ID.");
      }
      if (!res.ok) {
        throw new Error("Failed to fetch order details.");
      }
      const data = await res.json();
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      toast({
        title: "Order Tracking Failed",
        description: err instanceof Error ? err.message : "Could not retrieve order details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderIdInput.trim()) {
      fetchOrderDetails(orderIdInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-lg w-full max-w-md text-center relative">
        <Link to="/" className="absolute top-6 left-6 text-slate-400 hover:text-[#d69e2e] transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          Home
        </Link>
        <TastyBitesIcon size={60} className="mx-auto mb-6" />
        <h2 className="font-display text-3xl text-[#d69e2e] mb-6">Track Your Order</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-2 mb-8">
          <input
            type="text"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="Enter Order ID"
            className="flex-1 rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-[#d69e2e]"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-[#d69e2e] text-[#1a365d] px-6 py-2 rounded-full font-semibold hover:bg-[#d69e2e]/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Tracking...' : 'Track'}
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {order && (
          <div className="text-left space-y-3">
            <p className="text-lg font-bold">Order ID: <span className="text-[#d69e2e]">{order.order_id.substring(0, 8)}</span></p>
            <p>Status: <span className={`font-semibold ${order.status === 'ready' || order.status === 'served' ? 'text-emerald-400' : 'text-amber-400'}`}>{order.status.toUpperCase()}</span></p>
            <p>Table: {order.table}</p>
            <p>Total: {formatCurrency(order.total_amount)}</p>
            <p className="text-sm text-slate-400">Placed: {new Date(order.created_at).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;