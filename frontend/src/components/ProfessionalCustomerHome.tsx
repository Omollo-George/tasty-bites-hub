import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Flame, ShoppingCart, Star, ChevronRight, Search, MapPin, MessageSquareText } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import CartModal from './CartModal'; // Import the new CartModal component
import { formatCurrency } from './utils'; 
import Receipt from './Receipt'; // Reusing the Receipt component
import ReviewFormModal from './ReviewFormModal'; // Import the new ReviewFormModal component
import heroImage from "@/assets/hero-food.jpg";
import About from './About';
import Contact from './Contact';
import Footer from './Footer';

interface RawMenuItem { // Fixed: Renamed from MenuItem to RawMenuItem
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  popular: boolean;
  spicy: boolean;
  is_available: boolean;
}
interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  is_available: boolean;
  modifiers?: string[]; // Add modifiers for consistency with MenuSection
}

interface OrderReceipt {
  order_id: string;
  items: CartItem[];
  total_amount: number;
  payment_method: string;
  order_type: string;
  table_number: string; // Added to satisfy Receipt props
  delivery_address?: string;
  phone?: string;
}

interface Review {
  id: number;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}
interface HomeData {
  hero: { title: string; tagline: string; image_url: string };
  categories: string[];
  featured: RawMenuItem[];
  menu_by_category: Record<string, RawMenuItem[]>;
  config: { currency: string; delivery_min: number };
}

