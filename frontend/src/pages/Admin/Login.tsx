import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, Users } from 'lucide-react'
import { setAdminToken, getAdminToken, isAdminSessionValid, setAdminUser } from '@/lib/admin-session'
import { getApiUrl } from '@/lib/api'
import heroImage from '@/assets/hero-food.jpg'

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/admin'

  const isPasswordValid = password.trim().length > 0

  const formatAdminErrorMessage = (raw?: string) => {
    const trimmed = raw?.trim() || ''
    const normalized = trimmed.toLowerCase()

    if (!trimmed) {
      return 'Authentication failed. Please confirm your username and password and try again.'
    }

    if (normalized.includes('invalid credential')) {
      return 'Authentication failed. Please confirm your username and password and try again.'
    }

    if (normalized.includes('connection refused') || normalized.includes('failed to fetch')) {
      return 'Connection error. Please verify your network connection and try again.'
    }

    return trimmed
  }

  useEffect(() => {
    // Redirect to dashboard if session is already valid
    if (getAdminToken() && isAdminSessionValid()) {
      navigate(from, { replace: true })
      return
    }

    if (!lockoutSeconds) {
      return
    }

    const timer = window.setInterval(() => {
      setLockoutSeconds((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [lockoutSeconds])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required. Please enter your credentials to continue.')
      setLoading(false)
      return
    }

    try {
      const payload = { username: username.trim(), password: password.trim() }
      const endpoint = getApiUrl('/payments/admin/signin/')

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Safely validate that the response is JSON before parsing.
      // This prevents the "Unexpected end of JSON input" crash when receiving HTML error pages.
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorBody = await response.text();
        throw new Error(`Server Error (${response.status}): The backend returned an invalid format. Check server logs.`);
      }

      const data = await response.json()

      if (!response.ok) {
        const baseMessage = formatAdminErrorMessage(data.error)
        setLockoutSeconds(data.lockout_seconds || 0)
        if (data.attempts_left !== undefined && data.lockout_seconds === undefined) {
          setError(`${baseMessage} ${data.attempts_left} attempt${data.attempts_left === 1 ? '' : 's'} remaining.`)
        } else {
          setError(baseMessage)
        }
      } else {
        setLockoutSeconds(0)
        setAdminToken(data.token)
        if (data.username) {
          setAdminUser({ username: data.username, display_name: data.username, authorized: true })
        }
        navigate(from, { replace: true })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(formatAdminErrorMessage(msg === 'Failed to fetch' ? 'Connection Refused: Ensure the Django server is running on port 8000 and CORS is configured.' : msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
    >
      {/* Background image with JPG fallback and SVG fallback */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      />
      {/* Subtle overlay for contrast */}
      <div className="absolute inset-0 -z-10 bg-black/20" />
      
      
      <div className="w-full max-w-md bg-slate-900/95 p-8 rounded-3xl shadow-xl border border-slate-800 relative z-10">
        <h1 className="font-display text-3xl mb-4 text-slate-100">Admin Sign In</h1>
        <p className="text-sm text-slate-400 mb-6">Enter your admin credentials to manage orders and settings.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm text-slate-400">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="admin"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Password</span>
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 pr-12 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>
          {error && (
            <div className="flex gap-3 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-slate-100 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="font-semibold text-red-100">Authentication issue</p>
                <p className="mt-1 text-red-200">{error}</p>
              </div>
            </div>
          )}
          {lockoutSeconds > 0 && (
            <p className="text-sm text-yellow-700">
              Please wait {lockoutSeconds} second{lockoutSeconds === 1 ? '' : 's'} before trying again.
            </p>
          )}
          <button
            type="submit"
            disabled={loading || lockoutSeconds > 0}
            className="w-full bg-orange-500 text-white rounded-full px-4 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : lockoutSeconds > 0 ? 'Locked out' : 'Sign In'}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-6">
          Only admin users can sign in. If you do not have access, contact the site administrator.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <Link 
            to="/staff" 
            className="flex items-center justify-center gap-3 text-sm font-semibold text-slate-400 hover:text-orange-500 transition-all group"
          >
            <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-orange-500/10 transition-colors">
              <Users size={18} />
            </div>
            <span>Access Staff Workstation</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
