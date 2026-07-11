export const getApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  const normalizeLocalhost = (value: string) =>
    value.replace(
      /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i,
      (_match, host, port = '') => `http://${host}${port}`
    )

  const isLocalHttps = (value: string) =>
    /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value)

  const defaultLocalBackend = 'http://127.0.0.1:8000'

  const envBase = import.meta.env.VITE_API_URL?.trim()
  if (import.meta.env.DEV) {
    if (envBase) {
      const cleanedBase = envBase.replace(/\/$/, '')
      const safeBase = normalizeLocalhost(cleanedBase)
      return `${safeBase}${normalizedPath}`
    }

    if (typeof window !== 'undefined') {
      const pageOrigin = window.location.origin.replace(/\/$/, '')
      if (isLocalHttps(pageOrigin)) {
        return `${defaultLocalBackend}${normalizedPath}`
      }
    }

    return normalizedPath
  }

  if (envBase) {
    const cleanedBase = envBase.replace(/\/$/, '')
    const safeBase = normalizeLocalhost(cleanedBase)
    return `${safeBase}${normalizedPath}`
  }

  if (typeof window === 'undefined') {
    return `${defaultLocalBackend}${normalizedPath}`
  }

  const pageOrigin = window.location.origin.replace(/\/$/, '')
  const normalizedOrigin = normalizeLocalhost(pageOrigin)

  if (isLocalHttps(pageOrigin)) {
    return `${defaultLocalBackend}${normalizedPath}`
  }

  return `/api${normalizedPath}`
}

// Return a full backend URL appropriate for Server-Sent Events (EventSource).
// In development this will point directly to the backend (127.0.0.1:8000) so
// the browser can open a long-lived connection without going through the Vite proxy.
export const getSseUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const defaultLocalBackend = 'http://127.0.0.1:8000'

  const envBase = import.meta.env.VITE_API_URL?.trim()
  if (import.meta.env.DEV) {
    if (envBase) {
      const cleanedBase = envBase.replace(/\/$/, '')
      return `${cleanedBase}${normalizedPath}`
    }
    return `${defaultLocalBackend}${normalizedPath}`
  }

  if (envBase) {
    const cleanedBase = envBase.replace(/\/$/, '')
    return `${cleanedBase}${normalizedPath}`
  }

  // In production, SSE should be available under the same origin API path
  return `/api${normalizedPath}`
}

const DEFAULT_CONFIG_PAYLOAD = {
  base_currency: 'KES',
  display_currency: 'KES',
  conversion_rate: 1,
  delivery_rate_per_km: 100,
  min_delivery_fee: 50,
}

export async function apiFetch(path: string, options?: RequestInit) {
  const url = getApiUrl(path)
  const isConfigRequest = /\/payments\/config\/?$/.test(path.replace(/\?.*$/, ''))

  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      if (isConfigRequest) {
        return DEFAULT_CONFIG_PAYLOAD
      }

      const text = await res.text().catch(() => '')
      const status = res.status
      const statusText = res.statusText
      const ct = res.headers.get('content-type') || ''
      let body: any = text
      if (ct.includes('application/json')) {
        try {
          body = text ? JSON.parse(text) : text
        } catch {
          body = text
        }
      }
      const err: any = new Error(`Request failed ${status} ${statusText}`)
      err.status = status
      err.body = body
      err.contentType = ct
      throw err
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return res.json()
    }
    return res.text()
  } catch (e) {
    if (isConfigRequest) {
      return DEFAULT_CONFIG_PAYLOAD
    }

    console.error('apiFetch error for', url, e)
    throw e
  }
}
