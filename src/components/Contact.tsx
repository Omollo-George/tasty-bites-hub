import { MapPin, Phone, Clock } from "lucide-react";

const Contact = () => {
  return (
    <section id="contact" className="py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Visit Us</p>
          <h2 className="font-display text-5xl md:text-6xl text-slate-100">COME HUNGRY</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-slate-900 rounded-xl p-8 text-center shadow-card border border-slate-800">
            <MapPin className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-display text-xl text-slate-100 mb-2 text-[#d69e2e]">LOCATION</h3>
            <p className="text-slate-400 text-sm">Next to Kisii University Main Gate<br />Kisii, Kenya</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-8 text-center shadow-card border border-slate-800">
            <Clock className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-display text-xl text-slate-100 mb-2 text-[#d69e2e]">HOURS</h3>
            <p className="text-slate-400 text-sm">Mon – Fri: 10AM – 11PM<br />Saturday: 11AM – 12AM<br />Sunday: 11AM – 10PM</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-8 text-center shadow-card border border-slate-800">
            <Phone className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-display text-xl text-slate-100 mb-2 text-[#d69e2e]">CONTACT</h3>
            <p className="text-slate-400 text-sm">(555) 123-BITE<br />hello@tastybites.com<br />@tastybites</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
