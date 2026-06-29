import { getApiUrl } from './api'
import { getAdminToken } from './admin-session'

interface Cache<T> {
  data: T | null
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

let employeesCache: Cache<any> = { data: null, timestamp: 0 }
let reportsCache: Cache<any> = { data: null, timestamp: 0 }
let stockCache: Cache<any> = { data: null, timestamp: 0 }

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL
}

// ===== EMPLOYEES =====
export async function preloadEmployeesData(): Promise<void> {
  if (isCacheValid(employeesCache.timestamp) && employeesCache.data) {
    return
  }

  const token = getAdminToken()
  if (!token) return

  try {
    const res = await fetch(getApiUrl('/payments/admin/employees/'), {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      employeesCache = {
        data: data.employees || [],
        timestamp: Date.now()
      }
    }
  } catch (err) {
    console.debug('Employees data preload error:', err)
  }
}

export function getCachedEmployees(): any[] | null {
  if (!isCacheValid(employeesCache.timestamp)) {
    return null
  }
  return employeesCache.data || null
}

export function clearEmployeesCache(): void {
  employeesCache = { data: null, timestamp: 0 }
}

// ===== REPORTS =====
export async function preloadReportsData(): Promise<void> {
  if (isCacheValid(reportsCache.timestamp) && reportsCache.data) {
    return
  }

  const token = getAdminToken()
  if (!token) return

  try {
    // Preload default weekly report for today
    const today = new Date().toISOString().split('T')[0]
    const params = new URLSearchParams({
      period_type: 'week',
      date: today
    })

    const res = await fetch(getApiUrl(`/payments/reports/summary/?${params.toString()}`), {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      reportsCache = {
        data,
        timestamp: Date.now()
      }
    }
  } catch (err) {
    console.debug('Reports data preload error:', err)
  }
}

export function getCachedReports(): any | null {
  if (!isCacheValid(reportsCache.timestamp)) {
    return null
  }
  return reportsCache.data || null
}

export function clearReportsCache(): void {
  reportsCache = { data: null, timestamp: 0 }
}

// ===== STOCK =====
export async function preloadStockData(): Promise<void> {
  if (isCacheValid(stockCache.timestamp) && stockCache.data) {
    return
  }

  const token = getAdminToken()
  if (!token) return

  try {
    const res = await fetch(getApiUrl('/payments/menu-items/'), {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      stockCache = {
        data: data.menu_items || [],
        timestamp: Date.now()
      }
    }
  } catch (err) {
    console.debug('Stock data preload error:', err)
  }
}

export function getCachedStock(): any[] | null {
  if (!isCacheValid(stockCache.timestamp)) {
    return null
  }
  return stockCache.data || null
}

export function clearStockCache(): void {
  stockCache = { data: null, timestamp: 0 }
}

// ===== UTILITY =====
export function invalidateAllCaches(): void {
  employeesCache.timestamp = 0
  reportsCache.timestamp = 0
  stockCache.timestamp = 0
}
