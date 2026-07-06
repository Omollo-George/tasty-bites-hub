import { Zap, ShieldCheck, Clock, LayoutDashboard } from "lucide-react";

const features = [
  { icon: Zap, title: "Operational Speed", desc: "Streamlined order-to-service pipelines for maximum efficiency." },
  { icon: ShieldCheck, title: "Quality Standards", desc: "Automated inventory checks ensuring 100% freshness compliance." },
  { icon: Clock, title: "Real-time Tracking", desc: "Precise kitchen management and preparation time monitoring." },
  { icon: LayoutDashboard, title: "Centralized Control", desc: "Unified dashboard for managing multiple dining outlets." },
];

const About = () => {
  return (
    <section id="about" className="py-24 bg-slate-950 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Why Us</p>
          <h2 className="font-display text-5xl md:text-6xl text-slate-100">THE TASTY DIFFERENCE</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="bg-slate-900 rounded-xl p-6 border border-slate-800 hover:border-orange-500/50 transition-all">
                <IconComponent className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="font-display text-lg text-slate-100 mb-2 text-[#d69e2e]">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default About;
