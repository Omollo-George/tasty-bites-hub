import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
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
import EmployeeTable from "./pages/Admin/EmployeeTable";
import AdminKDS from "./pages/Admin/KDS";
import Cashier from "./pages/Admin/Cashier";
import AdminLogin from "./pages/Admin/Login";
import AdminAuthGuard from "./components/AdminAuthGuard";
import ProfessionalCustomerHome from "./components/ProfessionalCustomerHome"; // Import the new component
import OrderTracking from "./pages/OrderTracking";
import StaffPage from "./pages/Admin/StaffPage";
import StaffLogin from "./pages/Admin/StaffLogin";
import StaffAuthGuard from "./components/StaffAuthGuard";

const queryClient = new QueryClient();

const App = () => (
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
            </Route>
            <Route path="/track/:orderId?" element={<OrderTracking />} /> {/* New Customer Tracking Route */}
            
            {/* Staff Workstation Group - Separated from Admin Sidebar Layout */}
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={<StaffAuthGuard><Outlet /></StaffAuthGuard>}>
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

export default App;
