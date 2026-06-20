import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStaffName } from '../../lib/staff-session';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

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

  const token = localStorage.getItem('staff_token');

  useEffect(() => {
    if (!staffName || !token) {
      navigate('/staff-login');
      return;
    }
    fetchPendingBills();
    const interval = setInterval(fetchPendingBills, 3000);
    return () => clearInterval(interval);
  }, [staffName, token, navigate]);

  const fetchPendingBills = async () => {
    try {
      const response = await fetch('/api/payments/cashier/pending-bills/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-STAFF-TOKEN': token || '',
        },
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

  const handleConfirmPayment = async (bill: PendingBill) => {
    setSelectedBill(bill);
    setConfirming(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/payments/cashier/confirm-payment/${bill.order_id}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-STAFF-TOKEN': token || '',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm payment');
      }

      const data = await response.json();
      const order = data.order;

      // Generate receipt
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
      setConfirming(false);
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
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardContent className="pt-6">
            <p className="text-center text-red-600">Staff session expired. Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Cashier Workstation</h1>
              <p className="text-gray-600 mt-2">Welcome, {staffName}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/staff')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600">{bills.length}</p>
                <p className="text-gray-600 text-sm">Pending Bills</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600">
                  KES {bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0).toFixed(2)}
                </p>
                <p className="text-gray-600 text-sm">Total Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-purple-600">{bills.length}</p>
                <p className="text-gray-600 text-sm">Orders Ready</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bills List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Pending Bills</h2>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="animate-spin text-blue-600" size={40} />
            </div>
          ) : bills.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No pending bills at this time</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bills.map((bill) => (
                <Card key={bill.order_id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Order #{bill.order_id}</CardTitle>
                        <p className="text-sm text-gray-600">Waiter: {bill.waiter_name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        bill.order_type === 'table'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {bill.order_type === 'table' ? `Table ${bill.table}` : 'Takeaway'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Items */}
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Items:</p>
                      <ul className="space-y-1 text-sm">
                        {bill.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between text-gray-600">
                            <span>{item.item_name} x{item.quantity}</span>
                            <span>KES {(item.subtotal || item.unit_price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Total */}
                    <div className="border-t pt-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total:</span>
                        <span className="text-2xl font-bold text-green-600">
                          KES {bill.total_amount.toFixed(2)}
                        </span>
                      </div>
                      {bill.phone && (
                        <p className="text-xs text-gray-500 mt-2">Phone: {bill.phone}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <Button
                      onClick={() => handleConfirmPayment(bill)}
                      disabled={confirming && selectedBill?.order_id === bill.order_id}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {confirming && selectedBill?.order_id === bill.order_id ? (
                        <Loader className="animate-spin mr-2" size={16} />
                      ) : null}
                      Confirm Payment
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Receipt Modal */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={24} />
                Payment Confirmed
              </DialogTitle>
            </DialogHeader>
            {receipt && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 font-mono text-sm">
                  <p><strong>Order ID:</strong> {receipt.order_id}</p>
                  <p><strong>Waiter:</strong> {receipt.waiter_name}</p>
                  <p><strong>Type:</strong> {receipt.order_type}</p>
                  {receipt.table && <p><strong>Table:</strong> {receipt.table}</p>}
                  {receipt.phone && <p><strong>Phone:</strong> {receipt.phone}</p>}
                  <hr className="my-2" />
                  <p><strong>Total:</strong> KES {receipt.total_amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{receipt.timestamp}</p>
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
              >
                Close
              </Button>
              <Button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Print Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
