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

  // In production, if no explicit API host is configured, use the same-host
  // backend route under /api, which matches the default Django/Vercel routing.
  return `/api${normalizedPath}`
      const status = res.status
      const statusText = res.statusText
      const ct = res.headers.get('content-type') || ''
      const err: any = new Error(`Request failed ${status} ${statusText}`)
      err.status = status
      err.body = text
      err.contentType = ct
      throw err
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return res.json()
    }
    // return raw text if not JSON
    return res.text()
  } catch (e) {
    if (isConfigRequest) {
      return DEFAULT_CONFIG_PAYLOAD
    }

    console.error('apiFetch error for', url, e)
    throw e
  }
}
