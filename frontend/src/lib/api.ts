export const getApiUrl = (path: string) => {
  const envBase = import.meta.env.VITE_API_URL
  const baseUrl = envBase || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')
  const cleanedBase = baseUrl.replace(/\/$/, '')
  return `${cleanedBase}${path}`
}
