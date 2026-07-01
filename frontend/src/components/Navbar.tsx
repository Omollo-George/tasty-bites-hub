import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import TastyBitesIcon from "./TastyBitesIcon";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Menu", href: "#menu" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="container mx-auto flex items-center justify-between py-4 px-4">
        <a href="#home" className="flex items-center gap-2 font-display text-3xl tracking-wider text-[#d69e2e]">
          <TastyBitesIcon size={32} />
          <span>TASTY BITES</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-body text-sm font-medium text-slate-300 hover:text-[#d69e2e] transition-colors"
            >
              {link.label}
            </a>
          ))}

          {/* Why Us dropdown */}
          <div className="relative">
            <button
              onMouseEnter={() => setWhyOpen(true)}
              onMouseLeave={() => setWhyOpen(false)}
              onClick={() => setWhyOpen(!whyOpen)}
              className="font-body text-sm font-medium text-slate-300 hover:text-[#d69e2e] flex items-center gap-2"
            >
              Why Us <ChevronDown className="w-4 h-4" />
            </button>
            {whyOpen && (
              <div onMouseEnter={() => setWhyOpen(true)} onMouseLeave={() => setWhyOpen(false)} className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-md shadow-lg border border-slate-700 p-2 z-50">
                <a href="/why/operational-speed" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded">Operational Speed</a>
                <a href="/why/quality-standards" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded">Quality Standards</a>
                <a href="/why/real-time-tracking" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded">Real-time Tracking</a>
                <a href="/why/centralized-control" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded">Centralized Control</a>
              </div>
            )}
          </div>

          <a
            href="#menu"
            className="bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 px-6 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Order Now
          </a>
        </div>
        <button
          className="md:hidden text-slate-100"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pb-4 flex flex-col gap-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-body text-sm font-medium text-slate-300 hover:text-primary py-2"
            >
              {link.label}
            </a>
          ))}
          <div className="border-t border-slate-800 pt-2">
            <a href="/why/operational-speed" onClick={() => setOpen(false)} className="block font-body text-sm text-slate-300 py-2">Operational Speed</a>
            <a href="/why/quality-standards" onClick={() => setOpen(false)} className="block font-body text-sm text-slate-300 py-2">Quality Standards</a>
            <a href="/why/real-time-tracking" onClick={() => setOpen(false)} className="block font-body text-sm text-slate-300 py-2">Real-time Tracking</a>
            <a href="/why/centralized-control" onClick={() => setOpen(false)} className="block font-body text-sm text-slate-300 py-2">Centralized Control</a>
          </div>
          <a
            href="#menu"
            onClick={() => setOpen(false)}
            className="bg-[#1a365d] text-[#d69e2e] border border-[#d69e2e]/30 px-6 py-2 rounded-full text-sm font-semibold text-center"
          >
            Order Now
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
