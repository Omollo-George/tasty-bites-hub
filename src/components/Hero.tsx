import heroImage from "@/assets/hero-food.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Delicious burgers, fries, wings and milkshake"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="relative container mx-auto px-4 py-32 text-center">
        <p className="font-body text-secondary text-sm font-semibold uppercase tracking-[0.3em] mb-4">
          Welcome to
        </p>
        <h1 className="font-display text-6xl sm:text-7xl md:text-8xl text-primary-foreground leading-none mb-6">
          TASTY BITES HUB
        </h1>
        <p className="font-body text-primary-foreground/80 text-lg md:text-xl max-w-xl mx-auto mb-10">
          The Enterprise-Grade Hotel Management Solution. Precision inventory, integrated POS, and seamless kitchen operations in one unified system.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#menu"
            className="bg-hero-gradient text-primary-foreground px-8 py-4 rounded-full text-lg font-semibold shadow-warm hover:scale-105 transition-transform"
          >
            Explore Menu
          </a>
          <a
            href="#contact"
            className="border-2 border-primary-foreground/30 text-primary-foreground px-8 py-4 rounded-full text-lg font-semibold hover:bg-primary-foreground/10 transition-colors"
          >
            Find Us
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
