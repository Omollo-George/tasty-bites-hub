import { Clock, ShieldCheck, Zap, LayoutDashboard } from "lucide-react";

const features = [
  { icon: Zap, title: "Operational Speed", desc: "Streamlined order-to-service pipelines for maximum efficiency." },
  { icon: ShieldCheck, title: "Quality Standards", desc: "Automated inventory checks ensuring 100% freshness compliance." },
  { icon: Clock, title: "Real-time Tracking", desc: "Precise kitchen management and preparation time monitoring." },
  { icon: LayoutDashboard, title: "Centralized Control", desc: "Unified dashboard for managing multiple dining outlets." },
];

const About = () => {
  return (
    <section id="about" className="py-24 bg-slate-900 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Why Us</p>
          <h2 className="font-display text-5xl md:text-6xl text-slate-100">THE TASTY DIFFERENCE</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f) => (
            <div key={f.title} className="text-center group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a365d] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <f.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl text-slate-100 mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default About;
