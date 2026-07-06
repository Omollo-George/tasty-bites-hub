import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, ShieldCheck, Zap, LayoutDashboard } from 'lucide-react';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';

const features = [
  { icon: Zap, title: 'Operational Speed', desc: 'Streamlined order-to-service pipelines for maximum efficiency.' },
  { icon: ShieldCheck, title: 'Quality Standards', desc: 'Automated inventory checks ensuring 100% freshness compliance.' },
  { icon: Clock, title: 'Real-time Tracking', desc: 'Precise kitchen management and preparation time monitoring.' },
  { icon: LayoutDashboard, title: 'Centralized Control', desc: 'Unified dashboard for managing multiple dining outlets.' },
];

export default function WhyUs() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link to="/account" className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 transition">
            <ArrowLeft className="w-4 h-4" /> Back to customer
          </Link>
          <span className="text-sm text-slate-400">Why Us drawer</span>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="overflow-y-auto pb-8">
          <DrawerHeader className="font-bakery">
            <DrawerTitle className="text-3xl text-slate-100">Why Us</DrawerTitle>
            <DrawerDescription className="max-w-2xl text-slate-300">
              Discover the customer-first benefits that make our restaurant ordering experience smarter and faster.
            </DrawerDescription>
          </DrawerHeader>

          <div className="container mx-auto px-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-card font-bakery">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-100">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-100">{feature.title}</h3>
                    </div>
                    <p className="text-slate-400">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end px-4">
            <DrawerClose className="rounded-full border border-slate-700 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
              Close
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
