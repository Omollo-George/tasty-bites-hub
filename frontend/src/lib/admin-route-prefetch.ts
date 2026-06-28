export const adminRoutePrefetchers: Record<string, () => Promise<any>> = {
  '/admin': () => import('../pages/Admin/Home'),
  '/admin/orders': () => import('../pages/Admin/Orders'),
  '/admin/reports': () => import('../pages/Admin/Reports'),
  '/admin/automation': () => import('../components/AdminAutomation'),
  '/admin/menu': () => import('../pages/Admin/Menu'),
  '/admin/employees': () => import('../pages/Admin/Employees'),
  '/admin/stock': () => import('../pages/Admin/Stock'),
  '/admin/settings': () => import('../pages/Admin/Settings'),
}

export function preloadAdminRoute(path: string) {
  const loader = adminRoutePrefetchers[path]
  if (loader) {
    loader().catch(() => {})
  }
}
