import { useState } from "react";
import { Menu, X } from "lucide-react";
import TastyBitesIcon from "./TastyBitesIcon";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Menu", href: "#menu" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

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
              className="font-body text-sm font-medium text-slate-300 hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
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
          <a
            href="#menu"
            onClick={() => setOpen(false)}
            className="bg-hero-gradient text-primary-foreground px-6 py-2 rounded-full text-sm font-semibold text-center"
          >
            Order Now
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
