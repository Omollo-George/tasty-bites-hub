export const formatImageUrl = (url?: string) => {
  if (!url) return ''
  const trimmed = url.toString().trim()
  if (!trimmed) return ''

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

  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '')
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  if (path.startsWith('/menu_items/')) {
    path = `/media${path}`
  } else if (!path.startsWith('/media/')) {
    path = `/media${path}`
  }

  return `${baseUrl}${path}`
}
