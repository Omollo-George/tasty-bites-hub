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
    // Avoid blocking the main thread for known heavy routes.
    const heavyRoutes = new Set(['/admin/reports'])
    if (typeof window !== 'undefined' && heavyRoutes.has(path)) {
      const ric = (window as any).requestIdleCallback || function (cb: any) { return setTimeout(cb, 2000) }
      try {
        ric(() => { loader().catch(() => {}) })
      } catch (_) {
        // fallback: import after a short delay
        setTimeout(() => loader().catch(() => {}), 2000)
      }
    } else {
      loader().catch(() => {})
    }
  }
}
