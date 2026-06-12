import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { getApiUrl } from '@/lib/api';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';
import { getStaffRole, getStaffName } from '@/lib/staff-session';
import { getAuthToken, getAuthHeaders } from '@/lib/auth'; // Import the new getAuthToken and getAuthHeaders
import Receipt from '@/components/Receipt';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Printer, 
  Search, 
  ShoppingCart, 
  CheckCircle2, 
  Minus, 
  Plus, 
  Send, 
  Banknote, 
  Utensils, 
  LayoutGrid, 
  Smartphone, 
  Download,
  UserMinus
} from 'lucide-react';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image_url: string;
  description?: string;
  modifiers?: string[]; // Added modifiers to MenuItem for consistency, though CartItem will manage active modifiers
}

interface OrderItemReceipt {
  id: number;
  name: string;
  price: number;
  food_cost: number;
  quantity: number;
  modifiers: string[];
  seat_number: number;
  subtotal?: number; // Made optional as it might be calculated on backend
  is_served?: boolean;
}

// This interface should match the structure returned by _serialize_order in Django
interface PosOrderReceipt {
  order_id: string;
  table: string; // This will be 'Table X' or 'Takeaway'
  table_details: { id: number; number: string; name: string } | null;
  phone: string;
  delivery_address: string;
  delivery_distance_km: number | null;
  delivery_time: string;
  delivery_cost: number;
  status: string;
  split_count: number;
  total_amount: number;
  food_cost: number;
  is_paid: boolean;
  is_billed?: boolean;
  created_at: string;
  items: OrderItemReceipt[];
  payment_method: string; // Added from the frontend logic
  order_type: 'table' | 'takeaway'; // Added from the frontend logic
  stk_response?: any; // M-Pesa STK response if applicable
}

interface Table {
  id: number;
  number: string;
  status: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  modifiers: string[]; // Added modifiers
}

