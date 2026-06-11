import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStaffToken } from '@/lib/staff-session';
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session';

const StaffAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const staffToken = getStaffToken();
  const adminToken = getAdminToken();
  const location = useLocation();

  // Admin Bypass: Admins can access staff workstation without additional login
  if (adminToken && isAdminSessionValid()) {
    return <>{children}</>;
  }

  if (staffToken) {
    return <>{children}</>;
  }

  return <Navigate to="/staff/login" state={{ from: location }} replace />;
};

export default StaffAuthGuard;