export const getApiUrl = (path: string) => {
  const envBase = import.meta.env.VITE_API_URL
  const baseUrl = envBase || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')
  const cleanedBase = baseUrl.replace(/\/$/, '')
  return `${cleanedBase}${path}`
}

export async function apiFetch(path: string, options?: RequestInit) {
  const url = getApiUrl(path)
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
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
    console.error('apiFetch error for', url, e)
    throw e
  }
}