const EmployeeTable: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<PosOrderReceipt | null>(null);
  const [orderType, setOrderType] = useState<'table' | 'takeaway'>('table');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash');
  const [customerPhone, setCustomerPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<PosOrderReceipt | null>(null);
  const [awaitingMpesaConfirm, setAwaitingMpesaConfirm] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const { toast } = useToast();
  const pollTimerRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  const adminToken = getAdminToken();
  const isAdmin = adminToken && isAdminSessionValid();
  const staffRole = getStaffRole()?.toLowerCase();
  const staffName = getStaffName();
  const authToken = getAuthToken();
  const canAccess = isAdmin || ['waiter', 'cashier', 'manager'].includes(staffRole || '');

  const formatImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, tablesRes] = await Promise.all([
          fetch(getApiUrl('/payments/menu-items/'), { headers: getAuthHeaders() }),
          fetch(getApiUrl('/payments/pos/tables/'), { headers: getAuthHeaders() })
        ]);
        const menuData = await menuRes.json();
        const tablesData = await tablesRes.json();
        setMenuItems(menuData.menu_items || []);
        setTables(tablesData.tables || []);

        // Auto-select table if provided in URL
        const urlTable = searchParams.get('table');
        if (urlTable) {
          setSelectedTable(urlTable);
          setOrderType('table');

          // Fetch active order for this table to show existing items
          try { // Use authToken for auth
            const orderRes = await fetch(getApiUrl(`/payments/pos/active-order/?table_number=${urlTable}`), {
              headers: getAuthHeaders()
            });
            if (orderRes.ok) {
              const orderData = await orderRes.json();
              if (orderData.order) setActiveOrder(orderData.order);
            }
          } catch (err) {
            console.error("Failed to fetch active order", err);
          }
        }
      } catch (err) {
        console.error("Failed to load POS data", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, [authToken, searchParams]); // Removed adminToken from dependency array

  if (!canAccess && !initialLoading) {
    toast({ title: "Access Denied", description: "You don't have permission to use the POS workstation.", variant: "destructive" });
    return <Navigate to="/staff" replace />;
  }

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // Lock background scrolling when the receipt modal is open
  useEffect(() => {
    if (showReceiptModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showReceiptModal]);

  const addToCart = (item: MenuItem) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      updateCartQuantity(item.id, 1);
    } else {
      setCart(prev => [...prev, { ...item, quantity: 1, modifiers: [] }]); // Initialize with empty modifiers
      toast({ title: `Added ${item.name}`, description: "Tap to increment, right-click/long-press to remove." });
    }
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const sendToKitchen = async (isNewOrder: boolean) => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", description: "Add items before sending to kitchen.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let endpoint: string;
      let payload: any;

      if (!authToken) {
        throw new Error("Authentication token not found. Please log in.");
      }

      const itemsPayload = cart.map(i => ({
        menu_item_id: i.id, // Assuming backend expects menu_item_id
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        modifiers: i.modifiers,
      }));

      if (isNewOrder) {
        endpoint = '/payments/pos/create-order/';
        payload = {
          table_number: selectedTable,
          items: itemsPayload,
          order_type: 'table', // Always 'table' for this workflow
          payment_method: 'unpaid', // Initial status before payment
          status: 'sent_kitchen', // Directly set status for KOT
        };
      } else {
        if (!activeOrder?.order_id) {
          throw new Error("No active order to add items to.");
        }
        endpoint = `/payments/pos/add-to-order/${activeOrder.order_id}/`;
        payload = {
          items: itemsPayload,
        };
      }

      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const order = data.order || data; // Robustly handle both nested or direct object responses
        setActiveOrder(order); 
        setCart([]); // Clear new items cart
        toast({ title: "KOT Printed", description: `Order ${order.order_id?.substring(0, 6) || ''} ${isNewOrder ? 'created' : 'updated'} and sent to Kitchen.` });
      } else {
        const errorData = await res.json();
        toast({ title: "KOT Failed", description: errorData.error || "Failed to send order to kitchen.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error sending to kitchen:", e);
      toast({ title: "Error", description: e.message || "Could not connect to server to send KOT.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const markItemServed = async (orderId: string, itemIndex: number) => {
    if (!activeOrder || activeOrder.order_id !== orderId) return;
    if (!authToken) {
      toast({ title: "Authentication Error", description: "Please log in to perform this action.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/payments/pos/mark-item-served/${orderId}/${itemIndex}/`), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned an invalid response format.");
      }

      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data.order); // Backend returns updated order
        toast({ title: "Item Served", description: "Item marked as served." });
      } else {
        const errorData = await res.json();
        toast({ title: "Action Failed", description: errorData.error || "Could not update item status.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Error marking item served:", e);
      toast({ title: "Error", description: "Could not connect to server to mark item served.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const requestBill = async () => { // Renamed from requestBill to requestBill
    if (!activeOrder) return;
    if (activeOrder.status === 'bill_pending') {
      toast({ title: "Bill Already Requested", description: "Bill is already pending payment.", variant: "default" }); // Corrected variant
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/payments/pos/request-bill/${activeOrder.order_id}/`), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned an invalid response format.");
      }

      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data.order); // Backend returns updated order
        toast({ title: "Bill Requested", description: `Bill for order ${activeOrder.order_id.substring(0, 6)} sent to cashier.` });
      } else {
        const errorData = await res.json();
        toast({ title: "Failed to Request Bill", description: errorData.error || "Could not request bill.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Connection Error", description: "Could not reach server to request bill.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    if (currentOrderId) {
      fetch(getApiUrl(`/payments/orders/${encodeURIComponent(currentOrderId)}/discard/`), { method: 'DELETE' }).catch(() => {});
    }
    setLoading(false);
    setAwaitingMpesaConfirm(false);
    setCurrentOrderId(null);
    toast({
      title: "Transaction Cancelled",
      description: "M-Pesa payment stopped and order discarded.",
      variant: "destructive",
    });
  };

  const handleDownloadReceipt = async () => {
    if (receiptData) {
      const printContent = document.getElementById('receipt-print-area');
      if (printContent) {
        // --- Client-side PDF generation using html2canvas and jsPDF ---
        // You would need to install these libraries:
        // npm install html2canvas jspdf
        // import html2canvas from 'html2canvas';
        // import jsPDF from 'jspdf';

        // try {
        //   const canvas = await html2canvas(printContent, { scale: 2 }); // Scale for better quality
        //   const imgData = canvas.toDataURL('image/png');
        //   const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait, millimeters, A4 size
        //   const imgWidth = 210; // A4 width in mm
        //   const pageHeight = 297; // A4 height in mm
        //   const imgHeight = (canvas.height * imgWidth) / canvas.width;
        //   let heightLeft = imgHeight;
        //   let position = 0;
        //   pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        //   heightLeft -= pageHeight;
        //   while (heightLeft >= 0) {
        //     position = heightLeft - imgHeight;
        //     pdf.addPage();
        //     pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        //     heightLeft -= pageHeight;
        //   }
        //   pdf.save(`receipt-${receiptData.order_id}.pdf`);
        //   toast({ title: "Download Success", description: "Receipt downloaded as PDF." });
        // } catch (error) {
        //   console.error("Error generating PDF:", error);
        //   toast({ title: "Download Error", description: "Failed to generate PDF.", variant: "destructive" });
        // }
        // ----------------------------------------------------------------

        // For now, a simple alert if libraries are not installed
        toast({ title: "Download Feature", description: "PDF download requires 'html2canvas' and 'jspdf' libraries. Please install them and uncomment the code.", variant: "default" });
      }
    }
  };

  const handlePrintReceipt = () => {
    if (receiptData) {
      const printContent = document.getElementById('receipt-print-area');
      if (printContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Receipt - ${receiptData.order_id}</title>
                <style>/* Add any specific print styles here if needed */</style>
              </head>
              <body>${printContent.innerHTML}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        } else {
          toast({ title: "Print Error", description: "Could not open print window.", variant: "destructive" });
        }
      }
    }
  };

  const clearTableStatus = async () => {
    if (!selectedTable) return;
    const tableObj = tables.find(t => t.number === selectedTable);
    if (!tableObj) return;

    if (!window.confirm(`Mark Table ${selectedTable} as Unoccupied? This will clear the active session.`)) return;

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/payments/pos/tables/${tableObj.id}/`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'available' })
      });
      
      if (res.ok) {
        toast({ title: "Table Cleared", description: `Table ${selectedTable} is now unoccupied.` });
        setSelectedTable('');
        setActiveOrder(null);
        // Refresh table list
        const tablesRes = await fetch(getApiUrl('/payments/pos/tables/'), { headers: getAuthHeaders() });
        if (tablesRes.ok) {
          const tablesData = await tablesRes.json();
          setTables(tablesData.tables || []);
        }
      } else {
        const errorData = await res.json();
        toast({ title: "Action Failed", description: errorData.error || "Could not clear table.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Connection failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return toast({ title: "Cart is empty", variant: "destructive" });
    
    setReceiptData(null);
    setShowReceiptModal(false);

    let phoneToSend = customerPhone;
    if (paymentMethod === 'mpesa') {
      if (!customerPhone) return toast({ title: "Phone number required", variant: "destructive" });
      // Strict M-Pesa format validation for Daraja (2547XXXXXXXX or 2541XXXXXXXX)
      let cleanedPhone = customerPhone.replace(/\D/g, ''); // Remove all non-digits
      
      // Normalize to 254XXXXXXXXX format
      if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) { // e.g., 0712345678
        phoneToSend = '254' + cleanedPhone.substring(1);
      } else if (cleanedPhone.length === 9 && (cleanedPhone.startsWith('7') || cleanedPhone.startsWith('1'))) { // e.g., 712345678
        phoneToSend = '254' + cleanedPhone;
      } else if (cleanedPhone.startsWith('254') && cleanedPhone.length === 12) { // Already in 254 format
        phoneToSend = cleanedPhone;
      } else {
        // If it doesn't match common Kenyan formats, consider it invalid for M-Pesa
        return toast({ title: "Invalid Phone Number", description: "Please enter a valid Kenyan M-Pesa number (e.g., 07XXXXXXXX or 2547XXXXXXXX).", variant: "destructive" });
      }
    }


    setLoading(true);
    try {
      if (!authToken) {
        throw new Error("Authentication token not found. Please log in.");
      }
      const res = await fetch(getApiUrl('/payments/pos/create-order/'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          table_number: orderType === 'table' ? selectedTable : 'Counter',
          phone: phoneToSend, // Use the normalized phone number
          payment_method: paymentMethod,
          items: cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, modifiers: [] })),
          order_type: orderType
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (paymentMethod === 'mpesa') {
          if (!data.stk_response?.CheckoutRequestID) {
            setLoading(false);
            return toast({ title: "M-Pesa Error", description: "Could not initiate STK push.", variant: "destructive" });
          }
          
          const checkoutId = data.stk_response.CheckoutRequestID;
          setCurrentOrderId(data.order_id);
          setAwaitingMpesaConfirm(true);
          setLoading(false);

          let transactionSettled = false;
          toast({ title: "Awaiting Confirmation", description: "Customer should complete the M-Pesa prompt." });

          const checkPaymentStatus = async () => {
            if (transactionSettled || !pollTimerRef.current) return;
            try {
              const statusRes = await fetch(getApiUrl(`/payments/status/?checkout_id=${checkoutId}`));
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.status === "success") {
                  transactionSettled = true;
                  if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
                  if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
                  
                  setAwaitingMpesaConfirm(false);
                  setReceiptData({ ...(data as PosOrderReceipt), payment_method: paymentMethod, order_type: orderType });
                  setCart([]);
                  setCustomerPhone('');
                  setSelectedTable('');
                  setShowReceiptModal(true);
                  toast({ title: "Payment Success", description: "Receipt generated." });
                  return;
                }
                if (statusData.status === "failed") {
                  transactionSettled = true;
                  handleCancelTransaction();
                  return;
                }
              }
            } catch (e) {}
            if (!transactionSettled && pollTimerRef.current) {
              pollTimerRef.current = window.setTimeout(checkPaymentStatus, 1500);
            }
          };

          pollTimerRef.current = window.setTimeout(checkPaymentStatus, 1000);
          safetyTimeoutRef.current = window.setTimeout(() => {
            if (!transactionSettled) handleCancelTransaction();
          }, 60000);

        } else {
          // Cash
          toast({ title: "Order Success", description: "Order marked as PAID (Cash)" });
          setCart([]);
          setCustomerPhone('');
          setSelectedTable('');
          setReceiptData({ ...(data as PosOrderReceipt), payment_method: paymentMethod, order_type: orderType });
          setShowReceiptModal(true);
          setLoading(false);
        }
      } else {
        toast({ title: "Order Failed", description: data.message || data.error, variant: "destructive" });
        setLoading(false);
      }
    } catch (err) {
      toast({ title: "Error", description: "Could not connect to server", variant: "destructive" });
    }
  };

  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-12rem)]">
      {/* Left: Menu Selection */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
          <Link to="/staff" className="text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20}/></Link>
          <div className="text-center">
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              {selectedTable ? `Table ${selectedTable}` : 'POS Workstation'}
            </h2> {/* Display selected table number */}
            {staffName && <p className="text-[10px] text-orange-500 font-medium">{staffName}</p>}
          </div>
          {receiptData && !awaitingMpesaConfirm && <button onClick={() => setShowReceiptModal(true)} className="text-slate-400 hover:text-white transition-colors"><Printer size={20}/></button>}
        </div>

        <div className="p-4 border-b border-slate-800 flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search items..." 
              className="w-full bg-slate-800 border-none rounded-xl py-2 pl-10 text-white outline-none focus:ring-2 focus:ring-orange-500/50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMenu.map(item => (
            <button 
            key={item.id} // Use item.id as key
            onContextMenu={(e) => { e.preventDefault(); updateCartQuantity(item.id, -99); }} // Hold to remove from cart
            onClick={() => addToCart(item)}
            className="bg-slate-800 rounded-xl p-3 text-left border border-slate-700 hover:border-orange-500 transition-all active:scale-95 group relative"
            >
              <img
                src={formatImageUrl(item.image_url)}
                alt={item.name} 
                className="w-full h-24 object-cover rounded-lg mb-2" 
              />
              <p className="font-semibold text-slate-100 text-sm truncate">{item.name}</p>
              <p className="text-orange-500 font-bold text-sm">KES {item.price}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <ShoppingCart className="text-orange-500" />
          <h3 className="font-display text-xl text-slate-100">Order Summary</h3>
          {selectedTable && (
            <button 
              onClick={clearTableStatus}
              title="Reset Table Status"
              className="ml-auto p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-slate-700"
            >
              <UserMinus size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
          {/* Locked Sent Items */}
          {activeOrder && activeOrder.items.length > 0 && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Sent to Kitchen</p>
          )}
          {activeOrder && activeOrder.items.map((item, idx) => ( // Display items already sent to kitchen
            <div key={idx} className="flex items-center justify-between gap-2 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 opacity-80">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={12} className={item.is_served ? "text-emerald-500" : "text-blue-500"} />
                  <p className="text-slate-100 text-sm font-medium">{item.name} <span className="text-[10px] text-slate-500">(x{item.quantity})</span></p>
                </div>
                {(item.modifiers || []).length > 0 && (
                  <p className="text-xs text-slate-500 ml-4 italic">({item.modifiers.join(', ')})</p>
                )}
              </div>
              {!item.is_served && (
                <button onClick={() => markItemServed(activeOrder.order_id, idx)} disabled={loading} className="text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase">Serve</button>
              )}
            </div>
          ))}

          {/* New Unsent Items */}
          {cart.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 bg-orange-500/5 p-3 rounded-xl border border-orange-500/20 animate-in slide-in-from-right-2">
              <div className="flex-1 min-w-0">
                <p className="text-slate-100 text-sm font-bold truncate">{item.name} <span className="text-[9px] bg-orange-500 text-white px-1 rounded ml-1">NEW</span></p>
                <p className="text-slate-400 text-xs">KES {item.price * item.quantity}</p>
                {(item.modifiers || []).length > 0 && (
                  <p className="text-xs text-slate-500 ml-0 italic">({item.modifiers.join(', ')})</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1 hover:bg-slate-700 rounded"><Minus size={14}/></button>
                <span className="text-sm font-bold text-slate-200">{item.quantity}</span>
                <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1 hover:bg-slate-700 rounded"><Plus size={14}/></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-center text-slate-500 py-10 italic">Cart is empty</p>}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-4">
          {/* Order Type Selection */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button 
              disabled={cart.length === 0 || loading || awaitingMpesaConfirm}
              onClick={() => sendToKitchen(!activeOrder)} // Pass true if no active order, false if adding to existing
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              <Send size={18} />
              <span className="text-[10px] uppercase">Send to Kitchen</span>
            </button>
            <button 
              disabled={!activeOrder || activeOrder.status === 'bill_pending'}
              onClick={requestBill} // Request Bill button
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-yellow-500 text-black font-bold hover:bg-yellow-600 transition-all disabled:opacity-50"
            >
              <Banknote size={18} />
              <span className="text-[10px] uppercase">Request Bill</span>
            </button>
          </div>

          <div className="space-y-2">
              <button 
                onClick={() => setOrderType('table')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${
                  orderType === 'table' 
                    ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" 
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                }`}
              >
                <Utensils size={14} /> Dine In
              </button>
              <button 
                onClick={() => {
                  setOrderType('takeaway');
                  setSelectedTable('Counter');
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${
                  orderType === 'takeaway' 
                    ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" 
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                }`}
              >
                <ShoppingCart size={14} /> Takeaway
              </button>
          </div>

          {/* Table Selection - Only for Dine In */}
          {orderType === 'table' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Assigned Table</label>
              <div className="relative">
                <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <select 
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:ring-1 focus:ring-orange-500 appearance-none cursor-pointer shadow-sm hover:border-slate-600"
                >
                  <option value="">-- Choose Table --</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.number}>Table {t.number} {t.status === 'occupied' ? '• Occupied' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <div className="flex bg-slate-800 rounded-xl p-1">
              <button 
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}
              >
                <Banknote size={14} /> Cash
              </button>
              <button 
                onClick={() => setPaymentMethod('mpesa')}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'mpesa' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
              >
                <Smartphone size={14} /> M-Pesa
              </button>
            </div>
          </div>

          {paymentMethod === 'mpesa' && (
            <input 
              type="tel" 
              placeholder="e.g., 0712345678 or 254712345678" 
              className="w-full bg-slate-800 border-none rounded-xl p-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/50"
              value={customerPhone}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').substring(0, 12);
                setCustomerPhone(val);
              }}
            />
          )}

          <div className="flex justify-between items-center px-1">
            <span className="text-slate-400 text-sm">Total Amount</span>
            <span className="text-white font-bold text-xl">KES {total}</span>
          </div>

          <button
            disabled={loading || cart.length === 0 || awaitingMpesaConfirm || orderType === 'table'} // Disable for dine-in
            onClick={handleCheckout}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
          >
            {loading ? 'Processing...' : awaitingMpesaConfirm ? 'Awaiting Payment...' : `Place ${paymentMethod.toUpperCase()} Order`}
          </button>

          {awaitingMpesaConfirm && (
            <button
              onClick={handleCancelTransaction}
              className="w-full mt-2 rounded-xl border border-red-500/50 text-red-500 py-2 text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
            >
              Cancel Transaction
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"> {/* Backdrop */}
          <div className="relative w-full max-w-lg my-auto bg-slate-900 rounded-xl shadow-lg border border-slate-800 flex flex-col max-h-[95vh]"> {/* Main modal container, now flex-col */}
            {/* Modal Header */}
            <div className="flex justify-end p-4 border-b border-slate-800 flex-shrink-0">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div id="receipt-print-area" className="flex-grow overflow-y-auto p-4">
              <Receipt
                order={{
                  ...(receiptData as PosOrderReceipt), // Explicitly cast to PosOrderReceipt
                  table_number: receiptData!.table,
                } as any}
                onClose={() => setShowReceiptModal(false)}
              />
            </div>

            {/* Modal Footer with action buttons */}
            <div className="p-4 border-t border-slate-800 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={handleDownloadReceipt}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Download size={18} /> Download PDF
              </button>
              <button
                onClick={handlePrintReceipt}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Printer size={18} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default EmployeeTable;