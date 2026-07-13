import React, { useEffect, useState, useRef } from 'react';
import { MapPin, Clock, Phone, GripVertical, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';

const contactInfo = [
  { icon: MapPin, title: "LOCATION", detail: "Next to Kisii University Main Gate", detail2: "Kisii, Kenya" },
  { icon: Clock, title: "HOURS", detail: "Mon – Fri: 10AM – 11PM", detail2: "Sat: 11AM – 12AM | Sun: 11AM – 10PM" },
  { icon: Phone, title: "CONTACT", detail: "(555) 123-BITE", detail2: "hello@tastybites.com | @tastybites" },
];

const aboutHighlights = [
  { title: "Operational Speed", desc: "Streamlined order-to-service pipelines for maximum efficiency." },
  { title: "Quality Standards", desc: "Automated inventory checks ensuring 100% freshness compliance." },
  { title: "Real-time Tracking", desc: "Precise kitchen management and preparation time monitoring." },
  { title: "Centralized Control", desc: "Unified dashboard for managing multiple dining outlets." },
];

interface OrderDetails {
  order_id: string;
  table: string;
  phone: string;
  status: string;
  total_amount: number;
  is_paid: boolean;
  created_at: string;
  items: Array<{ name: string; quantity: number; modifiers: string[] }>;
}

const ContactDrawer = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'about' | 'contact' | 'orders' | 'account' | null>(null);
  const [topPosition, setTopPosition] = useState(96);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<OrderDetails | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [kitchenNotice, setKitchenNotice] = useState<string | null>(null);
  const dragStateRef = useRef({ isDragging: false, startY: 0, startTop: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedOrderId = window.localStorage.getItem('tastyBites.lastOrderId');
    if (savedOrderId) {
      setOrderIdInput(savedOrderId);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !trackedOrder?.order_id) return;

    const orderId = trackedOrder.order_id;
    const eventSource = new EventSource(getSseUrl('/payments/stream/'));

    const handleKitchenUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (payload?.data?.order_id === orderId && (payload.type === 'order_ready' || payload.type === 'order_status_update')) {
          const status = payload.data.status || trackedOrder.status;
          setTrackedOrder((current) => (current ? { ...current, status } : current));
          if (status === 'ready') {
            setKitchenNotice('Your order is ready! Please pick it up from the kitchen counter.');
            toast({
              title: 'Kitchen update',
              description: 'Your order is ready and waiting at the pickup counter.',
              variant: 'default',
            });
          }
        }
      } catch (err) {
        console.debug('Unable to parse SSE event', err);
      }
    };

    eventSource.onmessage = handleKitchenUpdate;
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [trackedOrder?.order_id, toast]);

  const handleTrackOrder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedId = orderIdInput.trim();

    if (!trimmedId) {
      setTrackingError('Enter your order ID to track it.');
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);
    setKitchenNotice(null);

    try {
      const response = await fetch(getApiUrl(`/payments/orders/${encodeURIComponent(trimmedId)}/`));
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'We could not find that order.');
      }

      const data = await response.json();
      setTrackedOrder(data);
      window.localStorage.setItem('tastyBites.lastOrderId', trimmedId);
      if (data.status === 'ready' || data.status === 'served') {
        setKitchenNotice('Your order is ready! Please pick it up from the kitchen counter.');
      }
    } catch (err) {
      setTrackedOrder(null);
      setTrackingError(err instanceof Error ? err.message : 'Unable to load that order right now.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleGripMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startY = e.clientY;
    dragStateRef.current.startTop = topPosition;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      
      if (!dragStateRef.current.isDragging) return;

      const delta = moveEvent.clientY - dragStateRef.current.startY;
      let newTop = dragStateRef.current.startTop + delta;
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - 100));
      
      setTopPosition(newTop);
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {/* Drawer */}
      <div
        className={`fixed left-0 z-40 ${isOpen ? 'w-96' : 'w-0'} bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-r border-orange-500/30 overflow-hidden rounded-r-lg shadow-2xl select-none pointer-events-auto`}
        style={{ 
          top: `${topPosition}px`,
          bottom: '0px',
          transition: dragStateRef.current.isDragging ? 'none' : 'all 0.3s ease'
        }}
      >
        {/* Drag Handle */}
        <div
          onMouseDown={handleGripMouseDown}
          className="w-full h-12 bg-gradient-to-r from-orange-600 to-orange-500 flex items-center justify-center cursor-grab active:cursor-grabbing hover:from-orange-700 hover:to-orange-600 transition-all"
          title="Drag to move drawer"
        >
          <GripVertical size={20} className="text-white" />
        </div>

        <div className="p-6 h-[calc(100%-48px)] overflow-y-auto scrollbar-thin scrollbar-thumb-orange-500 scrollbar-track-slate-800 scroll-smooth" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-6">
            {/* Drawer Header */}
            <div className="text-center mb-6">
              <p className="text-orange-500 text-xs font-semibold uppercase tracking-[0.2em] mb-2">Visit Us</p>
              <h3 className="text-xl font-black text-white">COME HUNGRY</h3>
            </div>

            {[
              {
                key: 'about',
                title: 'About',
                subtitle: 'The Tasty Difference',
                content: (
                  <div className="space-y-3">
                    <p className="text-slate-300 text-xs leading-relaxed">Welcome to Tasty Bites Hub — where passion meets precision in every dish. We combine premium ingredients, efficient service, and polished operations to create a memorable experience.</p>
                    <div className="space-y-2">
                      {aboutHighlights.map((item) => (
                        <div key={item.title} className="rounded border border-slate-700/50 bg-slate-800/50 p-2">
                          <h5 className="text-xs font-semibold text-white">{item.title}</h5>
                          <p className="text-[11px] leading-relaxed text-slate-400">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: 'contact',
                title: 'Contact',
                subtitle: 'Get in touch with us',
                content: (
                  <div className="space-y-3">
                    {contactInfo.map((info, index) => {
                      const IconComponent = info.icon;
                      return (
                        <div key={index} className="rounded border border-slate-700/50 bg-slate-800/50 p-3">
                          <div className="flex items-start gap-3">
                            <IconComponent className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                            <div>
                              <h5 className="text-xs font-semibold text-white">{info.title}</h5>
                              <p className="text-[11px] leading-relaxed text-slate-400">{info.detail}</p>
                              <p className="text-[11px] leading-relaxed text-slate-400">{info.detail2}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
              },
              {
                key: 'account',
                title: 'Account',
                subtitle: 'Manage your profile details',
                content: (
                  <div className="rounded border border-slate-700/50 bg-slate-800/50 p-3 text-sm text-slate-300">
                    <p className="text-[11px] leading-relaxed">Update your delivery address, saved preferences, and account settings whenever you need to.</p>
                  </div>
                ),
              },
            ].map((section) => {
              const isExpanded = expandedSection === section.key;
              return (
                <div key={section.key} className="mb-3">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(isExpanded ? null : section.key as 'about' | 'contact' | 'orders' | 'account')}
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-800/50 p-4 flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-orange-500 text-xs font-semibold uppercase tracking-[0.2em]">{section.title}</p>
                      <h4 className="text-sm font-semibold text-white">{section.subtitle}</h4>
                    </div>
                    <ChevronRight size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="mt-2 rounded-lg border border-orange-500/20 bg-slate-900/70 p-4">
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Contact Info */}
            {contactInfo.map((info, index) => {
              const IconComponent = info.icon;
              return (
                <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-orange-500/50 transition-all">
                  <div className="flex items-start gap-3">
                    <IconComponent className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-white mb-1 text-sm">{info.title}</h4>
                      <p className="text-slate-300 text-xs leading-relaxed">{info.detail}</p>
                      <p className="text-slate-300 text-xs leading-relaxed">{info.detail2}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Additional Info */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 mt-4">
              <h4 className="font-semibold text-white mb-2 text-sm">Delivery & Services</h4>
              <ul className="text-slate-300 text-xs space-y-1">
                <li>✓ Fast Delivery Available</li>
                <li>✓ Takeaway Options</li>
                <li>✓ Dine-In Experience</li>
                <li>✓ Catering Services</li>
                <li>✓ Online Ordering</li>
              </ul>
            </div>

            {/* Follow Us */}
            <div className="mt-4 rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/15 to-slate-800/80 p-4 shadow-inner shadow-orange-500/10">
              <h4 className="mb-2 text-sm font-semibold text-white">Follow Us</h4>
              <p className="mb-3 text-xs leading-relaxed text-slate-300">Stay updated with our latest specials, seasonal offers, and menu launches.</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="w-full rounded-lg border border-orange-500/50 bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/30">
                  Instagram
                </button>
                <button className="w-full rounded-lg border border-orange-500/50 bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/30">
                  Facebook
                </button>
              </div>
            </div>

            {/* Spacing for scrolling */}
            <div className="h-4" />
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed left-0 z-50 p-3 rounded-r-lg transition-all duration-300 ${
          isOpen 
            ? 'bg-orange-500/80 hover:bg-orange-600' 
            : 'bg-orange-500/60 hover:bg-orange-500/80'
        } text-white shadow-lg`}
        style={{ top: `${topPosition + 192}px` }}
        aria-label={isOpen ? "Close drawer" : "Open drawer"}
      >
        <ChevronRight 
          size={24} 
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Overlay for closing drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default ContactDrawer;
