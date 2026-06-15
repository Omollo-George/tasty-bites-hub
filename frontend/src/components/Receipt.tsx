import React from 'react';
import { Printer, X } from 'lucide-react';
import TastyBitesIcon from './TastyBitesIcon';

interface ReceiptProps {
  order: {
    order_id: string;
    items: any[];
    table_number: string;
    delivery_address?: string;
    total_amount: number;
    payment_method: string;
    order_type: string;
    phone?: string;
    delivery_distance_km?: number;
    waiter_name?: string;
  };
  onClose: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ order, onClose }) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(value);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:p-0 print:bg-white">
      <div className="relative w-full max-w-sm bg-white text-slate-900 rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none">
        {/* Actions - Hidden on Print */}
        <div className="absolute top-4 right-4 flex gap-2 print:hidden">
          <button onClick={handlePrint} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
            <Printer size={20} />
          </button>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-8 font-mono text-sm">
          <div className="flex flex-col items-center text-center mb-6">
            <TastyBitesIcon size={40} className="mb-2" />
            <h2 className="font-display text-xl font-bold text-[#1a365d]">TASTY BITES HUB</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Premium Hospitality Management</p>
            <div className="w-full border-b border-dashed border-slate-300 my-4" />
            <p className="font-bold">ORDER: {order.order_id}</p>
            <p className="text-xs">{new Date().toLocaleString()}</p>
          </div>

          {/* Waiter Information - Prominently Displayed */}
          {order.waiter_name && (
            <div className="mb-4 p-3 bg-slate-100 rounded-lg border-2 border-slate-300 text-center">
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Service Staff</p>
              <p className="text-lg font-bold text-slate-900">{order.waiter_name}</p>
              <p className="text-[10px] text-slate-600 font-mono">ID: {order.order_id.substring(0, 8).toUpperCase()}</p>
            </div>
          )}

          <div className="space-y-1 mb-4 text-xs">
            <div className="flex justify-between">
              <span>TYPE:</span>
              <span className="font-bold uppercase">{order.order_type}</span>
            </div>
            {order.table_number && (
              <div className="flex justify-between">
                <span>TABLE:</span>
                <span className="font-bold">{order.table_number}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex justify-between">
                <span>ADDRESS:</span>
                <span className="font-bold">{order.delivery_address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>PAYMENT:</span>
              <span className="font-bold uppercase">{order.payment_method}</span>
            </div>
          </div>

          <div className="w-full border-b border-dashed border-slate-300 mb-4" />

          <div className="space-y-3 mb-6">
            {order.items.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-start">
                  <span className="flex-1">{item.quantity} x {item.name}</span>
                  <span className="ml-4">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                {item.modifiers?.length > 0 && (
                  <div className="text-[10px] text-slate-500 ml-4 italic">
                    + {item.modifiers.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="w-full border-b border-dashed border-slate-300 mb-4" />

          <div className="space-y-1">
            <div className="flex justify-between text-lg font-bold text-[#1a365d]">
              <span>TOTAL</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>
          </div>

          {/* Dynamic QR Code for Ordering */}
          <div className="mt-8 flex flex-col items-center gap-2 print:mt-4">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Scan to Order More</p>
            <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?source=qr#menu')}`} 
                alt="Scan to order" 
                className="w-24 h-24"
              />
            </div>
          </div>

          <div className="mt-8 text-center text-[10px] text-slate-400">
            <p>Thank you for visiting Tasty Bites Hub</p>
            <p>Please come again!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;