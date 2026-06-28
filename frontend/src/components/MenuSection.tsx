import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getStaffName, getStaffId } from "@/lib/staff-session";
import { Flame, BadgeCheck, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Receipt from "./Receipt";
import { getApiUrl } from "@/lib/api";
import { formatImageUrl } from '@/lib/image';
import { isValidMpesaPhone, normalizePhoneNumber } from '@/lib/utils';
import { getAuthHeaders } from '@/lib/auth';
import Restaurant3DBackground from "../../Restaurant3DBackground.jsx";


type MenuItem = {
  name: string;
  price: number;
  category: string;
  popular: boolean;
  spicy?: boolean;
  description: string;
  image_url?: string; // Added image_url for consistency
  sku?: string;
};

type CartItem = {
  name: string;
  price: number;
  quantity: number;
  modifiers: string[];
  menu_item_id?: number;
};

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { name: "Classic Smash Burger", price: 750, category: "Burgers", popular: true, spicy: false, description: "Double patty, cheddar, pickles, special sauce" },
  { name: "Spicy Chicken Burger", price: 780, category: "Burgers", popular: false, spicy: true, description: "Crispy chicken, jalapeños, sriracha mayo" },
  { name: "BBQ Bacon Burger", price: 860, category: "Burgers", popular: true, spicy: false, description: "Smoked bacon, BBQ glaze, onion rings" },
  { name: "Veggie Deluxe", price: 690, category: "Burgers", popular: false, spicy: false, description: "Plant-based patty, avocado, fresh greens" },
  { name: "Loaded Fries", price: 360, category: "Sides", popular: true, spicy: false, description: "Cheese sauce, bacon bits, green onions" },
  { name: "Onion Rings", price: 280, category: "Sides", popular: false, spicy: false, description: "Beer-battered, crispy golden perfection" },
  { name: "Chicken Wings (8pc)", price: 720, category: "Sides", popular: true, spicy: false, description: "Choice of buffalo, BBQ, or garlic parmesan" },
  { name: "Coleslaw", price: 210, category: "Sides", popular: false, spicy: false, description: "Creamy homestyle coleslaw" },
  { name: "Classic Milkshake", price: 420, category: "Drinks", popular: true, spicy: false, description: "Vanilla, chocolate, or strawberry" },
  { name: "Fresh Lemonade", price: 290, category: "Drinks", popular: false, spicy: false, description: "Freshly squeezed with a hint of mint" },
  { name: "Iced Tea", price: 220, category: "Drinks", popular: false, spicy: false, description: "Brewed daily, sweetened or unsweetened" },
  { name: "Brownie Sundae", price: 460, category: "Desserts", popular: true, spicy: false, description: "Warm brownie, vanilla ice cream, hot fudge" },
  { name: "Apple Pie Bites", price: 330, category: "Desserts", popular: false, spicy: false, description: "Cinnamon sugar dusted, served warm" },
];

const categories = ["All", "Burgers", "Sides", "Drinks", "Desserts"];

const COMMON_MODIFIERS = ["No Onion", "Extra Cheese", "Extra Sauce", "Large", "Well Done", "No Sugar", "Extra Ice"];

const formatCurrency = (value: number) => {
  const currency = import.meta.env.VITE_CURRENCY_CODE || "KES";
  const locale = currency === "KES" ? "en-KE" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
};

