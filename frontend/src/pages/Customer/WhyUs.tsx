import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const features = [
  { title: 'Operational Speed', desc: 'Streamlined order-to-service pipelines for maximum efficiency.' },
  { title: 'Quality Standards', desc: 'Automated inventory checks ensuring 100% freshness compliance.' },
  { title: 'Real-time Tracking', desc: 'Precise kitchen management and preparation time monitoring.' },
  { title: 'Centralized Control', desc: 'Unified dashboard for managing multiple dining outlets.' },
];

export default function WhyUs() {
  const [open, setOpen] = useState(false);
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto bg-white/5 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
          <div>
            <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-1">Why Us</p>
            <h1 className="font-display text-2xl md:text-3xl text-slate-100">The Tasty Difference</h1>
          </div>
          <div className="text-slate-300">
            {open ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </div>
        </div>

        <div className={`mt-4 transition-all duration-300 ${open ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="bg-slate-900/50 rounded-md p-4">
                <h3 className="font-semibold text-lg text-slate-100">{f.title}</h3>
                <p className="text-slate-400 text-sm mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
