const AUTH_TOKEN_KEY = 'auth_token'
const ADMIN_TOKEN_KEY = 'admin_token'
const STAFF_TOKEN_KEY = 'staff_token'

const getStoredToken = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

export const getAuthToken = (): string | null => {
  return getStoredToken(STAFF_TOKEN_KEY) || getStoredToken(ADMIN_TOKEN_KEY)
}

export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}
  const staffToken = getStoredToken(STAFF_TOKEN_KEY)
  const adminToken = getStoredToken(ADMIN_TOKEN_KEY)

  if (staffToken) {
    headers.Authorization = `Bearer ${staffToken}`
    headers['X-STAFF-TOKEN'] = staffToken
  }

  if (adminToken) {
    headers['X-ADMIN-TOKEN'] = adminToken
    if (!headers.Authorization) {
      headers.Authorization = `Bearer ${adminToken}`
    }
  }

  return headers
}

export const setAdminHeaderToken = (token: string) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export const setStaffHeaderToken = (token: string) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAFF_TOKEN_KEY, token)
}

export const clearAuthTokens = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(STAFF_TOKEN_KEY)
}
