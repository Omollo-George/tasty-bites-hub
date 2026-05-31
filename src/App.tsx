import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Admin/Dashboard";
import AdminHome from "./pages/Admin/Home";
import AdminOrders from "./pages/Admin/Orders";
import AdminMenu from "./pages/Admin/Menu";
import AdminSettings from "./pages/Admin/Settings";
import AdminEmployees from "./pages/Admin/Employees";
import AdminReports from "./pages/Admin/Reports";
import AdminStock from "./pages/Admin/Stock";
import AdminAutomation from "./components/AdminAutomation";
import AdminKDS from "./pages/Admin/KDS";
import AdminLogin from "./pages/Admin/Login";
import AdminAuthGuard from "./components/AdminAuthGuard";
import OrderTracking from "./pages/OrderTracking";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/*"
              element={
                <AdminAuthGuard>
                  <Dashboard />
                </AdminAuthGuard>
              }
            >
              <Route index element={<AdminHome />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="automation" element={<AdminAutomation />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="stock" element={<AdminStock />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="kds" element={<AdminKDS />} /> {/* New KDS Route */}
            </Route>
            <Route path="/track/:orderId?" element={<OrderTracking />} /> {/* New Customer Tracking Route */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
