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

const fallbackMenuItems: MenuItem[] = [
  { id: 1, name: 'Classic Smash Burger', price: 750, category: 'Burgers', image_url: '', description: 'Double patty, cheddar, pickles, special sauce', modifiers: [] },
  { id: 2, name: 'BBQ Bacon Burger', price: 860, category: 'Burgers', image_url: '', description: 'Smoked bacon, BBQ glaze, onion rings', modifiers: [] },
  { id: 3, name: 'Loaded Fries', price: 360, category: 'Sides', image_url: '', description: 'Cheese sauce, bacon bits, green onions', modifiers: [] },
  { id: 4, name: 'Classic Milkshake', price: 420, category: 'Drinks', image_url: '', description: 'Vanilla, chocolate, or strawberry', modifiers: [] },
  { id: 5, name: 'Brownie Sundae', price: 460, category: 'Desserts', image_url: '', description: 'Warm brownie, vanilla ice cream, hot fudge', modifiers: [] },
];

const EmployeeTable: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(fallbackMenuItems);
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
  // waiter POS does not use the customer CartModal
  const [waiterNameOverride, setWaiterNameOverride] = useState<string>('');
  const [cartOpen, setCartOpen] = useState(true);
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);
  const [cartButtonPos, setCartButtonPos] = useState({ x: 32, y: 32 });
  const cartDragRef = useRef(false);
  const cartDragOffsetRef = useRef({ x: 0, y: 0 });

  const { toast } = useToast();

  useEffect(() => {
    const setInitialForMobile = () => {
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w < 1024) {
          setCartButtonPos(pos => {
            // If user hasn't moved it (still default), place at bottom-right
            if (pos.x === 32 && pos.y === 32) {
              return { x: Math.max(12, w - 72 - 12), y: Math.max(12, h - 72 - 12) };
            }
            return pos;
          });
        }
      } catch (e) {
        // ignore in SSR or testing
      }
    };

    setInitialForMobile();
    const handleResize = () => {
      setCartButtonPos(pos => {
        const maxX = window.innerWidth - 72;
        const maxY = window.innerHeight - 72;
        return { x: Math.max(0, Math.min(pos.x, maxX)), y: Math.max(0, Math.min(pos.y, maxY)) };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const pollTimerRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  // Update page metadata for SEO
  useEffect(() => {
    document.title = 'Waiter POS | Tasty Bites Hub - Fast Order Management';
    
    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Waiter Point-of-Sale system for fast order management, kitchen display tickets, and real-time table assignments at Tasty Bites Hub restaurant.');
    
    // Update or create meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'waiter POS, order management, kitchen tickets, table service, restaurant management, fast ordering, Tasty Bites Hub');
    
    // Update Open Graph tags for social sharing and Google
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', 'Waiter POS - Order Management System');
    
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', 'Modern waiter point-of-sale system for managing table orders, kitchen tickets, and staff assignments in real-time.');
    
    // Update canonical URL for waiter POS
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://tastybites.example/staff/pos');
  }, []);

  // Inject schema.org structured data for search engines to display rich snippets
  useEffect(() => {
    // Create breadcrumb navigation structure
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Tasty Bites Hub',
          'item': 'https://tastybites.example'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Staff Portal',
          'item': 'https://tastybites.example/staff'
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': 'Waiter POS',
          'item': 'https://tastybites.example/staff/pos'
        }
      ]
    };

    // Create menu items schema with pricing and descriptions
    const menuItemsSchema = menuItems.map((item, idx) => ({
      '@context': 'https://schema.org',
      '@type': 'MenuItem',
      'name': item.name,
      'description': item.description || `${item.category} item at Tasty Bites Hub`,
      'image': item.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
      'offers': {
        '@type': 'Offer',
        'priceCurrency': 'KES',
        'price': item.price.toString(),
        'availability': 'https://schema.org/InStock',
        'url': 'https://tastybites.example/menu'
      },
      'category': item.category,
      'itemListElement': idx
    }));

    // Create restaurant schema with ordering capability
    const restaurantSchema = {
      '@context': 'https://schema.org',
      '@type': ['Restaurant', 'FoodEstablishment'],
      'name': 'Tasty Bites Hub',
      'description': 'Modern restaurant POS and ordering system with waiter management and kitchen display',
      'url': 'https://tastybites.example',
      'image': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&h=630&fit=crop',
      'priceRange': 'KES 200 - 1000',
      'areaServed': {
        '@type': 'City',
        'name': 'Nairobi'
      },
      'servesCuisine': ['Burgers', 'Desserts', 'Beverages'],
      'menu': {
        '@type': 'Menu',
        'hasMenuSection': [
          {
            '@type': 'MenuSection',
            'name': 'Burgers',
            'hasMenuItem': menuItems.filter(m => m.category === 'Burgers').map(m => ({
              '@type': 'MenuItem',
              'name': m.name,
              'description': m.description,
              'image': m.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
              'offers': {
                '@type': 'Offer',
                'priceCurrency': 'KES',
                'price': m.price.toString()
              }
            }))
          },
          {
            '@type': 'MenuSection',
            'name': 'Desserts',
            'hasMenuItem': menuItems.filter(m => m.category === 'Desserts').map(m => ({
              '@type': 'MenuItem',
              'name': m.name,
              'description': m.description,
              'image': m.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
              'offers': {
                '@type': 'Offer',
                'priceCurrency': 'KES',
                'price': m.price.toString()
              }
            }))
          },
          {
            '@type': 'MenuSection',
            'name': 'Beverages',
            'hasMenuItem': menuItems.filter(m => m.category === 'Beverages').map(m => ({
              '@type': 'MenuItem',
              'name': m.name,
              'description': m.description,
              'image': m.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
              'offers': {
                '@type': 'Offer',
                'priceCurrency': 'KES',
                'price': m.price.toString()
              }
            }))
          }
        ]
      },
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': '4.8',
        'ratingCount': '120'
      },
      'sameAs': [
        'https://www.facebook.com/tastybites',
        'https://www.instagram.com/tastybites',
        'https://twitter.com/tastybites'
      ]
    };

    // Remove existing structured data
    document.querySelectorAll('script[data-search-engine-schema]').forEach(el => el.remove());

    // Inject all schemas
    [breadcrumbSchema, restaurantSchema].forEach((schema, idx) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-search-engine-schema', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[data-search-engine-schema]').forEach(el => el.remove());
    };
  }, [menuItems]);

  const adminToken = getAdminToken();
  const isAdmin = adminToken && isAdminSessionValid();
  const staffRole = getNormalizedStaffRole();
  const staffName = getStaffName();
  const authToken = getAuthToken();
  const canAccess = isAdmin || ['waiter', 'cashier', 'manager'].includes(staffRole);
  const finalWaiterName = waiterNameOverride.trim() || staffName || 'Staff';

  const normalizeOrder = (value: any): PosOrderReceipt | null => {
    if (!value || typeof value !== 'object') return null;
    return {
      ...value,
      items: Array.isArray(value.items) ? value.items : [],
    } as PosOrderReceipt;
  };

  const normalizeMenuItem = (item: any): MenuItem => ({
    id: Number(item?.id ?? item?.menu_item_id ?? 0),
    name: String(item?.name || 'Unnamed Item'),
    price: Number(item?.price ?? item?.unit_price ?? 0),
    category: String(item?.category || item?.menu_category || 'General'),
    image_url: String(item?.image_url || item?.image || ''),
    description: String(item?.description || ''),
    modifiers: Array.isArray(item?.modifiers) ? item.modifiers : [],
  });

  useEffect(() => {
    let cancelled = false;

    const loadPosData = async () => {
      try {
        const [menuRes, tablesRes] = await Promise.allSettled([
          fetch(getApiUrl('/payments/menu-items/'), { headers: getAuthHeaders() }),
          fetch(getApiUrl('/payments/pos/tables/'), { headers: getAuthHeaders() }),
        ]);

        if (!cancelled) {
          if (menuRes.status === 'fulfilled' && menuRes.value.ok) {
            const menuData = await menuRes.value.json();
            const menuItemsPayload = Array.isArray(menuData?.menu_items)
              ? menuData.menu_items
              : Array.isArray(menuData)
                ? menuData
                : [];
            setMenuItems(menuItemsPayload.length ? menuItemsPayload.map(normalizeMenuItem) : fallbackMenuItems);
          } else if (!cancelled) {
            setMenuItems(fallbackMenuItems);
          }

          if (tablesRes.status === 'fulfilled' && tablesRes.value.ok) {
            const tablesData = await tablesRes.value.json();
            const tablePayload = Array.isArray(tablesData?.tables)
              ? tablesData.tables
              : Array.isArray(tablesData)
                ? tablesData
                : [];
            setTables(tablePayload.map((table: any) => ({
              id: Number(table?.id ?? 0),
              number: String(table?.number ?? table?.table_number ?? ''),
              status: String(table?.status || ''),
            })));
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load POS catalog data', err);
          setMenuItems(fallbackMenuItems);
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    };

    loadPosData();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (orderType !== 'table' || selectedTable.trim()) return;
    const fallbackTable = tables.find((table) => table.number?.trim() && table.status?.toLowerCase() !== 'occupied')
      || tables.find((table) => table.number?.trim());
    if (fallbackTable) {
      setSelectedTable(String(fallbackTable.number));
    }
  }, [orderType, selectedTable, tables]);

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

  

  // Quantity updates handled via updateCartQuantity for waiter flow

  const canAddToExistingOrder = (order: PosOrderReceipt | null) => {
    if (!order) return false;
    const terminalStatuses = ['paid', 'bill_pending', 'ready', 'completed', 'cancelled'];
    return !terminalStatuses.includes(order.status?.toLowerCase());
  };

  const handleCartDragStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    cartDragRef.current = true;
    cartDragOffsetRef.current = {
      x: event.clientX - cartButtonPos.x,
      y: event.clientY - cartButtonPos.y,
    };
  };

  const updateButtonPosition = (x: number, y: number) => {
    const maxX = window.innerWidth - 72;
    const maxY = window.innerHeight - 72;
    setCartButtonPos({
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    });
  };

  const handleCartDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!cartDragRef.current) return;
    const newX = event.clientX - cartDragOffsetRef.current.x;
    const newY = event.clientY - cartDragOffsetRef.current.y;
    updateButtonPosition(newX, newY);
  };

  const handleCartDragEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    cartDragRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleCartTouchStart = (event: React.TouchEvent<HTMLButtonElement>) => {
    cartDragRef.current = true;
    const touch = event.touches[0];
    cartDragOffsetRef.current = {
      x: touch.clientX - cartButtonPos.x,
      y: touch.clientY - cartButtonPos.y,
    };
  };

  const handleCartTouchMove = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (!cartDragRef.current) return;
    const touch = event.touches[0];
    updateButtonPosition(touch.clientX - cartDragOffsetRef.current.x, touch.clientY - cartDragOffsetRef.current.y);
  };

  const handleCartTouchEnd = () => {
    cartDragRef.current = false;
  };

  const sendToKitchen = async (forceNewOrder?: boolean) => {
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
        menu_item_id: i.id, // Assuming backend accepts menu_item_id
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        modifiers: i.modifiers,
      }));

      const existingOrder = activeOrder || lastSentOrder;
      const useExistingOrder = forceNewOrder === false
        ? true
        : forceNewOrder === true
          ? false
          : canAddToExistingOrder(existingOrder);

      const resolvedTableNumber = orderType === 'table'
        ? (selectedTable.trim() || tables.find((table) => table.number?.trim() && table.status?.toLowerCase() !== 'occupied')?.number || tables.find((table) => table.number?.trim())?.number || '')
        : '';

      if (useExistingOrder && existingOrder?.order_id) {
        endpoint = `/payments/pos/add-to-order/${existingOrder.order_id}/`;
        payload = {
          items: itemsPayload,
          waiter_name: finalWaiterName,
          waiter_id: getStaffId() || undefined,
        };
      } else {
        if (orderType === 'table' && !resolvedTableNumber) {
          throw new Error('Please select a table before sending to kitchen.');
        }
        endpoint = '/payments/pos/create-order/';
        payload = {
          table_number: orderType === 'table' ? resolvedTableNumber : 'Counter',
          items: itemsPayload,
          order_type: orderType,
          payment_method: 'unpaid',
          status: 'sent_kitchen',
          waiter_name: finalWaiterName,
          waiter_id: getStaffId() || undefined,
        };
      }

      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
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

        const mergedOrder = !order.items.length && existingOrder && existingOrder.order_id === order.order_id
          ? {
              ...existingOrder,
              ...order,
              items: [
                ...existingOrder.items,
                ...itemsPayload.map((item, idx) => ({
                  id: Date.now() + idx,
                  name: item.name,
                  price: item.price,
                  food_cost: 0,
                  quantity: item.quantity,
                  modifiers: item.modifiers || [],
                  seat_number: 1,
                  is_served: false,
                  subtotal: item.price * item.quantity,
                })),
              ],
            }
          : order;

        setCart([]);

        if (mergedOrder.status === 'sent_kitchen' || mergedOrder.status === 'preparing') {
          setActiveOrder(null);
          setLastSentOrder(mergedOrder);
          setReceiptData(mergedOrder);
        } else {
          setActiveOrder(mergedOrder);
          setLastSentOrder(null);
        }

        toast({ title: "KOT Printed", description: `Order ${mergedOrder.order_id?.substring(0, 6) || ''} ${useExistingOrder ? 'updated' : 'created'} and sent to Kitchen.` });
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({ title: "KOT Failed", description: errorData.error || errorData.message || "Failed to send order to kitchen.", variant: "destructive" });
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
  const summaryItems = cart.length > 0 ? cart : visibleOrderItems;
  const summaryTotal = summaryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const unsentItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const tableDisplay = orderType === 'takeaway' ? 'Counter' : selectedTable ? `Table ${selectedTable}` : 'Unassigned';
  const orderStatusLabel = visibleOrder?.status
    ? visibleOrder.status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'New Order';

  const existingOrder = activeOrder || lastSentOrder;
  const resolvedTableNumber = orderType === 'table'
    ? (selectedTable.trim() || tables.find((table) => table.number?.trim() && table.status?.toLowerCase() !== 'occupied')?.number || tables.find((table) => table.number?.trim())?.number || '')
    : '';
  const requiresTableSelection = orderType === 'table' && !resolvedTableNumber && !(existingOrder?.order_type === 'table' && existingOrder.table);
  const canSendToKitchen = cart.length > 0 && !requiresTableSelection;
  const hasPrintableContent = cart.length > 0 || visibleOrderItems.length > 0 || Boolean(activeOrder || lastSentOrder || receiptData);

  const handlePrintTicket = async () => {
    const orderToPrint = activeOrder || receiptData || {
      order_id: `PREVIEW-${Date.now()}`,
      table: orderType === 'table' ? resolvedTableNumber : 'Counter',
      table_details: null,
      phone: '',
      delivery_address: '',
      delivery_distance_km: null,
      delivery_time: '',
      delivery_cost: 0,
      status: 'draft',
      split_count: 0,
      total_amount: total,
      food_cost: 0,
      is_paid: false,
      is_billed: false,
      created_at: new Date().toISOString(),
      items: (cart.length > 0 ? cart : visibleOrderItems).map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        food_cost: 0,
        quantity: item.quantity,
        modifiers: item.modifiers || [],
        seat_number: 1,
        is_served: false,
        subtotal: item.price * item.quantity,
      })),
      payment_method: 'unpaid',
      order_type: orderType,
      waiter_name: finalWaiterName,
      waiter_id: getStaffId() || undefined,
      subtotal: total,
      discount: 0,
      tax: 0,
    } as PosOrderReceipt;

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

        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-18rem)] relative">
          <button
            onClick={() => setShowOrderDrawer(true)}
            onPointerDown={handleCartDragStart}
            onPointerMove={handleCartDragMove}
            onPointerUp={handleCartDragEnd}
            onPointerCancel={handleCartDragEnd}
            onTouchStart={handleCartTouchStart}
            onTouchMove={handleCartTouchMove}
            onTouchEnd={handleCartTouchEnd}
            onTouchCancel={handleCartTouchEnd}
            style={{ position: 'fixed', left: cartButtonPos.x, top: cartButtonPos.y, zIndex: 9999 }}
            className="hidden lg:block rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 p-4 text-white shadow-xl hover:shadow-2xl transition touch-none"
            aria-label="Open cart drawer"
          >
            <ShoppingCart size={24} />
          </button>

          <button
            onClick={() => setShowOrderDrawer(true)}
            onPointerDown={handleCartDragStart}
            onPointerMove={handleCartDragMove}
            onPointerUp={handleCartDragEnd}
            onPointerCancel={handleCartDragEnd}
            onTouchStart={handleCartTouchStart}
            onTouchMove={handleCartTouchMove}
            onTouchEnd={handleCartTouchEnd}
            onTouchCancel={handleCartTouchEnd}
            style={{ position: 'fixed', left: cartButtonPos.x, top: cartButtonPos.y, zIndex: 9999 }}
            className="block lg:hidden rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-500 p-4 text-white shadow-xl hover:shadow-2xl transition touch-none"
            aria-label="Open cart drawer"
          >
            <ShoppingCart size={24} />
          </button>

          <div className="flex-1 flex flex-col min-w-0 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl shadow-slate-950/20 overflow-hidden lg:ml-16">
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
                      <span className="text-lg font-extrabold text-orange-400">KES {item.price}</span>
                      <span className="rounded-full bg-[#0f1112] border border-orange-500/30 px-3 py-2 text-xs uppercase tracking-[0.22em] text-orange-300 font-bold shadow-sm">TAP TO ADD</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div 
            role="region"
            aria-label="Order Summary - Current cart items and checkout"
            aria-live="polite"
            className={`fixed inset-y-0 left-0 z-50 w-full max-w-md flex flex-col min-h-0 max-h-screen bg-slate-900 border-r border-slate-800 shadow-2xl transition-transform duration-300 overflow-y-auto ${
            showOrderDrawer ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="p-5 border-b border-slate-800 flex flex-col gap-4 lg:rounded-t-3xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-fuchsia-500 text-white shadow-lg shadow-orange-500/20">
                    <ShoppingCart size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Order Summary</p>
                    <h2 className="text-2xl font-semibold text-white" id="cart-heading">Ready to send</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowOrderDrawer(false)}
                  className="rounded-full border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:text-white transition"
                  aria-label="Close cart drawer"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(prev => !prev)}
                  aria-expanded={cartOpen}
                  className="rounded-full border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:text-white transition"
                >
                  {cartOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-slate-950 to-slate-900">
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setOrderType('table')}
                        className={`rounded-3xl border px-4 py-3 text-sm font-semibold transition ${orderType === 'table' ? 'border-orange-500 bg-orange-500/10 text-orange-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                      >
                        Table
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderType('takeaway')}
                        className={`rounded-3xl border px-4 py-3 text-sm font-semibold transition ${orderType === 'takeaway' ? 'border-orange-500 bg-orange-500/10 text-orange-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                      >
                        Takeaway
                      </button>
                    </div>

                    {orderType === 'table' && (
                      <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                        <label className="block text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Select table</label>
                        <select
                          value={selectedTable}
                          onChange={(e) => setSelectedTable(e.target.value)}
                          className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-orange-500"
                        >
                          <option value="">Choose a table</option>
                          {tables.map(table => (
                            <option key={table.id} value={table.number}>
                              {table.number}{table.status ? ` — ${table.status}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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

                    {cartOpen ? (
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4" role="region" aria-label="Order items">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-slate-800 pb-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                            <span>Item</span>
                            <span className="text-right">Qty</span>
                            <span className="text-right">Total</span>
                          </div>
                          <ul className="space-y-3 mt-3" role="list" aria-label="Cart items list">
                            {(cart.length > 0 ? cart : visibleOrderItems).map((item, idx) => (
                              <li
                                key={cart.length > 0 ? item.id : `${item.id}-${idx}`}
                                className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-3xl border border-slate-800 bg-slate-900/90 p-3 items-center"
                                role="listitem"
                                data-item-id={item.id}
                                data-item-name={item.name}
                                data-item-price={item.price}
                                data-item-qty={item.quantity}
                                aria-label={`${item.name}, quantity ${item.quantity}, KES ${(item.price * item.quantity).toFixed(2)}`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                                  <p className="text-xs text-slate-400">{item.modifiers?.length ? item.modifiers.join(', ') : 'No modifiers'}</p>
                                </div>
                                <div className="flex items-center justify-end gap-2 text-sm font-semibold text-white">
                                  {cart.length > 0 ? (
                                    <>
                                      <button onClick={() => updateCartQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`} className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-orange-500 transition"><Minus size={14} /></button>
                                      <span aria-live="polite">{item.quantity}</span>
                                      <button onClick={() => updateCartQuantity(item.id, 1)} aria-label={`Increase ${item.name} quantity`} className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-orange-500 transition"><Plus size={14} /></button>
                                    </>
                                  ) : (
                                    <span>{item.quantity}</span>
                                  )}
                                </div>
                                <div className="text-right text-sm font-semibold text-white">KES {(item.price * item.quantity).toFixed(2)}</div>
                              </li>
                            ))}
                          </ul>
                          {cart.length === 0 && visibleOrderItems.length === 0 && (
                            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-center text-slate-500">
                              Add items from the menu to begin a new order.
                            </div>
                          )}
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
                              disabled={loading || !canSendToKitchen}
                              onClick={() => sendToKitchen()}
                              className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-fuchsia-500 py-4 text-sm font-bold uppercase tracking-[0.15em] text-slate-950 shadow-xl shadow-orange-500/20 transition hover:shadow-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="inline-flex items-center justify-center gap-2">
                                <Send size={18} />
                                {loading ? 'Sending...' : 'Send to Kitchen'}
                              </span>
                            </button>
                            <button
                              disabled={loading || !hasPrintableContent}
                              onClick={handlePrintTicket}
                              className="w-full rounded-3xl border border-slate-800 bg-slate-900 py-4 text-sm font-bold uppercase tracking-[0.15em] text-white shadow-sm hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Printer size={18} /> Print Ticket
                            </button>
                          </div>
                        </div>
                      </div>
                  ) : (
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Order summary</p>
                              <p className="mt-2 text-2xl font-bold text-white">{cart.length > 0 ? 'Cart collapsed' : 'No items yet'}</p>
                              <p className="text-sm text-slate-400 mt-1">{cart.length > 0 ? `${cart.reduce((sum, item) => sum + item.quantity, 0)} items` : 'Add menu items to start an order.'}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCartOpen(true)}
                              className="rounded-3xl border border-orange-500 bg-orange-500/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-orange-200 hover:bg-orange-500/20 transition"
                            >
                              Expand
                            </button>
                          </div>
                          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Total</p>
                                <p className="mt-2 text-3xl font-bold text-white">KES {total.toFixed(2)}</p>
                              </div>
                              <span className="rounded-3xl bg-slate-800 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">{unsentItemCount} items</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
              </div>
            </div>
          </div>
        </div>
      </div>

    {/* Order Drawer Backdrop (Mobile) */}
    {showOrderDrawer && (
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        onClick={() => setShowOrderDrawer(false)}
      />
    )}

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