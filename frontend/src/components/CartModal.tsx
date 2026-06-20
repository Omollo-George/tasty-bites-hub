import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart as ShoppingCartIcon, Loader2, Star, MapPin } from 'lucide-react';
import { formatCurrency } from './utils'; // Assuming formatCurrency is defined in utils.ts

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  is_available: boolean;
  modifiers?: string[];
}

interface CartModalProps {
  cart: CartItem[];
  currency: string;
  onClose: () => void;
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onCheckout: () => void;
  cartTotalPrice: number;
  cartTotalItems: number;
  phoneNumber: string;
  onPhoneNumberChange: (phone: string) => void;
  isProcessing: boolean;
  isAwaitingMpesa: boolean;
  onCancelMpesaPayment: () => void; // New prop for cancelling M-Pesa
  points: number;
  onRedeemPoints: () => void;
  orderType: 'takeaway' | 'delivery';
  onOrderTypeChange: (type: 'takeaway' | 'delivery') => void;
  deliveryAddress: string;
  onDeliveryAddressChange: (address: string) => void;
}

const CartModal: React.FC<CartModalProps> = ({
  cart,
  currency,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  cartTotalPrice,
  cartTotalItems,
  phoneNumber,
  onPhoneNumberChange,
  isProcessing,
  isAwaitingMpesa,
  onCancelMpesaPayment, // Destructure new prop
  points,
  onRedeemPoints,
  orderType,
  onOrderTypeChange,
  deliveryAddress,
  onDeliveryAddressChange,
}) => {
  const [dragY, setDragY] = useState(0); // Changed from dragOffset to dragY
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0); // Changed from startPos to startY
  const currentDragY = useRef(0); // To track current dragY for closing logic
  const accumulatedY = useRef(0); // To keep track of the total offset
  const modalRef = useRef<HTMLDivElement>(null); // Ref for the modal content div
  const isInternalScrolling = useRef(false);

  // Handle dragging logic
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const currentY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = currentY - startY.current;
      const newDragY = accumulatedY.current + deltaY;

      // Allow pulling up (negative Y) but with resistance, and pulling down freely
      const limitedY = newDragY < -100 ? -100 + (newDragY + 100) * 0.2 : newDragY;

      setDragY(limitedY);
      currentDragY.current = limitedY;
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        isInternalScrolling.current = false;
        
        // Pull-to-close logic: if dragged down significantly, close it
        const modalHeight = modalRef.current?.clientHeight || 0;
        if (currentDragY.current > modalHeight * 0.4) {
          onClose();
          accumulatedY.current = 0;
          setDragY(0);
        } else {
          // Snap back to "comfortable" view positions
          const snapY = currentDragY.current < -20 ? -50 : 0;
          accumulatedY.current = snapY;
          setDragY(snapY);
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onClose]);

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only prevent default if the event target is one of the designated draggable areas
    const target = e.target as HTMLElement;
    const isDraggableArea = target.classList.contains('cursor-grab') || target.closest('.cursor-grab');

    if (isDraggableArea) {
      e.preventDefault(); // Prevent default touch/mouse behavior (like scrolling the page)
      setIsDragging(true);
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      startY.current = clientY;
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex sm:items-center items-end justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4 transition-colors duration-500 ${isDragging ? 'cursor-grabbing' : ''}`} 
      onClick={onClose}
    >
      <div ref={modalRef} // Removed touch-none from here
        className={`relative w-full sm:max-w-md bg-[#161617] text-white rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl will-change-transform ${!isDragging ? 'transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)' : ''}`}
        style={{
          overflowY: 'auto', // Make the entire modal scrollable if content exceeds maxHeight
          transform: `translateY(${dragY}px)`,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div 
          className="h-1.5 w-16 bg-white/10 rounded-full mx-auto mt-4 mb-2 cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors touch-action-none" // Added touch-action-none
          onMouseDown={onDragStart}
          onTouchStart={onDragStart} // touch-none on handle
        />

        {/* Header */}
        <div 
          className="flex items-center justify-between px-8 py-4 border-b border-white/5 cursor-grab active:cursor-grabbing select-none touch-action-none" // Added touch-action-none
          onMouseDown={onDragStart}
          onTouchStart={onDragStart} // touch-none on header
        >
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCartIcon size={24} /> Your Cart ({cartTotalItems})
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 px-6 sm:px-8 py-4 custom-scrollbar overscroll-contain">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Your cart is empty. Start adding some delicious items!</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-4 py-4 border-b border-white/5 last:border-b-0">
                <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex-1">
                  <h4 className="text-lg font-semibold">{item.name}</h4>
                  <p className="text-gray-400 text-sm">{formatCurrency(item.price, currency)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-lg font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="text-red-500 hover:text-red-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div 
          className="p-8 border-t border-white/5 bg-[#1a1a1a]/50 backdrop-blur-xl cursor-grab active:cursor-grabbing touch-action-none" // Added touch-action-none
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          {/* Loyalty Points Section */}
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="text-orange-500 fill-orange-500" size={18} />
                <span className="text-sm font-bold">Loyalty Points: {points}</span>
              </div>
              {cartTotalPrice > 1000 && (
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter bg-orange-500/20 px-2 py-1 rounded-full">
                  +10 Points pending
                </span>
              )}
            </div>
            
            {points >= 100 && (
              <button
                onClick={onRedeemPoints}
                disabled={isProcessing || isAwaitingMpesa}
                className="w-full py-2 bg-white text-orange-600 font-black text-xs rounded-xl hover:bg-orange-50 transition-colors"
              >
                Redeem 100 Points for a Free Drink
              </button>
            )}
          </div>

          {/* Order Type Selection */}
          <div className="mb-6 space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Collection Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => onOrderTypeChange('takeaway')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                  orderType === 'takeaway'
                    ? "bg-orange-600 text-white border-orange-600"
                    : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20"
                }`}
              >
                Takeaway
              </button>
              <button
                onClick={() => onOrderTypeChange('delivery')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                  orderType === 'delivery'
                    ? "bg-orange-600 text-white border-orange-600"
                    : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20"
                }`}
              >
                Delivery
              </button>
            </div>
          </div>

          {orderType === 'delivery' && (
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Delivery Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text"
                  placeholder="Street, Building, Apartment No."
                  value={deliveryAddress}
                  onMouseDown={(e) => e.stopPropagation()} // Prevent drag from starting on input
                  onTouchStart={(e) => e.stopPropagation()} // Prevent drag from starting on input
                  onChange={(e) => onDeliveryAddressChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm placeholder:text-gray-600"
                />
              </div>
            </div>
          )}

          {cart.length > 0 && (
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">M-Pesa Phone Number</label>
              <input 
                type="tel"
                placeholder="e.g. 254712345678"
                value={phoneNumber}
                onMouseDown={(e) => e.stopPropagation()} // Prevent drag from starting on input
                onTouchStart={(e) => e.stopPropagation()} // Prevent drag from starting on input
                onChange={(e) => onPhoneNumberChange(e.target.value)}
                disabled={isProcessing || isAwaitingMpesa}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm placeholder:text-gray-600"
              />
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <span className="text-xl font-bold">Total:</span>
            <span className="text-2xl font-black text-orange-500">{formatCurrency(cartTotalPrice, currency)}</span>
          </div>
          <button
            onClick={onCheckout}
            disabled={cart.length === 0 || isProcessing || isAwaitingMpesa}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-black text-lg transition-all hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <><Loader2 className="animate-spin" size={20} /> Starting M-Pesa...</>
            ) : isAwaitingMpesa ? (
              <><Loader2 className="animate-spin" size={20} /> Check your Phone...</>
            ) : (
              "Pay via M-Pesa"
            )}
          </button>
          {(isProcessing || isAwaitingMpesa) && (
            <p className="text-[10px] text-center text-orange-500/60 mt-3 animate-pulse">Please do not close or refresh this page</p>
          )}
          {isAwaitingMpesa && (
            <button
              onClick={onCancelMpesaPayment}
              className="w-full py-2 mt-3 rounded-2xl border border-red-500/50 text-red-500 font-bold text-sm transition-all hover:bg-red-500 hover:text-white"
            >
              Cancel Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartModal;