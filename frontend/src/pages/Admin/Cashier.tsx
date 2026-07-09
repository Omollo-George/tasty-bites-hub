import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStaffName, clearStaffSession, getStaffToken } from '@/lib/staff-session';
import { getApiUrl, getSseUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { normalizePhoneNumber, isValidMpesaPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, ArrowLeft, CheckCircle, Loader, X } from 'lucide-react';

interface OrderItem {
  id?: string | number;
  item_id?: string;
  name?: string;
  item_name?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  subtotal: number;
  is_served?: boolean;
}

interface PendingBill {
  order_id: string;
  table?: number;
  phone?: string;
  items: OrderItem[];
  total_amount: number;
  amount_paid?: number;
  outstanding_amount?: number;
  status: string;
  waiter_name: string;
  waiter_id?: string | number;
  order_type: string;
  created_at: string;
}

interface Receipt {
  order_id: string;
  waiter_name: string;
  waiter_id?: string | number;
  order_type: string;
  table?: number;
  table_id?: string | number;
  phone?: string;
  items: OrderItem[];
  total_amount: number;
  timestamp: string;
}

export default function Cashier() {
  const navigate = useNavigate();
  const staffName = getStaffName();

  const formatClockTime = (value?: string | Date | number) => {
    if (!value) return 'No timestamp';

    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return 'No timestamp';

      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'No timestamp';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  };

  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<PendingBill | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'takeaway' | 'dinein'>('all');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash' | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showMpesaPrompt, setShowMpesaPrompt] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [mpesaError, setMpesaError] = useState<string | null>(null);
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
  const [mpesaPolling, setMpesaPolling] = useState(false);
  const mpesaIntervalRef = useRef<number | null>(null);

  const getMpesaCheckoutId = (payload: any): string | null => {
    return payload?.checkout_request_id || payload?.mpesa?.CheckoutRequestID || null;
  };

  const getOrderCategory = (orderType?: string) => {
    const normalized = (orderType || '').toLowerCase();
    if (normalized === 'takeaway' || normalized === 'delivery') return 'takeaway';
    return 'dinein';
  };

  const filteredBills = bills.filter((bill) => {
    if (ticketFilter === 'all') return true;
    return getOrderCategory(bill.order_type) === ticketFilter;
  });

  useEffect(() => {
    const staffToken = getStaffToken();
    if (!staffName || !staffToken) {
      clearStaffSession();
      navigate('/staff/login');
      return;
    }

    fetchPendingBills();
    const interval = setInterval(fetchPendingBills, 3000);

    const eventSource = new EventSource(getSseUrl('/payments/stream/'));
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type && ['order_update', 'new_order'].includes(payload.type)) {
          fetchPendingBills();
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
  }, [staffName, navigate]);

  const fetchPendingBills = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/cashier/pending-bills/'), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (response.status === 401 || response.status === 403) {
        clearStaffSession();
        navigate('/staff/login');
        return;
      }

      if (!response.ok) {
        let errorMessage = `Failed to fetch pending bills (${response.status})`
        try {
          const errorData = await response.json()
          if (errorData?.error) errorMessage = errorData.error
        } catch {
          const errorText = await response.text().catch(() => '')
          if (errorText) errorMessage = errorText
        }
        throw new Error(errorMessage)
      }

      const data = await response.json();
      const pendingBills = Array.isArray(data.bills) ? data.bills : [];
      const sortedBills = [...pendingBills].sort((a: PendingBill, b: PendingBill) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return aTime - bTime;
      });
      setBills(sortedBills);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pending bills')
      console.error('Fetch pending bills error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = (bill: PendingBill) => {
    setSelectedBill(bill);
    setPaymentMethod(null);
    setShowPaymentMethod(true);
  };

  const handleProcessPayment = async (method: 'mpesa' | 'cash') => {
    if (!selectedBill) return;
    setPaymentMethod(method);
    setProcessingPayment(true);
    setError(null);
    setMpesaError(null);
    setShowPaymentMethod(false);

    // If MPESA, ensure a phone number is provided and compute normalized value for the payload
    let mpesaNumberForPayload: string | undefined = undefined;
    if (method === 'mpesa') {
      if (!mpesaNumber) {
        setMpesaError('Enter MPESA phone number');
        setProcessingPayment(false);
        return;
      }
      const normalized = normalizePhoneNumber(mpesaNumber);
      if (!isValidMpesaPhone(mpesaNumber) || !normalized) {
        setMpesaError('Enter a valid Kenyan M-Pesa number like +254712345678, 0712345678, or 712345678');
        setProcessingPayment(false);
        return;
      }
      // store normalized locally and in state for UI
      mpesaNumberForPayload = normalized;
      setMpesaNumber(normalized);
    }

    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const response = await fetch(
        getApiUrl(`/payments/cashier/confirm-payment/${selectedBill.order_id}/`),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ payment_method: method, mpesa_number: method === 'mpesa' ? mpesaNumberForPayload || mpesaNumber : undefined }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.detail || 'Failed to confirm payment';
        if (method === 'mpesa') {
          setMpesaError(errorMsg);
          setProcessingPayment(false);
          return;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const order = data.order;

      // If MPESA flow started, backend returns checkout_request_id; poll status
      if (method === 'mpesa') {
        const checkoutId = getMpesaCheckoutId(data);
        if (!checkoutId) {
          setMpesaError('Failed to initiate M-Pesa payment. Please try again.');
          setProcessingPayment(false);
          return;
        }
        setMpesaCheckoutId(checkoutId);
        setMpesaPolling(true);
        setShowMpesaPrompt(false);

        // Poll payment status
        let attempts = 0;
        const maxAttempts = 30;
        mpesaIntervalRef.current = window.setInterval(async () => {
          attempts += 1;
          try {
            const st = await fetch(getApiUrl(`/payments/status/?checkout_id=${encodeURIComponent(checkoutId)}`), { headers: getAuthHeaders() });
            if (st.ok) {
              const stData = await st.json();
              if (stData.status === 'success') {
                if (mpesaIntervalRef.current) { clearInterval(mpesaIntervalRef.current); mpesaIntervalRef.current = null; }
                setMpesaPolling(false);
                setMpesaCheckoutId(null);

                // fetch updated order details
                try {
                  const ordResp = await fetch(getApiUrl(`/payments/orders/${order.order_id}/`), { headers: getAuthHeaders() });
                  if (ordResp.ok) {
                    const ordJson = await ordResp.json();
                    const ord = ordJson.order || ordJson;
                    const receiptData: Receipt = {
                      order_id: ord.order_id,
                      waiter_name: ord.waiter_name,
                      waiter_id: ord.waiter_id,
                      order_type: ord.order_type,
                      table: ord.table,
                      table_id: ord.table_id,
                      phone: ord.phone,
                      items: ord.items,
                      total_amount: ord.total_amount,
                      timestamp: formatClockTime(new Date()),
                    };
                    setReceipt(receiptData);
                    setShowReceipt(true);

                    // Mark table free if needed
                    if (ord.order_type === 'table' && ord.table_id) {
                      try {
                        await fetch(getApiUrl(`/payments/pos/tables/${ord.table_id}/mark-free/`), { method: 'POST', headers: getAuthHeaders() });
                      } catch (err) {
                        console.error('Error marking table as free:', err);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to fetch order after MPESA success:', err);
                }

                setSelectedBill(null);
                await fetchPendingBills();
                setProcessingPayment(false);
                return;
              }
              if (stData.status === 'failed' || attempts >= maxAttempts) {
                if (mpesaIntervalRef.current) { clearInterval(mpesaIntervalRef.current); mpesaIntervalRef.current = null; }
                setMpesaPolling(false);
                setMpesaCheckoutId(null);
                setError('M-Pesa payment failed or timed out. Bill remains outstanding.');
                setSelectedBill(null);
                setProcessingPayment(false);
                // Refresh bills to ensure consistency - bill remains in outstanding total
                setTimeout(() => fetchPendingBills(), 500);
                return;
              }
            }
          } catch (err) {
            console.error('MPESA status poll error:', err);
          }
          if (attempts >= maxAttempts) {
            if (mpesaIntervalRef.current) { clearInterval(mpesaIntervalRef.current); mpesaIntervalRef.current = null; }
            setMpesaPolling(false);
            setMpesaCheckoutId(null);
            setError('M-Pesa payment timed out. Bill remains outstanding.');
            setSelectedBill(null);
            setProcessingPayment(false);
            // Refresh bills to ensure consistency - bill remains in outstanding total
            setTimeout(() => fetchPendingBills(), 500);
          }
        }, 3000);

        return;
      }

      // For cash (or fallback), treat as completed immediately
      if (order.order_type === 'table' && order.table_id) {
        try {
          await fetch(getApiUrl(`/payments/pos/tables/${order.table_id}/mark-free/`), {
            method: 'POST',
            headers: getAuthHeaders(),
          });
        } catch (err) {
          console.error('Error marking table as free:', err);
        }
      }

      // Generate receipt for cash
      const cashReceipt: Receipt = {
        order_id: order.order_id,
        waiter_name: order.waiter_name,
        waiter_id: order.waiter_id,
        order_type: order.order_type,
        table: order.table,
        table_id: order.table_id,
        phone: order.phone,
        items: order.items,
        total_amount: order.total_amount,
        timestamp: formatClockTime(new Date()),
      };
      setReceipt(cashReceipt);

      setShowReceipt(true);
      setSelectedBill(null);
      await fetchPendingBills();
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred while processing payment';
      if (method === 'mpesa') {
        setMpesaError(errorMsg);
      } else {
        setError(errorMsg);
      }
      console.error('Payment confirmation error:', err);
    } finally {
      if (!(method === 'mpesa' && mpesaPolling)) {
        setProcessingPayment(false);
      }
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow && receipt) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Order Receipt - ${receipt.order_id}</title>
            <style>
              body { font-family: monospace; padding: 20px; }
              .receipt { width: 400px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
              .order-info { margin: 10px 0; font-size: 12px; }
              .items { margin: 20px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; }
              .item { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
              .total { display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; font-size: 14px; }
              .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <h2>TASTY BITES HUB</h2>
                <p>Receipt</p>
              </div>
              <div class="order-info">
                <p><strong>Order ID:</strong> ${receipt.order_id}</p>
                <p><strong>Waiter:</strong> ${receipt.waiter_name}</p>
                ${receipt.waiter_id ? `<p><strong>Waiter ID:</strong> ${receipt.waiter_id}</p>` : ''}
                <p><strong>Type:</strong> ${receipt.order_type}</p>
                ${receipt.phone ? `<p><strong>Phone:</strong> ${receipt.phone}</p>` : ''}
                <p><strong>Time:</strong> ${receipt.timestamp}</p>
              </div>
              <div class="items">
                ${(receipt.items ?? [])
                  .map(
                    (item) => {
                      const itemName = item?.item_name || item?.name || 'Item';
                      return `
                  <div class="item">
                    <span>${itemName} x${item?.quantity ?? 1}</span>
                    <span>KES ${((item?.subtotal ?? ((item?.unit_price ?? item?.price ?? 0) * (item?.quantity ?? 1))) || 0).toFixed(2)}</span>
                  </div>
                `;
                    }
                  )
                  .join('')}
              </div>
              <div class="total">
                <span>TOTAL:</span>
                <span>KES ${receipt.total_amount.toFixed(2)}</span>
              </div>
              <div class="footer">
                <p>Thank you for your order!</p>
                <p>${new Date().toLocaleString()}</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (!staffName) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <Card className="w-full max-w-lg bg-slate-900 border-slate-700">
          <CardContent className="pt-6">
            <p className="text-center text-red-400">Staff session expired. Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-100 font-body p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[2rem] border border-slate-800/70 bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Cashier Dashboard</p>
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-white">Cashier Workstation</h1>
              <p className="max-w-2xl text-base leading-7 text-slate-400">
                Manage open tickets, confirm payments, and print receipts with precision from a polished, professional cashier workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/staff')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-900 transition"
                aria-label="Back to Cashier Dashboard"
              >
                <ArrowLeft size={18} />
              </button>
              <Button
                onClick={() => {
                  clearStaffSession();
                  navigate('/staff/login');
                }}
                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-300"
              >
                Log out
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-600/20 bg-red-600/10 p-5 text-sm text-red-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 text-red-300" size={20} />
              <div>
                <p className="font-semibold text-red-100">Error</p>
                <p className="text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-[2rem] border border-slate-800/70 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40 overflow-hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">Open Tickets</h2>
              <p className="text-slate-400 max-w-2xl">Review pending bills, confirm payments, and keep the cashier workflow efficient and organized.</p>
            </div>
            <div className="text-sm text-slate-500">Updated every few seconds for real-time cashier processing.</div>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            {(['all', 'takeaway', 'dinein'] as const).map((filter) => {
              const isActive = ticketFilter === filter;
              const label = filter === 'all' ? 'All' : filter === 'takeaway' ? 'Takeaway' : 'Dine-in';
              return (
                <button
                  key={filter}
                  onClick={() => setTicketFilter(filter)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 ${isActive ? 'border-orange-400 bg-orange-400 text-slate-950 shadow-sm shadow-orange-500/20' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:bg-slate-900 hover:text-white'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader className="animate-spin text-slate-400" size={44} />
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
              No pending bills at this time.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 auto-rows:minmax(0, auto) items-start">
              {filteredBills.map((bill) => {
                const safeItems = Array.isArray(bill.items) ? bill.items : [];
                const orderTypeLabel = bill.order_type === 'table' ? 'Dine-in' : (bill.order_type === 'delivery' ? 'Delivery' : 'Takeaway');
                const firstItem = safeItems[0];
                const moreItems = safeItems.length > 1 ? `+${safeItems.length - 1} more` : '';
                return (
                <div key={bill.order_id} className="relative min-w-0 w-full rounded-[1.2rem] border border-slate-700/50 bg-slate-950/95 p-0 shadow-2xl shadow-slate-950/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_25px_80px_-35px_rgba(0,0,0,0.75)] sm:rounded-[2rem] sm:p-0">
                  <div className="flex items-center justify-between gap-4 p-3 bg-gradient-to-r from-orange-500/6 via-transparent to-sky-500/6 rounded-t-[1.1rem]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 font-bold">{getInitials(bill.waiter_name)}</div>
                      <div className="min-w-0">
                        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500 truncate sm:text-[0.65rem]">Order #{bill.order_id.toString().slice(0, 4).toUpperCase()}</p>
                        <p className="mt-0.5 text-[0.68rem] text-slate-400">{bill.created_at ? formatClockTime(bill.created_at) : 'No timestamp'}</p>
                        <p className="mt-1 text-[0.9rem] font-semibold text-white truncate">{firstItem?.item_name || firstItem?.name || 'Order item'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[0.6rem] text-slate-400">Total</p>
                        <div className="mt-1 inline-block rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-slate-950 font-bold shadow-md">KES {bill.total_amount.toFixed(2)}</div>
                      </div>
                      <span className={`hidden md:inline-block shrink-0 rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${
                        bill.order_type === 'table' ? 'border-sky-500/20 bg-sky-500/10 text-sky-300' : 'border-orange-500/20 bg-orange-500/10 text-orange-300'
                      }`}>
                        {orderTypeLabel}
                      </span>
                    </div>
                  </div>
                  <div className="relative space-y-4 p-3">

                    <div className="rounded-[1rem] border border-slate-800/70 bg-slate-900/90 p-2 overflow-hidden sm:rounded-[1.75rem] sm:p-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-slate-500 sm:text-[0.65rem] sm:tracking-[0.25em]">Item</p>
                            <p className="mt-1 text-[0.75rem] font-semibold text-white truncate sm:mt-2 sm:text-lg">{firstItem?.item_name || firstItem?.name || 'Item'}</p>
                            <p className="mt-1 text-[0.7rem] text-slate-400 sm:text-sm">x{firstItem?.quantity || 1} {moreItems}</p>
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-slate-500 sm:text-[0.65rem] sm:tracking-[0.22em]">Total</p>
                            <p className="mt-1 text-[0.8rem] font-semibold text-amber-300 leading-tight truncate whitespace-nowrap sm:mt-2 sm:text-xl md:text-2xl">KES {bill.total_amount.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="rounded-[1rem] border border-slate-800 bg-slate-950/70 p-2 min-w-0 overflow-hidden sm:rounded-[1.5rem] sm:p-4">
                            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-slate-500 sm:text-[0.65rem] sm:tracking-[0.25em]">Server</p>
                            <p className="mt-1 text-[0.72rem] font-semibold text-white truncate sm:mt-2 sm:text-sm">{bill.waiter_name?.trim() ? bill.waiter_name : 'Unassigned'}</p>
                            {bill.waiter_id && (
                              <p className="mt-1 text-[0.65rem] text-slate-400 truncate sm:text-xs">ID: {bill.waiter_id}</p>
                            )}
                          </div>
                          <div className="min-w-0 flex justify-stretch sm:justify-end">
                            <Button
                              onClick={() => handleConfirmPayment(bill)}
                              disabled={processingPayment && selectedBill?.order_id === bill.order_id}
                              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-3 py-2.5 text-[9px] font-semibold leading-none tracking-[0.01em] text-slate-950 shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-orange-300 disabled:opacity-50 disabled:cursor-not-allowed sm:max-w-[160px] sm:px-3 sm:py-2.5 sm:text-[13px] sm:w-auto"
                            >
                              {processingPayment && selectedBill?.order_id === bill.order_id ? (
                                <Loader className="animate-spin mr-2" size={16} />
                              ) : null}
                              <span className="sm:hidden">Confirm</span>
                              <span className="hidden sm:inline">Confirm Payment</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <Dialog open={showPaymentMethod} onOpenChange={setShowPaymentMethod}>
          <DialogContent className="max-w-sm bg-slate-950 text-slate-100 border border-slate-800 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-white">
                {selectedBill ? `Order #${selectedBill.order_id}` : 'Payment'}
              </DialogTitle>
            </DialogHeader>
            {selectedBill && (
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Waiter</p>
                  <p className="mt-2 text-lg font-semibold text-white">{selectedBill.waiter_name && selectedBill.waiter_name.trim() ? selectedBill.waiter_name : (selectedBill.waiter_id ? `ID: ${selectedBill.waiter_id}` : '—')}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">Amount</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-300">KES {selectedBill.total_amount.toFixed(2)}</p>
                </div>
                <p className="text-sm text-slate-400">{selectedBill.items.length} item{selectedBill.items.length === 1 ? '' : 's'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      setShowPaymentMethod(false);
                      setShowMpesaPrompt(true);
                      setPaymentMethod('mpesa');
                    }}
                    disabled={processingPayment}
                    className="rounded-full bg-emerald-500 px-3 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {processingPayment && paymentMethod === 'mpesa' ? (
                      <Loader className="animate-spin mr-2" size={16} />
                    ) : null}
                    M-Pesa
                  </Button>
                  <Button
                    onClick={() => handleProcessPayment('cash')}
                    disabled={processingPayment}
                    className="rounded-full bg-sky-500 px-3 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    {processingPayment && paymentMethod === 'cash' ? (
                      <Loader className="animate-spin mr-2" size={16} />
                    ) : null}
                    Cash
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showMpesaPrompt} onOpenChange={(open) => { if (!processingPayment) setShowMpesaPrompt(open); }}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <DialogHeader>
              <DialogTitle>Enter M-Pesa Number</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Enter customer's M-Pesa phone number to prompt payment (e.g. +254712345678, 0712345678, 712345678).</p>
              <div className="flex flex-col">
                <input
                  value={mpesaNumber}
                  onChange={(e) => { setMpesaNumber(e.target.value.replace(/\s+/g, '')); setMpesaError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !processingPayment) handleProcessPayment('mpesa'); }}
                  placeholder="e.g. +254712345678"
                  disabled={processingPayment}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 disabled:opacity-50"
                />
                {mpesaError && <p className="text-xs text-red-400 mt-2">{mpesaError}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => { setShowMpesaPrompt(false); setMpesaNumber(''); setMpesaError(null); }} disabled={processingPayment} className="bg-red-600 text-white hover:bg-red-500 px-4 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
                  <X size={16} />
                  Cancel
                </Button>
                <Button onClick={() => handleProcessPayment('mpesa')} disabled={processingPayment} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 px-4 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2">
                  {processingPayment && paymentMethod === 'mpesa' ? (
                    <Loader className="animate-spin" size={16} />
                  ) : null}
                  Send Payment Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="text-emerald-400" size={24} />
                Payment Confirmed
              </DialogTitle>
            </DialogHeader>
            {receipt && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-2 font-mono text-sm text-slate-200">
                  <p><strong>Order ID:</strong> {receipt.order_id}</p>
                  <p><strong>Waiter:</strong> {receipt.waiter_name?.trim() ? receipt.waiter_name : 'Unassigned'}</p>
                  {receipt.waiter_id && <p><strong>Waiter ID:</strong> {receipt.waiter_id}</p>}
                  <p><strong>Type:</strong> {receipt.order_type}</p>
                  {receipt.phone && <p><strong>Phone:</strong> {receipt.phone}</p>}
                  <hr className="my-2 border-slate-800" />
                  <p><strong>Total:</strong> KES {receipt.total_amount.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{receipt.timestamp}</p>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                onClick={() => {
                  setShowReceipt(false);
                  setReceipt(null);
                }}
                className="bg-slate-700 text-white hover:bg-slate-600 px-4 py-3 rounded-xl font-bold shadow-lg transition-colors"
              >
                Close
              </Button>
              <Button
                onClick={handlePrint}
                className="bg-sky-500 text-slate-950 hover:bg-sky-400"
              >
                Print Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={mpesaPolling} onOpenChange={setMpesaPolling}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader className="animate-spin text-emerald-400" size={20} />
                Waiting for customer confirmation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-400">A payment request was sent to the customer's phone. They should be prompted to enter their M-Pesa PIN.</p>
              {mpesaCheckoutId && <p className="text-xs text-slate-500">Checkout ID: {mpesaCheckoutId}</p>}
              <div className="flex justify-end gap-2">
                <Button onClick={() => {
                  if (mpesaIntervalRef.current) { clearInterval(mpesaIntervalRef.current); mpesaIntervalRef.current = null; }
                  setMpesaPolling(false); setMpesaCheckoutId(null); setProcessingPayment(false); setError('M-Pesa polling cancelled');
                }} className="bg-red-600 text-white hover:bg-red-500 px-4 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                  <X size={16} />
                  Cancel Transaction
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