const ProfessionalCustomerHome = () => {
  const [data, setData] = useState<HomeData | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]); // Cart state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCartModal, setShowCartModal] = useState(false); // State to control cart modal visibility
  const [lastOrder, setLastOrder] = useState<OrderReceipt | null>(null); // State to show receipt after checkout
  const [processing, setProcessing] = useState(false);
  const [awaitingMpesaConfirm, setAwaitingMpesaConfirm] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null); // To track order for cancellation
  const [points, setPoints] = useState<number>(() => parseInt(localStorage.getItem('loyaltyPoints') || '0'));
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const formatImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  };

  const pollTimerRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    
    const fetchData = async () => {
      try {
        const [homeRes, reviewsRes] = await Promise.all([
          fetch(getApiUrl('/payments/customer/home/')),
          fetch(getApiUrl('/payments/reviews/')),
        ]);

        if (!homeRes.ok) {
          throw new Error(`HTTP error! status: ${homeRes.status} from home data`);
        }
        const homeJson = await homeRes.json();
        setData(homeJson);

        if (!reviewsRes.ok) {
          throw new Error(`HTTP error! status: ${reviewsRes.status} from reviews data`);
        }
        const reviewsJson = await reviewsRes.json();
        setReviews(reviewsJson.reviews || []);

      } catch (err: any) {
        setError(err.message || "Failed to fetch data. Check backend connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // Lock scroll on both body and html to ensure background is strictly static
  useEffect(() => {
    if (showCartModal || lastOrder || showReviewModal) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [showCartModal, lastOrder]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const clearTimers = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    pollTimerRef.current = null;
    safetyTimeoutRef.current = null;
  };

  const scrollToCategory = (category: string) => {
    const element = document.getElementById(`category-${category}`);
    if (element) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleRewardsClick = () => {
    toast.info("Your Loyalty Status", {
      description: `You currently have ${points} points. Earn 10 points on orders above ${formatCurrency(1000, data?.config.currency || 'KES')}. Redeem 100 points for a free drink!`,
      icon: <Star className="text-orange-500" size={16} />
    });
  };

  const handleAddToCart = (item: RawMenuItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      let newQuantity = 1;
      let newCart;

      if (existingItem) {
        newCart = prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
        newQuantity = existingItem.quantity + 1;
      } else {
        newCart = [
          ...prevCart,
          {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            image_url: item.image_url,
            is_available: item.is_available,
          },
        ];
      }
      toast.success(`${item.name} added to cart!`, {
        description: `You now have ${newQuantity} of this item.`,
        action: {
          label: "View Cart",
          onClick: () => setShowCartModal(true)
        },
      });
      return newCart;
    });
  };

  const handleUpdateQuantity = (itemId: number, newQuantity: number) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === itemId);
      if (!existingItem) return prevCart;

      if (newQuantity <= 0) {
        return prevCart.filter(cartItem => cartItem.id !== itemId);
      }

      return prevCart.map(cartItem =>
        cartItem.id === itemId
          ? { ...cartItem, quantity: newQuantity }
          : cartItem
      );
    });
  };

  const handleRemoveItem = (itemId: number) => {
    setCart(prevCart => prevCart.filter(cartItem => cartItem.id !== itemId));
    toast.info("Item removed from cart.");
  };

  const cartTotalItems = useMemo(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);
  const cartTotalPrice = useMemo(() => cart.reduce((total, item) => total + (item.price * item.quantity), 0), [cart]);

  const handleRedeemPoints = () => {
    if (points < 100) {
      toast.error("Insufficient Points", { description: "You need at least 100 points to redeem a free drink." });
      return;
    }
    
    const newPoints = points - 100;
    setPoints(newPoints);
    localStorage.setItem('loyaltyPoints', newPoints.toString());
    
    toast.success("Points Redeemed!", { 
      description: "100 points deducted. A free drink credit has been applied to your profile/order.",
      icon: <Star className="text-orange-500" size={16} />
    });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty!", { description: "Add some delicious items before checking out." });
      return;
    }

    if (!phoneNumber.trim()) {
      toast.error("Phone number required", { description: "Enter your M-Pesa number to pay." });
      return;
    }

    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      toast.error("Address required", { description: "Please provide a delivery address." });
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    if (!/^\d{9,12}$/.test(cleanedPhone)) {
      toast.error("Invalid phone number", { description: "Please enter a valid M-Pesa number." });
      return;
    }

    setProcessing(true);
    setCurrentOrderId(null); // Reset current order ID for a new transaction

    try {
      const response = await fetch(getApiUrl("/payments/pos/create-order/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            modifiers: item.modifiers || [],
          })),
          phone: cleanedPhone,
          order_type: orderType,
          delivery_address: orderType === 'delivery' ? deliveryAddress.trim() : "",
          payment_method: "mpesa",
        }),
      });

      const dataRes = await response.json();

      if (!response.ok) {
        setProcessing(false); // Ensure processing is reset on error
        throw new Error(dataRes.message || dataRes.error || "Failed to initiate payment");
      }

      const checkoutId = dataRes.stk_response?.CheckoutRequestID;
      if (!checkoutId) {
        throw new Error("M-Pesa STK Push could not be initiated. Try again.");
      }

      setCurrentOrderId(dataRes.order_id); // Store the order ID
      setProcessing(false);
      setAwaitingMpesaConfirm(true);
      toast.info("M-Pesa Push Sent", { description: "Check your phone for the M-Pesa prompt." });

      let transactionSettled = false;

      const checkPaymentStatus = async () => {
        if (transactionSettled) return;

        try {
          const statusRes = await fetch(getApiUrl(`/payments/status/?checkout_id=${checkoutId}`));
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "success") {
              transactionSettled = true;
              clearTimers();

              // Loyalty logic: Orders > 1000 gain 10 points
              if (cartTotalPrice > 1000) {
                const newPoints = points + 10;
                setPoints(newPoints);
                localStorage.setItem('loyaltyPoints', newPoints.toString());
              }

              const trackingId = Math.floor(10000 + Math.random() * 90000).toString();
              
              const orderDetails: OrderReceipt = {
                order_id: trackingId,
                items: cart,
                total_amount: cartTotalPrice,
                payment_method: "mpesa",
                order_type: "takeaway", // Added to satisfy OrderReceipt interface
                table_number: "",
                delivery_address: orderType === 'delivery' ? deliveryAddress : undefined,
              };

              setLastOrder(orderDetails);
              setShowCartModal(false);
              setCart([]);
              setPhoneNumber('');
              setCurrentOrderId(null); // Clear order ID after successful payment
              setAwaitingMpesaConfirm(false);
              toast.success("Payment Received!", { 
                description: `Order #${trackingId} is now being prepared. Save this ID for tracking.`,
                action: {
                  label: "Track Order",
                  onClick: () => navigate(`/track/${trackingId}`)
                }
              });
            } else if (statusData.status === "failed") {
              transactionSettled = true;
              clearTimers();
              setAwaitingMpesaConfirm(false);
              toast.error("Payment Failed", { description: "The M-Pesa transaction was cancelled or failed." });
              // Optionally discard order on backend if payment failed
            }
          }
        } catch (e) { /* silent polling fail */ }

        if (!transactionSettled) {
          pollTimerRef.current = setTimeout(checkPaymentStatus, 2000);
        }
      };

      pollTimerRef.current = setTimeout(checkPaymentStatus, 2000);

      safetyTimeoutRef.current = setTimeout(() => {
        if (!transactionSettled) {
          transactionSettled = true;
          clearTimers();
          setAwaitingMpesaConfirm(false);
          toast.error("Payment Timeout", { description: "We didn't receive your payment in time. Please try again." });
        }
      }, 60000);

    } catch (err: any) {
      toast.error("Order Failed", { description: err.message });
      setProcessing(false);
      setAwaitingMpesaConfirm(false);
    }
  };

  const handleCancelMpesaTransaction = async () => {
    clearTimers(); // Stop polling

    // If an order was created on the backend, attempt to discard it
    if (currentOrderId) {
      try {
        await fetch(getApiUrl(`/payments/orders/${encodeURIComponent(currentOrderId)}/discard/`), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
        toast.info("Order Discarded", { description: `Order ${currentOrderId} has been cancelled.` });
      } catch (error) {
        console.error("Failed to discard order on backend:", error);
        toast.error("Cancellation Error", { description: "Could not discard order on server, please contact support." });
      }
    }

    setProcessing(false);
    setAwaitingMpesaConfirm(false);
    setCurrentOrderId(null);
    toast.info("Payment Cancelled", { description: "The M-Pesa payment process has been stopped." });
    // Optionally, you might want to clear the phone number or cart here,
    // but for now, we'll leave the cart as is so the user can try again.
    // setCart([]);
    // setPhoneNumber('');
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">Loading Experience...</div>;
  if (error) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500 text-lg p-4 text-center">Error: {error}</div>;
  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-lg">No menu data received. Check backend.</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-orange-500/30">
      {/* Global Page Background Image */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img src={heroImage} alt="" className="w-full h-full object-cover opacity-[0.03] scale-110 blur-[2px]" />
      </div>

      {/* Cart Modal */}
      {showCartModal && (
        <CartModal
          cart={cart}
          currency={data.config.currency}
          onClose={() => setShowCartModal(false)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
          cartTotalPrice={cartTotalPrice}
          cartTotalItems={cartTotalItems}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
          isProcessing={processing}
          isAwaitingMpesa={awaitingMpesaConfirm}
          onCancelMpesaPayment={handleCancelMpesaTransaction} // Pass the new handler
          points={points}
          onRedeemPoints={handleRedeemPoints}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          deliveryAddress={deliveryAddress}
          onDeliveryAddressChange={setDeliveryAddress}
        />
      )}

      {/* Receipt Modal */}
      {lastOrder && ( // Changed from lastOrder to lastOrder
        <Receipt order={lastOrder} onClose={() => setLastOrder(null)} />
      )}

      {/* Review Form Modal */}
      {showReviewModal && (
        <ReviewFormModal 
          onClose={() => setShowReviewModal(false)} 
          onSubmitSuccess={() => { /* You can add logic to refresh reviews here */ }} 
        />
      )}

      {/* Glassmorphic Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'py-4 bg-black/60 backdrop-blur-xl border-b border-white/10' : 'py-6 bg-transparent'} ${showCartModal || lastOrder ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <h2 
            onClick={scrollToTop}
            className="text-2xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent italic cursor-pointer transition-opacity hover:opacity-80"
          >
            TASTY BITES<span className="text-orange-500 text-sm not-italic ml-1">PRO</span>
          </h2>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <button 
              onClick={() => data && scrollToCategory(data.categories[0])}
              className="hover:text-white transition-colors"
            >
              Menu
            </button>
            <button onClick={handleRewardsClick} className="hover:text-white transition-colors">Rewards</button>
            <a href="#about" className="hover:text-white transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
            <Link to="/track" className="hover:text-white transition-colors">My Orders</Link>
          </div>
          <button onClick={() => setShowReviewModal(true)} className="p-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-orange-500 transition-all group relative"><MessageSquareText size={20} className="group-hover:scale-110 transition-transform" /></button>
          <button onClick={() => setShowCartModal(true)} className="p-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-orange-500 transition-all group relative">
            <ShoppingCart size={20} className="group-hover:scale-110 transition-transform" />
            {cartTotalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section with Parallax Depth */}
      <header id="home" className={`relative h-[85vh] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        showCartModal || lastOrder ? 'opacity-20 pointer-events-none' : 'opacity-100'
      }`}>
        <img src={heroImage || data.hero.image_url} className="absolute inset-0 w-full h-full object-cover scale-105" alt="Hero" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#0a0a0b]" />
        
        <div className="relative z-10 text-center px-4 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/30 backdrop-blur-md text-orange-400 text-xs font-bold uppercase tracking-widest mb-6 animate-fade-in">
            <MapPin size={14} /> Now Delivering to your Location
          </div>
          <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter leading-none">
            {data.hero.title}
          </h1>
          <p className="text-lg md:text-2xl text-gray-300 font-light mb-10 max-w-2xl mx-auto leading-relaxed">
            {data.hero.tagline}
          </p>
          
          {/* Glassmorphic CTA */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search the menu..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/10 backdrop-blur-xl rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <button onClick={() => scrollToCategory(data.categories[0])} className="w-full md:w-auto px-8 py-4 bg-orange-600 hover:bg-orange-500 rounded-2xl font-bold shadow-lg shadow-orange-600/20 transition-all hover:-translate-y-1"> {/* This button now scrolls to the first category */}
              Find Food
            </button>
          </div>
        </div>
      </header>

      <main id="menu" className={`scroll-mt-32 max-w-7xl mx-auto px-6 -mt-20 relative z-20 transition-opacity duration-500 ${
        showCartModal || lastOrder ? 'opacity-20 pointer-events-none' : 'opacity-100'
      }`}>
        {/* Category Navigation */}
        <div className="flex gap-4 overflow-x-auto pb-12 no-scrollbar">
          {data.categories.map((cat, idx) => (
            <button 
              key={cat} 
              onClick={() => scrollToCategory(cat)}
              className={`whitespace-nowrap px-8 py-4 rounded-2xl border transition-all duration-300 font-bold ${idx === 0 ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Featured Section */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-black flex items-center gap-3 tracking-tight">
              <Flame className="text-orange-500 fill-orange-500" /> Trending Now
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {data.featured.map(item => ( // Pass onAdd to ProItemCard
              <ProItemCard key={item.id} item={item} currency={data.config.currency} onAdd={() => handleAddToCart(item)} formatImageUrl={formatImageUrl} />
            ))}
          </div>
        </section>

        {/* Category Grids */}
        {Object.entries(data.menu_by_category).map(([category, items]) => (
          <section key={category} className="mb-20">
            <div id={`category-${category}`} className="flex items-center gap-4 mb-10">
              <h4 className="text-4xl font-black tracking-tight italic uppercase">{category}</h4>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {items.filter(i => 
                i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.category.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(item => (
                <ProItemCard key={item.id} item={item} currency={data.config.currency} compact onAdd={() => handleAddToCart(item)} formatImageUrl={formatImageUrl} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Customer Reviews Section */}
      <section id="reviews" className={`scroll-mt-32 max-w-7xl mx-auto px-6 py-20 relative z-20 transition-opacity duration-500 ${
        showCartModal || lastOrder || showReviewModal ? 'opacity-20 pointer-events-none' : 'opacity-100'
      }`}>
        <div className="text-center mb-12">
          <p className="font-body text-orange-500 text-sm font-semibold uppercase tracking-[0.2em] mb-2">What Our Customers Say</p>
          <h2 className="font-display text-5xl md:text-6xl text-white">Customer Reviews</h2>
        </div>

        {reviews.length === 0 ? (
          <p className="text-center text-gray-400 text-lg">No reviews yet. Be the first to share your experience!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews.map(review => (
              <div key={review.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-lg">
                <div className="flex items-center mb-3">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      size={20} 
                      className={`${review.rating >= star ? 'text-orange-500 fill-orange-500' : 'text-gray-600'}`} 
                    />
                  ))}
                </div>
                <p className="text-gray-300 text-base mb-4 line-clamp-4">{review.comment}</p>
                <p className="text-sm font-semibold text-white">- {review.customer_name || 'Anonymous'}</p>
                <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <button onClick={() => setShowReviewModal(true)} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 rounded-2xl font-bold shadow-lg shadow-orange-600/20 transition-all hover:-translate-y-1">
            Write a Review
          </button>
        </div>
      </section>

      <div className={`transition-opacity duration-500 ${showCartModal || lastOrder ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
        <About />
        <Contact />
        <Footer />
      </div>
    </div>
  );
};

const ProItemCard = ({ 
  item, 
  currency, 
  compact,
  onAdd,
  formatImageUrl
}: { item: RawMenuItem; currency: string; compact?: boolean; onAdd: () => void; formatImageUrl: (url?: string) => string }) => (
  <div className="group relative bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-sm transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:-translate-y-2">
    <div className={`relative ${compact ? 'h-48' : 'h-64'} overflow-hidden`}>
      <img 
        src={formatImageUrl(item.image_url)} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        alt={item.name} 
      />
      <div className="absolute top-4 left-4 flex gap-2">
        {item.popular && <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-[10px] font-black uppercase tracking-tighter flex items-center gap-1"><Star size={10} fill="currentColor" /> Popular</span>}
        {item.spicy && <span className="px-3 py-1 rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/30 text-[10px] font-black uppercase tracking-tighter text-red-400">Spicy 🌶️</span>}
      </div>
    </div>
    
    <div className="p-6">
      <div className="flex justify-between items-start mb-2">
        <h5 className="text-xl font-bold group-hover:text-orange-500 transition-colors">{item.name}</h5>
        <span className="text-lg font-black">{formatCurrency(item.price, currency)}</span>
      </div>
      <p className="text-gray-400 text-sm font-light leading-relaxed mb-6 line-clamp-2">
        {item.description}
      </p>
      <button 
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        className="w-full py-4 rounded-2xl bg-white text-black font-black text-sm flex items-center justify-center gap-2 transition-all hover:bg-orange-500 hover:text-white"
      >
        <ShoppingCart size={16} /> Add to Cart
      </button>
    </div>
  </div>
);

export default ProfessionalCustomerHome;