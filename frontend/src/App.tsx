import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Admin/Dashboard";
import { lazyWithPreload } from "./lib/lazy-with-preload";
const AdminHome = lazyWithPreload(() => import("./pages/Admin/Home"));
const AdminOrders = lazyWithPreload(() => import("./pages/Admin/Orders"));
const AdminMenu = lazyWithPreload(() => import("./pages/Admin/Menu"));
const AdminSettings = lazyWithPreload(() => import("./pages/Admin/Settings"));
const AdminEmployees = lazyWithPreload(() => import("./pages/Admin/Employees"));
const AdminReports = lazyWithPreload(() => import("./pages/Admin/Reports"));
const AdminStock = lazyWithPreload(() => import("./pages/Admin/Stock"));
const AdminAutomation = lazyWithPreload(() => import("./components/AdminAutomation"));
const EmployeeTable = lazyWithPreload(() => import("./pages/Admin/EmployeeTable"));
const AdminKDS = lazyWithPreload(() => import("./pages/Admin/KDS"));
const Cashier = lazyWithPreload(() => import("./pages/Admin/Cashier"));
import AdminLogin from "./pages/Admin/Login";;
import AdminAuthGuard from "./components/AdminAuthGuard";
import ProfessionalCustomerHome from "./components/ProfessionalCustomerHome"; // Import the new component
import OrderTracking from "./pages/OrderTracking";
const StaffPage = lazyWithPreload(() => import("./pages/Admin/StaffPage"));
import StaffLogin from "./pages/Admin/StaffLogin";
import StaffAuthGuard from "./components/StaffAuthGuard";
import AccountIndex from "./pages/Customer/AccountIndex";
import Orders from "./pages/Customer/Orders";
import Inbox from "./pages/Customer/Inbox";
import Reviews from "./pages/Customer/Reviews";
import Vouchers from "./pages/Customer/Vouchers";
import Wishlist from "./pages/Customer/Wishlist";
import Following from "./pages/Customer/Following";
import RecentlyViewed from "./pages/Customer/RecentlyViewed";
import Settings from "./pages/Customer/Settings";
import WhyUs from "./pages/Customer/WhyUs";
import OperationalSpeed from "./pages/Why/OperationalSpeed";
import QualityStandards from "./pages/Why/QualityStandards";
import RealTimeTracking from "./pages/Why/RealTimeTracking";
import CentralizedControl from "./pages/Why/CentralizedControl";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const preloads = [
      AdminHome.preload,
      AdminOrders.preload,
      AdminMenu.preload,
      AdminSettings.preload,
      AdminEmployees.preload,
      AdminReports.preload,
      AdminStock.preload,
      AdminAutomation.preload,
      EmployeeTable.preload,
      AdminKDS.preload,
      Cashier.preload,
      StaffPage.preload,
    ];

    const timer = window.setTimeout(() => {
      preloads.forEach((preload) => preload?.().catch(() => {}));
    }, 150);

    return () => window.clearTimeout(timer);
  }, []);

  return (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProfessionalCustomerHome />} /> {/* Render the new professional home page */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading admin section…</div>}>
                  <AdminAuthGuard>
                    <Dashboard />
                  </AdminAuthGuard>
                </Suspense>
              }
            >
              <Route
                index
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading dashboard…</div>}>
                    <AdminHome />
                  </Suspense>
                }
              />
              <Route
                path="orders"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading orders…</div>}>
                    <AdminOrders />
                  </Suspense>
                }
              />
              <Route
                path="reports"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading reports…</div>}>
                    <AdminReports />
                  </Suspense>
                }
              />
              <Route
                path="automation"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading automation…</div>}>
                    <AdminAutomation />
                  </Suspense>
                }
              />
              <Route
                path="menu"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading menu…</div>}>
                    <AdminMenu />
                  </Suspense>
                }
              />
              <Route
                path="employees"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading employees…</div>}>
                    <AdminEmployees />
                  </Suspense>
                }
              />
              <Route
                path="stock"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading stock…</div>}>
                    <AdminStock />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<div className="min-h-[20rem] flex items-center justify-center text-slate-400">Loading settings…</div>}>
                    <AdminSettings />
                  </Suspense>
                }
              />
            </Route>
            <Route path="/track/:orderId?" element={<OrderTracking />} /> {/* New Customer Tracking Route */}
            <Route path="/account/*" element={<Outlet />}>
              <Route index element={<AccountIndex />} />
              <Route path="orders" element={<Orders />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="vouchers" element={<Vouchers />} />
              <Route path="wishlist" element={<Wishlist />} />
              <Route path="following" element={<Following />} />
              <Route path="settings" element={<Settings />} />
              <Route path="recent" element={<RecentlyViewed />} />
              <Route path="why-us" element={<WhyUs />} />
            </Route>
            
            {/* Staff Workstation Group - Separated from Admin Sidebar Layout */}
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={
              <StaffAuthGuard>
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading staff section…</div>}>
                  <Outlet />
                </Suspense>
              </StaffAuthGuard>
            }>
              <Route index element={<StaffPage />} />
              <Route path="pos" element={<EmployeeTable />} />
              <Route path="kds" element={<AdminKDS />} />
              <Route path="cashier" element={<Cashier />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
