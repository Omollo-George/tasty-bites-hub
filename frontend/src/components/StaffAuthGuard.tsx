import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearStaffSession, getStaffToken, isStaffSessionValid } from '@/lib/staff-session';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';

const StaffAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check both staff and admin session validity
    const adminToken = getAdminToken();
    const staffToken = getStaffToken();

    // Admin bypass: Admins can access staff workstation without additional staff login
    if (adminToken && isAdminSessionValid()) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    // Staff login: Check staff token validity
    if (staffToken && isStaffSessionValid()) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    // Session invalid or missing - clear and redirect
    clearStaffSession();
    setAuthorized(false);
    setChecking(false);
  }, []);

  // Show loading screen while checking authentication
  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
          <p className="text-gray-600 font-medium">Verifying staff access…</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authorized
  if (!authorized) {
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
};

export default StaffAuthGuard;