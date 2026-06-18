const STAFF_TOKEN_KEY = 'staff_token'
const STAFF_NAME_KEY = 'staff_name'
const STAFF_ROLE_KEY = 'staff_role'
const STAFF_ID_KEY = 'staff_id'
const STAFF_EXPIRES_KEY = 'staff_token_expires_at'

const getStoredValue = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

const getStaffExpiresAt = (): string | null => {
  return getStoredValue(STAFF_EXPIRES_KEY)
}

const clearStaffSessionInternal = () => {
  localStorage.removeItem(STAFF_TOKEN_KEY)
  localStorage.removeItem(STAFF_NAME_KEY)
  localStorage.removeItem(STAFF_ROLE_KEY)
  localStorage.removeItem(STAFF_EXPIRES_KEY)
}

export const setStaffToken = (token: string, name: string, role: string, expiresAt: string) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAFF_TOKEN_KEY, token)
  localStorage.setItem(STAFF_NAME_KEY, name)
  localStorage.setItem(STAFF_ROLE_KEY, role)
  localStorage.setItem(STAFF_EXPIRES_KEY, expiresAt)
}

export const setStaffTokenWithId = (token: string, name: string, role: string, expiresAt: string, id?: number | string) => {
  setStaffToken(token, name, role, expiresAt)
  if (typeof window === 'undefined') return
  if (id !== undefined && id !== null) localStorage.setItem(STAFF_ID_KEY, String(id))
}

export const isStaffSessionValid = (): boolean => {
  if (typeof window === 'undefined') return false
  const expiresAt = getStaffExpiresAt()
  if (!expiresAt) return false
  const expiryDate = new Date(expiresAt)
  if (Number.isNaN(expiryDate.getTime())) {
    clearStaffSessionInternal()
    return false
  }
  if (expiryDate <= new Date()) {
    clearStaffSessionInternal()
    return false
  }
  return true
}

export const getStaffToken = (): string | null => {
  if (typeof window === 'undefined') return null
  if (!isStaffSessionValid()) {
    clearStaffSessionInternal()
    return null
  }
  return localStorage.getItem(STAFF_TOKEN_KEY)
}

export const getStaffName = (): string | null => {
  if (typeof window === 'undefined') return null
  if (!isStaffSessionValid()) {
    clearStaffSessionInternal()
    return null
  }
  return localStorage.getItem(STAFF_NAME_KEY)
}

export const getStaffId = (): string | null => {
  if (typeof window === 'undefined') return null
  if (!isStaffSessionValid()) {
    clearStaffSessionInternal()
    return null
  }
  return localStorage.getItem(STAFF_ID_KEY)
}

export const getStaffRole = (): string | null => {
  if (typeof window === 'undefined') return null
  if (!isStaffSessionValid()) {
    clearStaffSessionInternal()
    return null
  }
  return localStorage.getItem(STAFF_ROLE_KEY)
}

export const clearStaffSession = () => {
  if (typeof window === 'undefined') return
  clearStaffSessionInternal()
  localStorage.removeItem(STAFF_ID_KEY)
}
