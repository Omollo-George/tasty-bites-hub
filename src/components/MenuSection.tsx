import { useState, useEffect } from "react";
import { Flame, BadgeCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type MenuItem = {
  name: string;
  price: number;
  category: string;
  popular: boolean;
  spicy?: boolean;
  description: string;
};

type CartItem = {
  name: string;
  price: number;
  quantity: number;
  modifiers: string[];
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
  const [orderType, setOrderType] = useState<"table" | "takeaway">("table");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash">("mpesa");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [processing, setProcessing] = useState(false);

  const { toast } = useToast();

  const filtered = active === "All" ? menuItems : menuItems.filter((item) => item.category === active);

  useEffect(() => {
    const load = async () => {
      try {
        const [configRes, menuRes] = await Promise.all([
          fetch("/api/payments/config/"),
          fetch("/api/payments/menu-items/"),
        ]);

        if (configRes.ok) {
          const d = await configRes.json();
          if (d?.conversion_rate) setRate(d.conversion_rate);
        }

        if (menuRes.ok) {
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

  const openAddItem = (itemName: string) => {
    setActiveItem(itemName);
    setActiveQuantity(1);
    setActiveModifiers("");
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
  const subtotal = sessionSubtotal + cartSubtotal;

  const handleCreateOrder = async () => {
    if (cart.length === 0 && sessionOrders.length === 0) {
      toast({ title: "Add items first", description: "Build a cart before creating an order." });
      return;
    }

    if (orderType === "table" && !tableNumber.trim()) {
      toast({ title: "Table number required", description: "Enter the table number for this order." });
      return;
    }

    if (paymentMethod === "mpesa" && !phoneNumber.trim()) {
      toast({ title: "Phone number required", description: "Enter your M-Pesa phone number to initiate payment." });
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    if (phoneNumber && !/^\d{9,12}$/.test(cleanedPhone)) {
      toast({ title: "Invalid phone number", description: "Enter a valid phone number (e.g., 2547XXXXXXXX)." });
      return;
    }

    setProcessing(true);

    const allItems = [...sessionOrders.flatMap(o => o), ...cart];

    try {
      const response = await fetch("/api/payments/pos/create-order/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: allItems.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            modifiers: item.modifiers,
            seat_number: 1,
          })),
          table_number: tableNumber.trim(),
          split_count: 1,
          phone: cleanedPhone,
          split_phones: [],
          order_type: orderType,
          payment_method: paymentMethod,
        }),
      });

      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `${response.status} ${response.statusText}`;
        const responsePreview = data ? JSON.stringify(data) : text.slice(0, 200);
        toast({ title: "Order failed", description: `${errorMessage} — ${responsePreview}` });
        return;
      }

      if (!data) {
        toast({ title: "Order failed", description: `Invalid backend response: ${text.slice(0, 200)}` });
        return;
      }

      setCart([]);
      setSessionOrders([]);
      setTableNumber("");
      setPhoneNumber("");

      toast({
        title: "Order created",
        description: data.payment_method === "mpesa" 
          ? `Order ${data.order_id} created. Check your phone for the M-Pesa prompt.`
          : `Order ${data.order_id} created and marked as paid via Cash.`,
      });

      // You can poll payment status using /api/payments/status/?checkout_id=...
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Order error", description: `Unable to reach backend: ${message}` });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section id="menu" className="py-24 bg-slate-950 text-slate-200">
      <div className="container mx-auto px-4">
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
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display text-2xl text-slate-100 group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    {item.spicy && <Flame className="w-4 h-4 text-primary" />}
                    {item.popular && <BadgeCheck className="w-4 h-4 text-secondary" />}
                  </div>
                </div>

                <p className="text-slate-400 text-sm mb-4">{item.description}</p>

                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl text-gradient">{formatCurrency(item.price * rate)}</span>

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
                          className="bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 px-4 py-2 rounded-full text-sm font-semibold hover:scale-105 transition-transform"
                        >
                          Add to Cart
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveItem(null)}
                          className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAddItem(item.name)}
                      className="bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <aside className="bg-slate-900 rounded-xl p-6 shadow-card border border-slate-800">
            <div className="mb-6">
              <p className="text-sm text-slate-400">Session Management</p>
              <h3 className="font-display text-2xl text-slate-100">Table Billing</h3>
            </div>

            {cart.length === 0 && sessionOrders.length === 0 ? (
              <p className="text-slate-400">Select items and build a multi-order session.</p>
            ) : (
              <div className="space-y-4">
                {sessionOrders.map((orderItems, oIdx) => (
                  <div key={oIdx} className="rounded-xl border-l-4 border-[#d69e2e] p-4 bg-slate-950/50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-bold text-[#d69e2e] uppercase tracking-tighter">Saved Group #{oIdx + 1}</p>
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
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Active Selection</p>
                    {cart.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-xl border border-slate-800 p-4 bg-slate-950">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-100">{item.name}</p>
                            <p className="text-sm text-slate-400">
                              {item.quantity} x {formatCurrency(item.price)}
                            </p>
                            {item.modifiers.length > 0 && (
                              <p className="text-xs text-slate-500 mt-1">Modifiers: {item.modifiers.join(", ")}</p>
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
                      className="w-full rounded-full border border-[#d69e2e] text-[#d69e2e] py-2 text-xs font-bold hover:bg-[#d69e2e] hover:text-white transition-all"
                    >
                      Add to Grouped Bill
                    </button>
                  </div>
                )}

                <div className="grid gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Order Type</label>
                    <div className="flex gap-2">
                      {(["table", "takeaway"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setOrderType(type)}
                          className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold border transition-all ${
                            orderType === type
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          {type === "table" ? "Dine In" : "Takeaway"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {orderType === "table" && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-300">Table Number</label>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(event) => setTableNumber(event.target.value)}
                        placeholder="e.g. 3"
                        className="w-full rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Payment Method</label>
                    <div className="flex gap-2">
                      {(["mpesa", "cash"] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold border transition-all ${
                            paymentMethod === method
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          {method === "mpesa" ? "M-Pesa" : "Cash"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="text-sm font-semibold text-slate-300">
                    {paymentMethod === "mpesa" ? "M-Pesa Phone" : "Phone (optional)"}
                    {paymentMethod === "mpesa" && <span className="text-destructive"> *</span>}
                  </label>
                  
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="2547XXXXXXXX"
                    className="w-full rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal * rate)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={processing}
                  className="w-full rounded-full bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 px-5 py-3 text-sm font-semibold transition-all hover:scale-105 disabled:cursor-wait disabled:opacity-70"
                >
                  {processing ? "Processing consolidated payment..." : "Pay All Orders Now"}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};

export default MenuSection;
