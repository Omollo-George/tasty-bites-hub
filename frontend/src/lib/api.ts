export const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const cleanedBase = baseUrl.replace(/\/$/, '')
  return `${cleanedBase}${path}`
}
