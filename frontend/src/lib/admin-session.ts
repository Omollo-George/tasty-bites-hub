const ADMIN_TOKEN_KEY = 'admin_token'
const ADMIN_TOKEN_EXPIRES_KEY = 'admin_token_expires_at'
const ADMIN_USER_KEY = 'admin_user'
const ADMIN_SESSION_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

export interface AdminUser {
  id?: number | null
  username: string
  display_name?: string
  authorized?: boolean
  expires_at?: string | null
}

export const getAdminToken = () => typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null

export const setAdminToken = (token: string) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
  setAdminSessionExpiry()
}

export const getAdminUser = (): AdminUser | null => {
  if (typeof window === 'undefined') return null
  const user = localStorage.getItem(ADMIN_USER_KEY)
  return user ? JSON.parse(user) : null
}

export const setAdminUser = (user: AdminUser) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user))
}

export const clearAdminSession = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(ADMIN_TOKEN_EXPIRES_KEY)
  localStorage.removeItem(ADMIN_USER_KEY)
}

export const setAdminSessionExpiry = () => {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_TOKEN_EXPIRES_KEY, String(Date.now() + ADMIN_SESSION_TIMEOUT_MS))
}

export const getAdminSessionExpiry = () => {
  if (typeof window === 'undefined') return 0
  const value = localStorage.getItem(ADMIN_TOKEN_EXPIRES_KEY)
  return value ? Number(value) : 0
}

export const isAdminSessionValid = () => {
  if (typeof window === 'undefined') return false
  const expiry = getAdminSessionExpiry()
  return expiry > Date.now()
}

export const touchAdminSession = () => {
  if (!getAdminToken()) return
  setAdminSessionExpiry()
}
