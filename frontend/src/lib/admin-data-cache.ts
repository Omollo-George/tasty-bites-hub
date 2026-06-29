import { getApiUrl } from './api'
import { getAdminToken } from './admin-session'

interface CachedData {
  employees?: any
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

let dataCache: CachedData = {
  timestamp: 0
}

function isCacheValid(): boolean {
  return Date.now() - dataCache.timestamp < CACHE_TTL
}

export async function preloadEmployeesData(): Promise<void> {
  // Only preload if cache is invalid
  if (isCacheValid() && dataCache.employees) {
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
      dataCache = {
        employees: data.employees || [],
        timestamp: Date.now()
      }
    }
  } catch (err) {
    console.debug('Employees data preload error:', err)
  }
}

export function getCachedEmployees(): any[] | null {
  if (!isCacheValid()) {
    return null
  }
  return dataCache.employees || null
}

export function clearEmployeesCache(): void {
  dataCache.employees = undefined
  dataCache.timestamp = 0
}

export function invalidateCache(): void {
  dataCache.timestamp = 0
}
