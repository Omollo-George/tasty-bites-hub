import { useState } from "react";
import { Flame, Star } from "lucide-react";

const categories = ["All", "Burgers", "Sides", "Drinks", "Desserts"];

const menuItems = [
  { name: "Classic Smash Burger", price: 8.99, category: "Burgers", popular: true, description: "Double patty, cheddar, pickles, special sauce" },
  { name: "Spicy Chicken Burger", price: 9.49, category: "Burgers", popular: false, description: "Crispy chicken, jalapeños, sriracha mayo", spicy: true },
  { name: "BBQ Bacon Burger", price: 10.99, category: "Burgers", popular: true, description: "Smoked bacon, BBQ glaze, onion rings" },
  { name: "Veggie Deluxe", price: 8.49, category: "Burgers", popular: false, description: "Plant-based patty, avocado, fresh greens" },
  { name: "Loaded Fries", price: 5.99, category: "Sides", popular: true, description: "Cheese sauce, bacon bits, green onions" },
  { name: "Onion Rings", price: 4.49, category: "Sides", popular: false, description: "Beer-battered, crispy golden perfection" },
  { name: "Chicken Wings (8pc)", price: 9.99, category: "Sides", popular: true, description: "Choice of buffalo, BBQ, or garlic parmesan" },
  { name: "Coleslaw", price: 3.49, category: "Sides", popular: false, description: "Creamy homestyle coleslaw" },
  { name: "Classic Milkshake", price: 5.49, category: "Drinks", popular: true, description: "Vanilla, chocolate, or strawberry" },
  { name: "Fresh Lemonade", price: 3.99, category: "Drinks", popular: false, description: "Freshly squeezed with a hint of mint" },
  { name: "Iced Tea", price: 2.99, category: "Drinks", popular: false, description: "Brewed daily, sweetened or unsweetened" },
  { name: "Brownie Sundae", price: 6.99, category: "Desserts", popular: true, description: "Warm brownie, vanilla ice cream, hot fudge" },
  { name: "Apple Pie Bites", price: 4.99, category: "Desserts", popular: false, description: "Cinnamon sugar dusted, served warm" },
];

const MenuSection = () => {
  const [active, setActive] = useState("All");

  const filtered = active === "All" ? menuItems : menuItems.filter((i) => i.category === active);

  return (
    <section id="menu" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <p className="font-body text-primary text-sm font-semibold uppercase tracking-[0.2em] mb-2">Our Menu</p>
          <h2 className="font-display text-5xl md:text-6xl text-foreground">WHAT'S COOKING</h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                active === cat
                  ? "bg-hero-gradient text-primary-foreground shadow-warm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div
              key={item.name}
              className="bg-card rounded-xl p-6 shadow-card hover:shadow-warm transition-shadow border border-border group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display text-2xl text-foreground group-hover:text-primary transition-colors">
                  {item.name}
                </h3>
                <div className="flex items-center gap-1">
                  {item.spicy && <Flame className="w-4 h-4 text-primary" />}
                  {item.popular && <Star className="w-4 h-4 text-secondary fill-secondary" />}
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-4">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-gradient">${item.price.toFixed(2)}</span>
                <button className="bg-hero-gradient text-primary-foreground px-5 py-2 rounded-full text-sm font-semibold hover:scale-105 transition-transform">
                  Add to Order
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MenuSection;
