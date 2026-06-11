const Footer = () => {
  return (

<footer className="bg-foreground py-12">
      <div className="container mx-auto px-4 text-center">
        <p className="font-display text-3xl text-primary mb-4">TASTY BITES</p>
        <p className="text-background/60 text-sm mb-6">Efficiency. Quality. Reliability. The standard in hotel management.</p>
        <div className="flex justify-center gap-6 mb-8">
          {["Home", "Menu", "About", "Contact"].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-background/50 text-sm hover:text-primary transition-colors"
            >
              {link}
            </a>
          ))}
        </div>
        <p className="text-background/30 text-xs">© 2026 Tasty Bites. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
