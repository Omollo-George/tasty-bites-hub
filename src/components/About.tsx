import { Clock, Flame, Heart, Truck } from "lucide-react";

const features = [
  { icon: Flame, title: "Flame Grilled", desc: "Every patty grilled over an open flame for that perfect char." },
  { icon: Heart, title: "Fresh Daily", desc: "Ingredients sourced fresh every morning from local suppliers." },
  { icon: Clock, title: "Fast Service", desc: "From order to tray in under 5 minutes, guaranteed." },
  { icon: Truck, title: "Free Delivery", desc: "Free delivery on orders over $25 within a 5-mile radius." },
];

const About = () => {
  return (
    <section id="about" className="py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Why Us</p>
          <h2 className="font-display text-5xl md:text-6xl text-foreground">THE TASTY DIFFERENCE</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f) => (
            <div key={f.title} className="text-center group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-hero-gradient flex items-center justify-center shadow-warm group-hover:scale-110 transition-transform">
                <f.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default About;
