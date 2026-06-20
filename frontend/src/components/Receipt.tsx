import React from 'react';
import { Printer, X } from 'lucide-react';
import TastyBitesIcon from './TastyBitesIcon';

interface ReceiptProps {
  order: {
    order_id: string;
    items: any[];
    table_number?: string;
    delivery_address?: string;
    subtotal?: number;
    total_amount: number;
    payment_method: string;
    order_type: string;
    phone?: string;
    delivery_distance_km?: number;
    waiter_name?: string;
    waiter_id?: string | number;
    cashier_notified?: boolean;
    discount?: number;
    tax?: number;
  };
  onClose: () => void;
  showWaiterInfo?: boolean; // For cashier internal records only
}

const Receipt: React.FC<ReceiptProps> = ({ order, onClose, showWaiterInfo = false }) => {
  const currency = "KES";
  const formatCurrency = (value: number = 0) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(value);

  const handlePrint = () => {
    window.print();
  };

  const subtotal = order.subtotal ?? order.items?.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const discount = Number(order.discount || 0);
  const tax = Number(order.tax || 0);
  const total = Number(order.total_amount || subtotal - discount + tax);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <style>{`
        /* Thermal printer friendly print styles */
        @media print {
          @page { size: 72mm auto; margin: 4mm; }
          html, body { background: #fff !important; color: #000 !important; }
          /* Root overlay hidden, only show the receipt container */
          body * { visibility: hidden; }
          .receipt-root, .receipt-root * { visibility: visible; }
          .receipt-root { width: 72mm; max-width: 72mm; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; margin: 0 !important; }
          .receipt-root img { display: none; }
          .no-print { display: none !important; }
          .receipt-root { font-family: monospace; font-size: 12px; color: #000; }
          .receipt-root .font-display { font-family: monospace; }
          .receipt-root .text-slate-500, .receipt-root .text-slate-600, .receipt-root .text-slate-700 { color: #000 !important; }
        }
        /* On-screen keep existing look */
      `}</style>

      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-xl overflow-hidden shadow-2xl receipt-root">
        <div className="absolute top-4 right-4 flex gap-2 no-print">
          <button onClick={handlePrint} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
            <Printer size={18} />
          </button>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 font-sans text-sm leading-relaxed">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <TastyBitesIcon size={40} />
              <div>
                <div className="font-display text-lg font-bold">TASTY BITES HUB</div>
                <div className="text-xs text-slate-500">123 Flavor Street • Nairobi • +254 700 000 000</div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Order: <span className="font-bold text-slate-700">{order.order_id}</span></div>
              <div>{new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4">
            <div>
              <div className="font-semibold text-slate-800">Type</div>
              <div className="mt-1">{order.order_type}</div>
              {order.table_number && <div className="mt-1">Table {order.table_number}</div>}
              {order.phone && <div className="mt-1">Phone: {order.phone}</div>}
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-800">Payment</div>
              <div className="mt-1">{order.payment_method}</div>
              {order.delivery_address && <div className="mt-1">{order.delivery_address}</div>}
            </div>
          </div>

          <div className="w-full border-t border-b border-slate-200 py-2">
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-7 font-medium">Item</div>
              <div className="col-span-3 text-right font-medium">Qty</div>
              <div className="col-span-2 text-right font-medium">Total</div>
            </div>
          </div>

          <div className="py-3 space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start text-sm">
                <div className="col-span-7">
                  <div className="font-semibold text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-500">{(item.sku || item.menu_item_id) ? `SKU: ${item.sku || item.menu_item_id}` : null}</div>
                  {item.modifiers?.length > 0 && <div className="text-xs text-slate-500 mt-1">+ {item.modifiers.join(', ')}</div>}
                </div>
                <div className="col-span-3 text-right text-sm">{item.quantity}</div>
                <div className="col-span-2 text-right text-sm">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <div>Subtotal</div>
              <div className="font-medium">{formatCurrency(subtotal)}</div>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <div>Discount</div>
                <div className="font-medium">-{formatCurrency(discount)}</div>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <div>Tax</div>
                <div className="font-medium">{formatCurrency(tax)}</div>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold text-slate-900 mt-2">
              <div>Total</div>
              <div>{formatCurrency(total)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-600">
            <div>
              <div className="font-semibold text-slate-800">Served By</div>
              <div className="mt-1 text-sm">{order.waiter_name || 'Unassigned'}</div>
              {order.waiter_id && <div className="text-xs text-slate-500">ID: {order.waiter_id}</div>}
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-800">Processed</div>
              <div className="mt-1 text-sm">{order.cashier_notified ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            <div>Thank you for choosing Tasty Bites Hub</div>
            <div className="mt-1">www.tastybites.example • VAT NO: 12345678</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;