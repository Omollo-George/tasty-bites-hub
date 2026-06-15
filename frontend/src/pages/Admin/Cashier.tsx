import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStaffName } from '@/lib/staff-session';
import { getApiUrl } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Loader, X } from 'lucide-react';

interface OrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  is_served?: boolean;
}

interface PendingBill {
  order_id: string;
  table?: number;
  phone?: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  waiter_name: string;
  order_type: string;
  created_at: string;
}

interface Receipt {
  order_id: string;
  waiter_name: string;
  order_type: string;
  table?: number;
  phone?: string;
  items: OrderItem[];
  total_amount: number;
  timestamp: string;
}

export default function Cashier() {
  const navigate = useNavigate();
  const staffName = getStaffName();

  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<PendingBill | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  useEffect(() => {
    if (!staffName) {
      navigate('/staff-login');
      return;
    }
    fetchPendingBills();
    const interval = setInterval(fetchPendingBills, 3000);
    return () => clearInterval(interval);
  }, [staffName, navigate]);

  const fetchPendingBills = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/cashier/pending-bills/'), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending bills');
      }

      const data = await response.json();
      setBills(data.bills || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
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
    setShowPaymentMethod(false);

    // If MPESA, ensure a phone number is provided
    if (method === 'mpesa') {
      if (!mpesaNumber) {
        setMpesaError('Enter MPESA phone number');
        setProcessingPayment(false);
        return;
      }
    }

    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const response = await fetch(
        getApiUrl(`/payments/cashier/confirm-payment/${selectedBill.order_id}/`),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ payment_method: method, mpesa_number: method === 'mpesa' ? mpesaNumber : undefined }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to confirm payment');
      }

      const data = await response.json();
      const order = data.order;

      // If MPESA flow started, backend returns checkout_request_id; poll status
      if (method === 'mpesa') {
        const checkoutId = data.checkout_request_id || (data.mpesa && data.mpesa.CheckoutRequestID) || null;
        setMpesaCheckoutId(checkoutId);
        setMpesaPolling(true);
        setShowMpesaPrompt(false);

        // Poll payment status
        let attempts = 0;
        const maxAttempts = 30;
        mpesaIntervalRef.current = window.setInterval(async () => {
          attempts += 1;
          try {
            const st = await fetch(getApiUrl(`/payments/status/?checkout_id=${checkoutId}`), { headers: getAuthHeaders() });
            if (st.ok) {
              const stData = await st.json();
              if (stData.status === 'success') {
                if (mpesaIntervalRef.current) { clearInterval(mpesaIntervalRef.current); mpesaIntervalRef.current = null; }
                setMpesaPolling(false);
                setMpesaCheckoutId(null);

                // fetch updated order details
                try {
                  const ordResp = await fetch(getApiUrl(`/orders/${order.order_id}/`), { headers: getAuthHeaders() });
                  if (ordResp.ok) {
                    const ordJson = await ordResp.json();
                    const ord = ordJson.order || ordJson;
                    setReceipt({
                      order_id: ord.order_id,
                      waiter_name: ord.waiter_name,
                      order_type: ord.order_type,
                      table: ord.table,
                      phone: ord.phone,
                      items: ord.items,
                      total_amount: ord.total_amount,
                      timestamp: new Date().toLocaleString(),
                    });
                    setShowReceipt(true);

                    // Mark table free if needed
                    if (ord.order_type === 'table' && ord.table) {
                      try {
                        await fetch(getApiUrl(`/payments/pos/tables/${ord.table}/mark-free/`), { method: 'POST', headers: getAuthHeaders() });
                      } catch (err) {
                        console.error('Error marking table as free:', err);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to fetch order after MPESA success:', err);
                }

                // Refresh bills and clear selection
                fetchPendingBills();
                setSelectedBill(null);
                setProcessingPayment(false);
                return;
              }
              if (stData.status === 'failed' || attempts >= maxAttempts) {
                if (mpesaIntervalRef.current) { clearInterval(mpesaIntervalRef.current); mpesaIntervalRef.current = null; }
                setMpesaPolling(false);
                setMpesaCheckoutId(null);
                setError('M-Pesa payment failed or timed out');
                setProcessingPayment(false);
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
            setError('M-Pesa payment timed out');
            setProcessingPayment(false);
          }
        }, 3000);

        return;
      }

      // For cash (or fallback), treat as completed immediately
      if (order.order_type === 'table' && order.table) {
        try {
          await fetch(getApiUrl(`/payments/pos/tables/${order.table}/mark-free/`), {
            method: 'POST',
            headers: getAuthHeaders(),
          });
        } catch (err) {
          console.error('Error marking table as free:', err);
        }
      }

      // Generate receipt for cash
      setReceipt({
        order_id: order.order_id,
        waiter_name: order.waiter_name,
        order_type: order.order_type,
        table: order.table,
        phone: order.phone,
        items: order.items,
        total_amount: order.total_amount,
        timestamp: new Date().toLocaleString(),
      });

      setShowReceipt(true);

      // Refresh bills list
      setTimeout(() => {
        fetchPendingBills();
        setSelectedBill(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      console.error('Payment confirmation error:', err);
    } finally {
      setProcessingPayment(false);
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
                <p><strong>Type:</strong> ${receipt.order_type}</p>
                ${receipt.table ? `<p><strong>Table:</strong> ${receipt.table}</p>` : ''}
                ${receipt.phone ? `<p><strong>Phone:</strong> ${receipt.phone}</p>` : ''}
                <p><strong>Time:</strong> ${receipt.timestamp}</p>
              </div>
              <div class="items">
                ${receipt.items
                  .map(
                    (item) =>
                      `
                  <div class="item">
                    <span>${item.item_name} x${item.quantity}</span>
                    <span>KES ${(item.subtotal || item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                `
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cashier Dashboard</p>
            <h1 className="text-4xl font-display font-bold text-white mt-2">Cashier Workstation</h1>
            <p className="mt-2 text-slate-400 max-w-2xl">
              Manage open tickets, confirm payments, and print receipts from a unified cashier interface.
            </p>
          </div>
          <Button
            onClick={() => navigate('/staff')}
            className="bg-orange-500 text-slate-950 hover:bg-orange-400 shadow-lg shadow-orange-500/20"
          >
            Back to Dashboard
          </Button>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/40">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Open Tickets</p>
            <p className="text-4xl font-bold text-sky-400 mt-4">{bills.length}</p>
            <p className="mt-2 text-slate-400">Tickets currently waiting for cashier confirmation.</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/40">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Total Open</p>
            <p className="text-4xl font-bold text-emerald-400 mt-4">KES {bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0).toFixed(2)}</p>
            <p className="mt-2 text-slate-400">Amount pending settlement across all open bills.</p>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Open Tickets</h2>
              <p className="text-slate-400 mt-1">Review pending bills and complete payments quickly.</p>
            </div>
            <div className="text-sm text-slate-500">
              Updated every few seconds for real-time cashier processing.
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader className="animate-spin text-slate-400" size={44} />
            </div>
          ) : bills.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
              No pending bills at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {bills.map((bill) => (
                <div key={bill.order_id} className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-slate-950/20 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Order #{bill.order_id}</p>
                      <p className="text-xl font-semibold text-white mt-2">Waiter: {bill.waiter_name}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      bill.order_type === 'table' ? 'bg-sky-500/10 text-sky-300' : 'bg-orange-500/10 text-orange-300'
                    }`}>
                      {bill.order_type === 'table' ? `Table ${bill.table}` : 'Takeaway'}
                    </span>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between text-slate-400 text-sm mb-3">
                        <span>Items</span>
                        <span>{bill.items.length} total</span>
                      </div>
                      <div className="space-y-2">
                        {bill.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-slate-200 text-sm">
                            <span>{item.item_name} x{item.quantity}</span>
                            <span>KES {(item.subtotal || item.unit_price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Total amount</p>
                        <p className="text-3xl font-semibold text-emerald-300">KES {bill.total_amount.toFixed(2)}</p>
                        {bill.phone && <p className="text-xs text-slate-500 mt-1">Phone: {bill.phone}</p>}
                      </div>
                      <Button
                        onClick={() => handleConfirmPayment(bill)}
                        disabled={processingPayment && selectedBill?.order_id === bill.order_id}
                        className="w-full sm:w-auto bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      >
                        {processingPayment && selectedBill?.order_id === bill.order_id ? (
                          <Loader className="animate-spin mr-2" size={16} />
                        ) : null}
                        Confirm Payment
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Dialog open={showPaymentMethod} onOpenChange={setShowPaymentMethod}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <DialogHeader>
              <DialogTitle>
                {selectedBill ? `Order #${selectedBill.order_id}` : 'Select Payment Method'}
              </DialogTitle>
            </DialogHeader>
            {selectedBill && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-lg text-white">Waiter: {selectedBill.waiter_name}</p>
                  <p className="text-slate-400">Amount: <span className="font-bold text-2xl text-emerald-300">KES {selectedBill.total_amount.toFixed(2)}</span></p>
                  <p className="text-slate-500">{selectedBill.items.length} items</p>
                </div>
                <p className="text-sm font-semibold text-slate-300">Choose Payment Method:</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      setShowPaymentMethod(false);
                      setShowMpesaPrompt(true);
                      setPaymentMethod('mpesa');
                    }}
                    disabled={processingPayment}
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  >
                    {processingPayment && paymentMethod === 'mpesa' ? (
                      <Loader className="animate-spin mr-2" size={16} />
                    ) : null}
                    M-Pesa
                  </Button>
                  <Button
                    onClick={() => handleProcessPayment('cash')}
                    disabled={processingPayment}
                    className="bg-sky-500 text-slate-950 hover:bg-sky-400"
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

        <Dialog open={showMpesaPrompt} onOpenChange={setShowMpesaPrompt}>
          <DialogContent className="max-w-md bg-slate-950 text-slate-100 border border-slate-800">
            <DialogHeader>
              <DialogTitle>Enter M-Pesa Number</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Enter customer's M-Pesa phone number to prompt payment (e.g., 2547XXXXXXXX).</p>
              <div className="flex flex-col">
                <input
                  value={mpesaNumber}
                  onChange={(e) => { setMpesaNumber(e.target.value.replace(/\s+/g, '')); setMpesaError(null); }}
                  placeholder="2547XXXXXXXX"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-100"
                />
                {mpesaError && <p className="text-xs text-red-400 mt-2">{mpesaError}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => { setShowMpesaPrompt(false); setMpesaNumber(''); setMpesaError(null); }} className="bg-red-600 text-white hover:bg-red-500 px-4 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                  <X size={16} />
                  Cancel
                </Button>
                <Button onClick={() => handleProcessPayment('mpesa')} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 px-4 py-3 rounded-xl font-bold">Send Payment Request</Button>
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
                  <p><strong>Waiter:</strong> {receipt.waiter_name}</p>
                  <p><strong>Type:</strong> {receipt.order_type}</p>
                  {receipt.table && <p><strong>Table:</strong> {receipt.table}</p>}
                  {receipt.phone && <p><strong>Phone:</strong> {receipt.phone}</p>}
                  <hr className="my-2 border-slate-800" />
                  <p><strong>Total:</strong> KES {receipt.total_amount.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{receipt.timestamp}</p>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReceipt(false);
                  setReceipt(null);
                }}
                className="border-slate-700 text-slate-100 hover:border-slate-500"
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
