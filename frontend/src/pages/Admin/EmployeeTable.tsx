import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { getApiUrl, apiFetch, getSseUrl } from '@/lib/api';
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
  Sparkles,
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
        const order = normalizeOrder(data.order || data) || {
          order_id: '',
          table: '',
          table_details: null,
          phone: '',
          delivery_address: '',
          delivery_distance_km: null,
          delivery_time: '',
          delivery_cost: 0,
          status: 'unknown',
          split_count: 0,
          total_amount: 0,
          food_cost: 0,
          is_paid: false,
          is_billed: false,
          created_at: '',
          items: [],
          payment_method: '',
          order_type: 'takeaway',
          stk_response: undefined,
        } as PosOrderReceipt;
        setCart([]); // Clear new items cart
        // If the order was sent to kitchen, clear the activeOrder so waiter can start a new one,
        // but retain a preview of the last sent order so items remain visible.
        if (order.status === 'sent_kitchen' || order.status === 'preparing') {
          setActiveOrder(null);
          setLastSentOrder(order);
          setReceiptData(order);
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
  const unsentItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const tableDisplay = orderType === 'takeaway' ? 'Counter' : selectedTable ? `Table ${selectedTable}` : 'Unassigned';
  const orderStatusLabel = visibleOrder?.status
    ? visibleOrder.status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'New Order';

  const handlePrintTicket = async () => {
    const orderToPrint = activeOrder || receiptData;
    if (!orderToPrint) {
      toast({ title: "No Order to Print", description: "Please create or select an order first.", variant: "destructive" });
      return;
    }

    setReceiptData(orderToPrint);
    setShowReceiptModal(true);
  };

  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="space-y-8">
        <div className="rounded-[2rem] border border-slate-800/70 bg-slate-950/90 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200 shadow-sm shadow-orange-500/10">
                <Sparkles size={18} /> Waiter POS
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-semibold tracking-tight text-white">Supercharged Waiter Workstation</h1>
              <p className="max-w-2xl text-slate-300 text-lg leading-9 font-medium">
                Quickly build orders, send tickets to the kitchen, and manage table assignments with a modern waiter-first interface designed for speed and clarity.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/95 p-5 text-center shadow-sm shadow-slate-950/10">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Active Table</p>
                <p className="mt-3 text-xl font-bold text-white">{tableDisplay}</p>
              </div>
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/95 p-5 text-center shadow-sm shadow-slate-950/10">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Order Status</p>
                <p className="mt-3 text-xl font-bold text-white">{orderStatusLabel}</p>
              </div>
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/95 p-5 text-center shadow-sm shadow-slate-950/10">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pending Items</p>
                <p className="mt-3 text-xl font-bold text-white">{unsentItemCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-18rem)]">
          <div className="flex-1 flex flex-col min-w-0 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl shadow-slate-950/20 overflow-hidden">
            <div className="px-5 py-4 bg-slate-800/70 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Menu Catalog</p>
                <h2 className="text-xl font-bold text-white">Tap to add items</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-950 px-3 py-2 text-xs text-slate-300 border border-slate-700">{filteredMenu.length} items</span>
                <button onClick={() => setSearchQuery('')} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 transition">Reset</button>
              </div>
            </div>

            <div className="p-5 border-b border-slate-800 flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search menu items..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-orange-500/40"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <button onClick={() => setSearchQuery('')} className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-orange-400 transition">Clear</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMenu.map(item => (
                <button 
                  key={item.id}
                  onContextMenu={(e) => { e.preventDefault(); updateCartQuantity(item.id, -99); }}
                  onClick={() => addToCart(item)}
                  className="group rounded-[1.75rem] border border-slate-800 bg-slate-950 transition hover:border-orange-500 hover:shadow-[0_20px_60px_-30px_rgba(251,146,60,0.55)] overflow-hidden text-left"
                >
                  <div className="relative h-40 overflow-hidden bg-slate-900">
                    <img
                      src={formatImageUrl(item.image_url)}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.category}</p>
                      <p className="mt-2 text-lg font-semibold text-white truncate">{item.name}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm text-slate-300 line-clamp-2">{item.description || 'Tap to add this item.'}</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-orange-400">KES {item.price}</span>
                      <span className="rounded-full bg-slate-900 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">Tap to add</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-96 flex flex-col bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl shadow-slate-950/20 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-fuchsia-500 text-white shadow-lg shadow-orange-500/20">
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Order Summary</p>
                  <h2 className="text-2xl font-semibold text-white">Ready to send</h2>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Table</p>
                  <p className="mt-2 text-lg font-semibold text-white">{tableDisplay}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Waiter</p>
                  <p className="mt-2 text-lg font-semibold text-white">{finalWaiterName}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-slate-950 to-slate-900">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Order Status</p>
                <p className="mt-2 text-2xl font-bold text-white">{orderStatusLabel}</p>
                <p className="mt-1 text-sm text-slate-400">{visibleOrder ? `Order ID: ${visibleOrder.order_id}` : 'No active order yet'}</p>
              </div>

              <div className="space-y-3">
                {visibleOrderItems.length > 0 && (
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sent to Kitchen</p>
                      {lastSentOrder && !activeOrder && (
                        <button onClick={() => setLastSentOrder(null)} className="text-xs text-slate-400 hover:text-white">Hide</button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {visibleOrderItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-950/80 p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                            <p className="text-xs text-slate-500">x{item.quantity} • KES {(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                          {!item.is_served && (
                            <button onClick={() => markItemServed(visibleOrder!.order_id, idx)} disabled={loading} className="rounded-2xl bg-orange-500 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-950 hover:bg-orange-400 transition">Serve</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-orange-300">New Items</p>
                    <div className="mt-3 space-y-3">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950/70 p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                            <p className="text-xs text-slate-400">x{item.quantity} • KES {item.price * item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateCartQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`} className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-orange-500 transition"><Minus size={14} /></button>
                            <span className="text-sm font-semibold text-white">{item.quantity}</span>
                            <button onClick={() => updateCartQuantity(item.id, 1)} aria-label={`Increase ${item.name} quantity`} className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-orange-500 transition"><Plus size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cart.length === 0 && visibleOrderItems.length === 0 && (
                  <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-center text-slate-500">
                    Add items from the menu to begin a new order.
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 space-y-4 bg-slate-950/95">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Order total</p>
                  <p className="mt-2 text-3xl font-bold text-white">KES {total.toFixed(2)}</p>
                </div>
                <span className="rounded-3xl bg-slate-800 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">{unsentItemCount} items</span>
              </div>

              <div className="grid gap-3">
                <button
                  disabled={loading || cart.length === 0 || (orderType === 'table' && !selectedTable)}
                  onClick={() => sendToKitchen(activeOrder ? false : true)}
                  className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-fuchsia-500 py-4 text-sm font-bold uppercase tracking-[0.15em] text-slate-950 shadow-xl shadow-orange-500/20 transition hover:shadow-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <Send size={18} />
                    {loading ? 'Sending...' : 'Send to Kitchen'}
                  </span>
                </button>
                <button
                  disabled={!(activeOrder || receiptData)}
                  onClick={handlePrintTicket}
                  className="w-full rounded-3xl border border-slate-800 bg-slate-900 py-4 text-sm font-bold uppercase tracking-[0.15em] text-white shadow-sm hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Printer size={18} /> Print Ticket
                </button>
              </div>
            </div>
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