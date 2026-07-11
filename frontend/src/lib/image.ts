const FALLBACK_MENU_IMAGE = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80';

export const formatImageUrl = (url?: string) => {
  if (!url) return FALLBACK_MENU_IMAGE
  const trimmed = url.toString().trim()
  if (!trimmed) return FALLBACK_MENU_IMAGE

  if (trimmed.startsWith('blob:')) {
    return trimmed
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/menu_items/') && !trimmed.includes('/media/')) {
      return trimmed.replace('/menu_items/', '/media/menu_items/')
    }
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `${window.location.protocol}${trimmed}`
  }

  const normalizeLocalhost = (value: string) =>
    value.replace(
      /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i,
      (_match, host, port = '') => `http://${host}${port}`
    )

  const envBase = import.meta.env.VITE_API_URL?.trim()
  const defaultOrigin = typeof window !== 'undefined'
    ? normalizeLocalhost(window.location.origin.replace(/\/$/, ''))
    : 'http://localhost:8000'
  const baseUrl = (envBase || defaultOrigin).replace(/\/api\/?$/, '')

  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  if (path.startsWith('/menu_items/')) {
    path = `/media${path}`
  } else if (!path.startsWith('/media/')) {
    path = `/media${path}`
  }

  return `${baseUrl}${path}`
}
