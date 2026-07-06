import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, Heart, Info, Mail, Package, Settings, Star, Ticket, Users } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const accountItems = [
  { to: 'orders', label: 'Orders', description: 'View your recent orders and tracking', icon: Package },
  { to: 'inbox', label: 'Inbox', description: 'Messages and support conversations', icon: Mail },
  { to: 'reviews', label: 'Ratings & Reviews', description: 'Manage your feedback and comments', icon: Star },
  { to: 'vouchers', label: 'Vouchers', description: 'Available discounts and promo codes', icon: Ticket },
  { to: 'wishlist', label: 'Wishlist', description: 'Saved items you love', icon: Heart },
  { to: 'following', label: 'Following', description: 'Restaurants and chefs you follow', icon: Users },
  { to: 'recent', label: 'Recently Viewed', description: 'Quick access to recently viewed items', icon: Clock3 },
  { to: 'settings', label: 'Settings', description: 'Profile, security and preferences', icon: Settings },
  { to: 'why-us', label: 'Why Us', description: 'Open the customer benefits drawer', icon: Info },
];

export default function AccountIndex() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex min-h-screen">
          <Sidebar
            side="left"
            collapsible="icon"
            className="bg-slate-950/95 border-r border-slate-800 shadow-[0_25px_80px_-60px_rgba(249,115,22,0.55)] [&_[data-sidebar=sidebar]]:bg-slate-950"
          >
            <SidebarContent className="px-5 py-6 bg-slate-950/95">
              <div className="mb-6 space-y-3 rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)]">
                <p className="text-[0.65rem] uppercase tracking-[0.35em] text-orange-300/80">Customer menu</p>
                <h1 className="text-4xl font-bakery font-semibold tracking-tight text-slate-100">My Account</h1>
              </div>

              <SidebarGroup>
                <SidebarGroupLabel className="text-orange-300/80">Account options</SidebarGroupLabel>
                <SidebarMenu className="space-y-2">
                  {accountItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild size="lg" className="h-auto min-h-[5rem] py-3">
                        <Link
                          to={item.to}
                          className="grid min-w-0 w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-3xl border border-slate-800 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 transition hover:border-orange-500/40 hover:bg-slate-900"
                        >
                          <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-300 shadow-inner shadow-orange-500/5">
                            <item.icon className="h-6 w-6" />
                          </span>
                          <span className="min-w-0">
                            <span className="block w-full truncate text-base font-semibold leading-tight">{item.label}</span>
                            <span className="mt-1 block w-full text-xs text-slate-400 leading-5 break-words">{item.description}</span>
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="flex-1 p-8 bg-slate-950">
            <div className="max-w-6xl space-y-6">
              <div className="rounded-[2.5rem] border border-slate-800 bg-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-bakery">
                    <p className="text-sm uppercase tracking-[0.35em] text-orange-300/70">Customer dashboard</p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-100">Account control panel</h2>
                  </div>
                  <Button asChild className="rounded-full bg-slate-800 px-5 py-2 text-slate-100 hover:bg-slate-700">
                    <Link to="/">
                      <ArrowLeft className="w-4 h-4" /> Back to customer
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <p className="text-sm text-slate-400">Expand the drawer for a wider menu, or squeeze it to keep the page clean.</p>
                  </div>
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <p className="text-sm text-slate-400">Navigate easily between orders, inbox, vouchers, settings, and more.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.35em] text-orange-300/80">Quick actions</p>
                      <h3 className="mt-2 text-2xl font-bakery font-semibold text-slate-100">Packed with customer tools</h3>
                    </div>
                    <span className="inline-flex rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase text-orange-300">Live</span>
                  </div>
                  <div className="mt-6 space-y-4">
                    <p className="text-slate-400 leading-7">Everything in your account is now surfaced in the left drawer. Use the panel to keep navigation close while staying focused on the page.</p>
                    <ul className="space-y-3 text-slate-400">
                      <li className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">Orders, messages, reviews, vouchers and wishlist are one swipe away.</li>
                      <li className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">The sidebar can be collapsed or expanded to fit your workflow.</li>
                      <li className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">The page uses the same admin palette and accent styling as the dashboard.</li>
                    </ul>
                  </div>
                </section>

                <aside className="rounded-[2rem] border border-slate-800 bg-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                  <p className="text-sm uppercase tracking-[0.35em] text-orange-300/80">Account actions</p>
                  <h3 className="mt-2 text-2xl font-display font-semibold text-slate-100">Ready to use</h3>
                  <div className="mt-5 space-y-3">
                    {accountItems.map((item) => (
                      <div key={item.to} className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                        <p className="font-semibold text-slate-100">{item.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
