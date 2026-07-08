import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { getApiUrl, apiFetch } from '@/lib/api';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';
import { getNormalizedStaffRole, getStaffName, getStaffId } from '@/lib/staff-session';
import { getAuthToken, getAuthHeaders } from '@/lib/auth'; // Import the new getAuthToken and getAuthHeaders
import { formatImageUrl } from '@/lib/image';
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
  const [lastSentOrder, setLastSentOrder] = useState<PosOrderReceipt | null>(null);
  const [orderType, setOrderType] = useState<'table' | 'takeaway'>('table');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<PosOrderReceipt | null>(null);
  const [waiterNameOverride, setWaiterNameOverride] = useState<string>('');

  const { toast } = useToast();
  const pollTimerRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  const adminToken = getAdminToken();
  const isAdmin = adminToken && isAdminSessionValid();
  const staffRole = getNormalizedStaffRole();
  const staffName = getStaffName();
  const authToken = getAuthToken();
  const canAccess = isAdmin || ['waiter', 'cashier', 'manager'].includes(staffRole);

  const normalizeOrder = (value: any): PosOrderReceipt | null => {
    if (!value || typeof value !== 'object') return null;
    return {
      ...value,
      items: Array.isArray(value.items) ? value.items : [],
    } as PosOrderReceipt;
  };

  // Determine final waiter name: use override if set, otherwise use staffName, fallback to 'Staff'
  const finalWaiterName = waiterNameOverride || staffName || 'Staff';

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch menu items without auth headers (public endpoint) to avoid token mismatch issues
        try {
          const menuData: any = await apiFetch('/payments/menu-items/')
          setMenuItems(menuData.menu_items || [])
        } catch (err) {
          console.error('Failed to load menu items', err)
          setMenuItems([])
        }

        try {
          const tablesData: any = await apiFetch('/payments/pos/tables/', { headers: getAuthHeaders() })
          setTables(tablesData.tables || [])
        } catch (err) {
          console.error('Failed to load tables', err)
          setTables([])
        }

        // Auto-select table if provided in URL
        const urlTable = searchParams.get('table');
        if (urlTable) {
          setSelectedTable(urlTable);
          setOrderType('table');

          // Fetch active order for this table to show existing items
          try { // Use authToken for auth
            const orderData: any = await apiFetch(`/payments/pos/active-order/?table_number=${urlTable}`, { headers: getAuthHeaders() })
            const normalizedOrder = normalizeOrder(orderData?.order || orderData);
            if (normalizedOrder) setActiveOrder(normalizedOrder)
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

  // Listen for Server-Sent Events to keep preview/in-memory orders in sync
  useEffect(() => {
    if (typeof window === 'undefined' || !window.EventSource) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(getSseUrl('/payments/stream/'));
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          const type = payload.type;
          const data = payload.data || {};
          // If the lastSentOrder was updated/ready/paid/changed on the server, clear the preview
          if (lastSentOrder && data.order_id && data.order_id === lastSentOrder.order_id && (type === 'order_update' || type === 'order_ready' || type === 'new_order')) {
            setLastSentOrder(null);
          }
          // If the activeOrder was updated, refresh it from server
          if (activeOrder && data.order_id && data.order_id === activeOrder.order_id && (type === 'order_update' || type === 'order_ready')) {
            (async () => {
              try {
                const res = await fetch(getApiUrl(`/payments/orders/${activeOrder.order_id}/`), { headers: getAuthHeaders() });
                if (res.ok) {
                  const od = await res.json();
                  const normalizedOrder = normalizeOrder(od.order || od);
                  if (normalizedOrder) setActiveOrder(normalizedOrder);
                }
              } catch (e) {
                // ignore
              }
            })();
          }
        } catch (e) {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        // Silent reconnects are handled by EventSource automatically
      };
    } catch (e) {
      // EventSource may be blocked in some environments — fail silently
    }
    return () => { if (es) es.close(); };
  }, [activeOrder, lastSentOrder]);

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
        if (orderType === 'table' && !selectedTable.trim()) {
          throw new Error('Please select a table before sending to kitchen.');
        }
        endpoint = '/payments/pos/create-order/';
        payload = {
          table_number: orderType === 'table' ? selectedTable : 'Counter',
          items: itemsPayload,
          order_type: orderType,
          payment_method: 'unpaid',
          status: 'sent_kitchen',
          waiter_name: finalWaiterName,
          waiter_id: getStaffId() || undefined,
        };
      } else {
        if (!activeOrder?.order_id) {
          throw new Error("No active order to add items to.");
        }
        endpoint = `/payments/pos/add-to-order/${activeOrder.order_id}/`;
        payload = {
          items: itemsPayload,
          waiter_name: finalWaiterName,
          waiter_id: getStaffId() || undefined,
        };
      }

      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const order = normalizeOrder(data.order || data) || { order_id: '', status: 'unknown', items: [] } as PosOrderReceipt;
        setCart([]); // Clear new items cart
        // If the order was sent to kitchen, clear the activeOrder so waiter can start a new one,
        // but retain a preview of the last sent order so items remain visible.
        if (order.status === 'sent_kitchen' || order.status === 'preparing') {
          setActiveOrder(null);
          setLastSentOrder(order);
        } else {
          setActiveOrder(order);
          setLastSentOrder(null);
        }
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
    // Allow serving items for either the activeOrder or the lastSentOrder preview
    const targetOrder = activeOrder || lastSentOrder;
    if (!targetOrder || targetOrder.order_id !== orderId) return;
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
        // If we had a lastSentOrder preview for this order, clear it because the order is now being modified/served
        if (lastSentOrder && data.order && lastSentOrder.order_id === data.order.order_id) {
          setLastSentOrder(null);
        }
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
  const visibleOrder = activeOrder ?? lastSentOrder;
  const visibleOrderItems = Array.isArray(visibleOrder?.items) ? visibleOrder.items : [];

  const handlePrintTicket = async () => {
    if (!activeOrder) {
      toast({ title: "No Active Order", description: "Please create or select an order first.", variant: "destructive" });
      return;
    }
    
    setReceiptData(activeOrder);
    setShowReceiptModal(true);
  };

  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-12rem)]">
      {/* Left: Menu Selection */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
          <Link to="/staff" className="text-slate-400 hover:text-white transition-colors"><ArrowLeft size={20}/></Link>
          <div className="text-center">
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              {selectedTable ? `Table ${selectedTable}` : 'POS Workstation'}
            </h2> {/* Display selected table number */}
            {staffName && <p className="text-[10px] text-orange-500 font-medium">{staffName}</p>}
          </div>
          {receiptData && <button onClick={() => setShowReceiptModal(true)} className="text-slate-400 hover:text-white transition-colors"><Printer size={20}/></button>}
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
          <div className="ml-3">
            {menuItems.length === 0 && (
              <button onClick={async () => {
                setInitialLoading(true);
                try {
                  const mres = await fetch(getApiUrl('/payments/menu-items/'));
                  const mdata = mres.ok ? await mres.json() : { menu_items: [] };
                  setMenuItems(mdata.menu_items || []);
                } catch (e) {
                  console.error('Failed to reload menu items', e);
                } finally {
                  setInitialLoading(false);
                }
              }} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded">Reload Menu</button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-4">
          {filteredMenu.map(item => (
            <button 
            key={item.id} // Use item.id as key
            onContextMenu={(e) => { e.preventDefault(); updateCartQuantity(item.id, -99); }} // Hold to remove from cart
            onClick={() => addToCart(item)}
            className="bg-slate-800 rounded-xl p-3 text-left border border-slate-700 hover:border-orange-500 transition-all active:scale-95 group relative min-h-[120px]"
            >
              <img
                src={formatImageUrl(item.image_url)}
                alt={item.name}
                className="w-full h-20 object-cover rounded-lg mb-2"
              />
              <div className="min-h-[42px]">
                {/* spacer to keep title/price aligned */}
              </div>
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
          {/* New Order button to clear preview and start fresh */}
          <button
            title="Start new order"
            onClick={() => { setLastSentOrder(null); setActiveOrder(null); setCart([]); setSelectedTable(''); }}
            className="ml-auto p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
          >
            New Order
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
          {/* Locked Sent Items */}
          {visibleOrder && visibleOrderItems.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Sent to Kitchen</p>
              {lastSentOrder && !activeOrder && (
                <button onClick={() => setLastSentOrder(null)} className="text-xs text-slate-400 hover:text-white">Hide</button>
              )}
            </div>
          )}
          {visibleOrder && visibleOrderItems.map((item, idx) => ( // Display items already sent to kitchen
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
                <button onClick={() => markItemServed(visibleOrder!.order_id, idx)} disabled={loading} className="text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase">Serve</button>
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
                <button onClick={() => updateCartQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`} className="p-2 bg-slate-800 hover:bg-orange-500 text-white rounded-lg border border-slate-700 shadow-sm transition-colors"><Minus size={16}/></button>
                <span className="text-sm font-bold text-slate-200 px-2">{item.quantity}</span>
                <button onClick={() => updateCartQuantity(item.id, 1)} aria-label={`Increase ${item.name} quantity`} className="p-2 bg-slate-800 hover:bg-orange-500 text-white rounded-lg border border-slate-700 shadow-sm transition-colors"><Plus size={16}/></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-center text-slate-500 py-10 italic">Cart is empty</p>}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-4">
          {/* Order Type Selection */}
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

                        {/* Waiter Name Input */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Waiter / Server</label>
                          <input
                            type="text"
                            placeholder={staffName || 'Enter waiter name'}
                            value={waiterNameOverride}
                            onChange={e => setWaiterNameOverride(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-orange-500 shadow-sm hover:border-slate-600"
                          />
                        </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center px-1">
            <span className="text-slate-400 text-sm">Total Amount</span>
            <span className="text-white font-bold text-xl">KES {total}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={loading || cart.length === 0 || (orderType === 'table' && !selectedTable)}
              onClick={() => sendToKitchen(activeOrder ? false : true)}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Send size={18} />
              {loading ? 'Sending...' : 'Send to Kitchen'}
            </button>
            
          </div>

          <button
            disabled={!activeOrder}
            onClick={handlePrintTicket}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Printer size={18} />
            Print Ticket
          </button>
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