const MenuSection = () => {
  const [active, setActive] = useState("All");
  const [rate, setRate] = useState<number>(1);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [sessionOrders, setSessionOrders] = useState<CartItem[][]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [activeQuantity, setActiveQuantity] = useState<number>(1);
  const [activeModifiers, setActiveModifiers] = useState<string>("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState<"table" | "takeaway" | "delivery">("table");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash">("mpesa");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isQrFlow, setIsQrFlow] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [processing, setProcessing] = useState(false);
  const [awaitingMpesaConfirm, setAwaitingMpesaConfirm] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  const { toast } = useToast();

  const filtered = active === "All" ? menuItems : menuItems.filter((item) => item.category === active);

  useEffect(() => {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const source = searchParams?.get('source');
    if (source === 'qr') {
      setIsQrFlow(true);
      setPaymentMethod('mpesa');
    }

    const load = async () => {
      try {
        const [configRes, menuRes] = await Promise.all([
          fetch(getApiUrl("/payments/config/")),
          fetch(getApiUrl("/payments/menu-items/")),
        ]);

        if (configRes.ok) {
          if (!configRes.headers.get("content-type")?.includes("application/json")) return;
          const d = await configRes.json();
          if (d?.conversion_rate) setRate(d.conversion_rate);
        } else {
          setRate(1);
        }

        if (menuRes.ok) {
          if (!menuRes.headers.get("content-type")?.includes("application/json")) return;
          const md = await menuRes.json();
          const fetchedItems = Array.isArray(md?.menu_items) ? md.menu_items : [];
          if (fetchedItems.length > 0) {
            setMenuItems(fetchedItems);
          }
        }
      } catch {
        // dev/no-op
      }
    };

    load();
  }, []);

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

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

    setProcessing(false);
    setCurrentOrderId(null);
    setAwaitingMpesaConfirm(false);
    
    toast({
      title: "Transaction Cancelled",
      description: "The payment process has been stopped and the order discarded.",
      variant: "destructive",
    });
  };

  const openAddItem = (itemName: string) => {
    setActiveItem(itemName);
    setActiveQuantity(1);
    setActiveModifiers("");
  };

  const resetForm = () => {
    setCart([]);
    setSessionOrders([]);
    setTableNumber("");
    setDeliveryAddress("");
    setPhoneNumber("");
    setCurrentOrderId(null);
  };

  const addItemToCart = (itemName: string) => {
    const menuItem = menuItems.find((item) => item.name === itemName);
    if (!menuItem) {
      toast({ title: "Item not found", description: "Could not add this item to the cart." });
      return;
    }

    setCart((current) => [
      ...current,
      {
        name: menuItem.name,
        price: menuItem.price,
        menu_item_id: (menuItem as any).id,
        quantity: Math.max(1, activeQuantity),
        modifiers: activeModifiers
          .split(",")
          .map((modifier) => modifier.trim())
          .filter(Boolean),
      },
    ]);

    setActiveItem(null);
    setActiveModifiers("");
    setActiveQuantity(1);
  };

  const toggleModifier = (mod: string) => {
    const currentMods = activeModifiers.split(",").map(m => m.trim()).filter(Boolean);
    if (currentMods.includes(mod)) {
      setActiveModifiers(currentMods.filter(m => m !== mod).join(", "));
    } else {
      const updated = [...currentMods, mod];
      setActiveModifiers(updated.join(", "));
    }
  };

  const removeCartItem = (index: number) => {
    setCart((current) => current.filter((_, idx) => idx !== index));
  };

  const removeSessionOrder = (index: number) => {
    setSessionOrders((current) => current.filter((_, idx) => idx !== index));
  };

  const addCartToSession = () => {
    if (cart.length === 0) return;
    setSessionOrders([...sessionOrders, cart]);
    setCart([]);
    toast({ title: "Order Group Saved", description: "The current items have been added to the consolidated bill." });
  };

  const sessionSubtotal = sessionOrders.reduce((sum, order) => 
    sum + order.reduce((s, i) => s + (i.price * i.quantity), 0), 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const foodSubtotal = sessionSubtotal + cartSubtotal;

  const totalBeforePayment = foodSubtotal * rate;

  const handleCreateOrder = async () => {
    if (cart.length === 0 && sessionOrders.length === 0) {
      toast({ title: "Add items first", description: "Build a cart before creating an order." });
      return;
    }

    if (orderType === "table" && !tableNumber.trim()) {
      toast({ title: "Table number required", description: "Enter the table number for this order." });
      return;
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast({ title: "Delivery address required", description: "Enter the address for this order." });
      return;
    }

    if (paymentMethod === "mpesa" && !phoneNumber.trim()) {
      toast({ title: "Phone number required", description: "Enter your M-Pesa phone number to initiate payment." });
      return;
    }

    const cleanedPhone = normalizePhoneNumber(phoneNumber);
    if (paymentMethod === "mpesa" && !isValidMpesaPhone(phoneNumber)) {
      toast({ title: "Invalid phone number", description: "Enter a Kenyan M-Pesa number like +254712345678, 0712345678, or 712345678." });
      return;
    }

    setLastOrder(null);

    setProcessing(true);

    const allItems = [...sessionOrders.flatMap(o => o), ...cart];

    try {
      const response = await fetch(getApiUrl("/payments/pos/create-order/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
            items: allItems.map((item) => ({
              menu_item_id: (item as any).menu_item_id || (item as any).id || undefined,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              modifiers: item.modifiers,
              seat_number: 1,
            })),
          table_number: orderType === "table" ? tableNumber.trim() : "",
          delivery_address: orderType === "delivery" ? deliveryAddress.trim() : "",
          split_count: 1,
          phone: cleanedPhone,
          split_phones: [],
          order_type: orderType,
          payment_method: paymentMethod,
          waiter_name: getStaffName() || undefined,
          waiter_id: getStaffId() || undefined,
        }),
      });

      if (!response.headers.get("content-type")?.includes("application/json")) {
        toast({ title: "Server Error", description: "Invalid response from server during order creation.", variant: "destructive" });
        return;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || "Internal Server Error";
        toast({ title: "Order failed", description: errorMessage });
        return;
      }

      setCurrentOrderId(data.order_id);
      const receiptData = {
        ...data,
        items: allItems,
        total_amount: data.total_amount || totalBeforePayment,
        cashier_notified: true,
      };

      if (paymentMethod === "mpesa") {
        if (!data.stk_response?.CheckoutRequestID) {
          toast({ title: "System Busy", description: "The payment gateway is currently handling high traffic. Please try again.", variant: "destructive" });
          setProcessing(false);
          setCurrentOrderId(null);
          fetch(getApiUrl(`/payments/orders/${encodeURIComponent(data.order_id)}/discard/`), { method: 'DELETE' }).catch(() => {});
          return;
        }

        const checkoutId = data.stk_response.CheckoutRequestID;
        setProcessing(false);
        setAwaitingMpesaConfirm(true);

        let transactionSettled = false;

        toast({
          title: "Awaiting Confirmation",
          description: "Please complete the M-Pesa prompt on your phone to generate your receipt.",
        });

        const checkPaymentStatus = async () => {
          if (transactionSettled || !pollTimerRef.current) return;

          try {
            const statusRes = await fetch(getApiUrl(`/payments/status/?checkout_id=${checkoutId}`));
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === "success") {
                transactionSettled = true;
                if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
                
                if (safetyTimeoutRef.current) {
                  window.clearTimeout(safetyTimeoutRef.current);
                  safetyTimeoutRef.current = null;
                }
                
                setProcessing(false);
                setAwaitingMpesaConfirm(false);
                setCurrentOrderId(null);
                setLastOrder(receiptData);
                toast({ title: "Payment Confirmed", description: "Receipt generated successfully." });
                resetForm();
                return;
              }

              if (statusData.status === "failed" || statusData.status === "error") {
                transactionSettled = true;
                if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;

                if (safetyTimeoutRef.current) {
                  window.clearTimeout(safetyTimeoutRef.current);
                  safetyTimeoutRef.current = null;
                }

                setProcessing(false);
                setAwaitingMpesaConfirm(false);
                setCurrentOrderId(null);
                toast({
                  title: "Payment Failed",
                  description: `Transaction for order ${data.order_id} was unsuccessful. The order has been discarded.`,
                  variant: "destructive",
                });

                return;
              }
            }
          } catch (e) {
            // ignore transient polling errors and retry quickly
          }

          if (!transactionSettled && pollTimerRef.current) {
            pollTimerRef.current = window.setTimeout(checkPaymentStatus, 500);
          }
        };

        // Start polling quickly to catch the callback as soon as it arrives.
        pollTimerRef.current = window.setTimeout(checkPaymentStatus, 200);

        // 1-minute safety timeout to stop polling and discard uncompleted transaction
        safetyTimeoutRef.current = window.setTimeout(() => {
          if (!transactionSettled) {
            if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
            safetyTimeoutRef.current = null;
            setProcessing(false);
            setAwaitingMpesaConfirm(false);
            setCurrentOrderId(null);
            toast({
              title: "Payment Timeout",
              description: "The payment window has expired. The order has been cancelled.",
              variant: "destructive",
            });
          }
        }, 60000); // 60 seconds is typical for STK Push expiry

      } else {
        // Cash payment - generate immediately as it is considered settled
        setAwaitingMpesaConfirm(false);
        setLastOrder({
          ...receiptData,
          cashier_notified: true,
        });
        toast({
          title: "Order created",
          description: `Order ${data.order_id} created and marked as paid via Cash.`,
        });
        resetForm();
        setCurrentOrderId(null);
        setProcessing(false);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Order error", description: `Unable to reach backend: ${message}` });
      setProcessing(false);
      setAwaitingMpesaConfirm(false);
    } finally {
      // Processing state is now handled manually in all logic paths above
    }
  };

  return (
    <section id="menu" className="py-24 bg-gradient-to-br from-gray-900 to-slate-800 text-slate-200 relative overflow-hidden scroll-mt-20">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Restaurant3DBackground />
      </div>
      {lastOrder && (
        <Receipt order={lastOrder} onClose={() => setLastOrder(null)} />
      )}
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Our Menu</p>
          <h2 className="font-display text-5xl md:text-6xl text-slate-100">TABLE-BASED POS</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                active === cat
                  ? "bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 shadow-lg"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((item) => (
              <div
                key={item.name}
                className="bg-slate-900 rounded-xl p-6 shadow-card hover:shadow-[#d69e2e]/10 transition-shadow border border-slate-800 group"
              >
                <div className="flex flex-col gap-3 mb-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl text-slate-100 group-hover:text-primary transition-colors break-words">
                      {item.name}
                    </h3>
                    {item.sku && <span className="block text-xs text-slate-500 mt-1">{`SKU: ${item.sku}`}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.spicy && <Flame className="w-4 h-4 text-primary" />}
                    {item.popular && <BadgeCheck className="w-4 h-4 text-secondary" />}
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-4">{item.description}</p>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 items-center gap-4 min-w-0">
                    {item.image_url && <img src={formatImageUrl(item.image_url)} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />}
                    <span className="font-display text-3xl text-gradient break-words">{formatCurrency(item.price * rate)}</span>
                  </div>

                  {activeItem === item.name ? (
                    <div className="flex flex-col gap-3 w-full max-w-sm">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={activeQuantity}
                            onChange={(event) => setActiveQuantity(Number(event.target.value) || 1)}
                            className="w-20 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_MODIFIERS.map((mod) => {
                            const isSelected = activeModifiers.split(",").map(m => m.trim()).filter(Boolean).includes(mod);
                            return (
                              <button
                                key={mod}
                                type="button"
                                onClick={() => toggleModifier(mod)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                  isSelected
                                    ? "bg-[#d69e2e] text-[#1a365d] border-[#d69e2e] shadow-md shadow-[#d69e2e]/20"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                                }`}
                              >
                                {mod}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addItemToCart(item.name)}
                          className="bg-[#0A1A2F] text-[#C9A961] border border-[#C9A961]/30 px-4 py-2 rounded-full text-sm font-semibold hover:scale-105 transition-transform"
                        >
                          Add to Cart
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveItem(null)}
                          className="rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm font-semibold text-[#E5E7EB] hover:bg-[#0A1A2F] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAddItem(item.name)}
                      className="bg-[#0A1A2F] text-[#C9A961] border border-[#C9A961]/30 px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <aside className="bg-[#1F2937] rounded-xl p-6 shadow-card border border-[#1F2937]">
            <div className="mb-6">
              <p className="text-sm text-[#E5E7EB]">Session Management</p>
              <h3 className="font-display text-2xl text-[#E5E7EB]">Table Billing</h3>
            </div>
            {cart.length === 0 && sessionOrders.length === 0 ? (
              <p className="text-[#E5E7EB]">Select items and build a multi-order session.</p>
            ) : (
              <div className="space-y-4">
                {sessionOrders.map((orderItems, oIdx) => (
                  <div key={oIdx} className="rounded-xl border-l-4 border-[#C9A961] p-4 bg-[#0A1A2F]/50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-bold text-[#C9A961] uppercase tracking-tighter">Saved Group #{oIdx + 1}</p>
                      <button onClick={() => removeSessionOrder(oIdx)} className="text-[10px] text-destructive hover:underline">Discard Group</button>
                    </div>
                    {orderItems.map((item, iIdx) => (
                      <div key={iIdx} className="flex justify-between text-xs text-slate-300">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {cart.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-[#E5E7EB] uppercase">Active Selection</p>
                    {cart.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-xl border border-[#1F2937] p-4 bg-[#0A1A2F]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#E5E7EB]">{item.name}</p>
                            <p className="text-sm text-[#E5E7EB]">
                              {item.quantity} x {formatCurrency(item.price)}
                            </p>
                            {item.modifiers.length > 0 && (
                              <p className="text-xs text-[#E5E7EB] mt-1">Modifiers: {item.modifiers.join(", ")}</p>
                            )}
                          </div>
                          <button type="button" onClick={() => removeCartItem(index)} className="text-sm text-destructive">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCartToSession}
                      className="w-full rounded-full border border-[#C9A961] text-[#C9A961] py-2 text-xs font-bold hover:bg-[#C9A961] hover:text-[#0A1A2F] transition-all"
                    >
                      Add to Grouped Bill
                    </button>
                  </div>
                )}
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#E5E7EB]">Order Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {(["table", "takeaway", "delivery"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setOrderType(type)}
                          className={`flex-1 min-w-[80px] rounded-full px-4 py-2 text-xs font-semibold border transition-all ${
                            orderType === type ? "bg-[#C9A961] text-[#0A1A2F] border-[#C9A961]" : "bg-[#1F2937] text-[#E5E7EB] border-[#1F2937] hover:bg-[#0A1A2F]"
                          }`}
                        >
                          {type === "table" ? "Dine In" : type === "takeaway" ? "Takeaway" : "Delivery"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {orderType === "table" && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-[#E5E7EB]">Table Number</label>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(event) => setTableNumber(event.target.value)}
                        placeholder="e.g. 3"
                        className="w-full rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm text-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#C9A961]"
                      />
                    </div>
                  )}
                  {orderType === "delivery" && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-[#E5E7EB]">Delivery Address <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        placeholder="e.g. Near university gate, yellow house..."
                        className="w-full rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm text-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#C9A961]"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#E5E7EB]">Payment Method</label>
                    <div className="flex gap-2">
                      {(isQrFlow ? (["mpesa"] as const) : (["mpesa", "cash"] as const)).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold border transition-all ${
                            paymentMethod === method ? "bg-[#C9A961] text-[#0A1A2F] border-[#C9A961]" : "bg-[#1F2937] text-[#E5E7EB] border-[#1F2937] hover:bg-[#0A1A2F]"
                          }`}
                        >
                          {method === "mpesa" ? "M-Pesa" : "Cash"}
                        </button>
                      ))}
                    </div>
                    {isQrFlow && (
                      <p className="text-xs text-amber-300">QR orders must be paid via M-Pesa only.</p>
                    )}
                  </div>
                  <label className="text-sm font-semibold text-[#E5E7EB]">
                    {paymentMethod === "mpesa" ? "M-Pesa Phone" : "Phone (optional)"}
                    {paymentMethod === "mpesa" && <span className="text-destructive"> *</span>}
                  </label>
                  
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +254712345678 or 0712345678"
                    className="w-full rounded-full border border-[#1F2937] bg-[#1F2937] px-4 py-2 text-sm text-[#E5E7EB] outline-none focus:ring-2 focus:ring-[#C9A961]"
                  />
                </div>
                <div className="space-y-2 pt-4 border-t border-[#1F2937]">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Order Review</p>
                  <div className="flex items-center justify-between text-sm text-[#E5E7EB]">
                    <span>Food Total</span>
                    <span>{formatCurrency(foodSubtotal * rate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold text-[#E5E7EB] pt-2 border-t border-[#1F2937]">
                    <span>Total</span>
                      <span className="text-[#C9A961]">
                      {formatCurrency(totalBeforePayment)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await handleCreateOrder();
                  }}
                    disabled={processing || awaitingMpesaConfirm}
                  className="w-full rounded-full bg-[#0A1A2F] text-[#C9A961] border border-[#C9A961]/30 px-5 py-3 text-sm font-semibold transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {processing ? "Initiating payment..." : awaitingMpesaConfirm ? 'Awaiting M-Pesa confirmation...' : `Pay ${formatCurrency(totalBeforePayment)}`}
                </button>
                {processing && paymentMethod === "mpesa" && (
                  <button
                    type="button"
                    onClick={handleCancelTransaction}
                    className="w-full mt-2 rounded-full border border-red-500/50 text-red-500 py-2 text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                  >
                    Cancel Transaction
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};
export default MenuSection