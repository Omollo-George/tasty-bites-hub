import React, { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, ShieldCheck, ArrowLeft, Users } from 'lucide-react'
import { setStaffToken, setStaffTokenWithId } from '@/lib/staff-session'
import { getAdminToken, isAdminSessionValid } from '@/lib/admin-session'
import { getApiUrl, apiFetch } from '@/lib/api'
import heroImage from '@/assets/hero-food.jpg'

const StaffLogin: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/staff'
  const adminToken = getAdminToken()
  const isAdmin = adminToken && isAdminSessionValid()

  const passwordRequirements = [
    {
      label: 'At least 8 characters',
      validate: (value: string) => value.length >= 8,
    },
    {
      label: 'One uppercase letter',
      validate: (value: string) => /[A-Z]/.test(value),
    },
    {
      label: 'One lowercase letter',
      validate: (value: string) => /[a-z]/.test(value),
    },
    {
      label: 'One number',
      validate: (value: string) => /[0-9]/.test(value),
    },
    {
      label: 'One special character (!@#$%^&*)',
      validate: (value: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value),
    },
  ]
  const passwordIssues = passwordRequirements.filter((requirement) => !requirement.validate(password))
  const isPasswordValid = passwordIssues.length === 0

  const formatStaffErrorMessage = (raw?: string) => {
    const trimmed = raw?.trim() || ''
    const normalized = trimmed.toLowerCase()

    if (!trimmed) {
      return 'Authentication failed. Please confirm your username and password and try again.'
    }
    if (normalized.includes('invalid credential')) {
      return 'Authentication failed. Please confirm your username and password and try again.'
    }
    if (normalized.includes('no token returned')) {
      return 'Authentication failed. The server did not return a valid session token. Please try again or contact support.'
    }
    if (normalized.includes('connection error') || normalized.includes('failed to fetch')) {
      return 'Connection error. Please verify your network and try again.'
    }
    return trimmed
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    const usernameTrimmed = username.trim()
    const passwordTrimmed = password.trim()

    if (!usernameTrimmed || !passwordTrimmed) {
      setError('Username and password are required. Please enter your credentials to continue.')
      setLoading(false)
      return
    }

    if (!isPasswordValid) {
      setError('Your password must meet the displayed requirements before signing in. Please review the password rules and try again.')
      setLoading(false)
      return
    }

    try {
      try {
        const data: any = await apiFetch('/payments/staff/signin/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameTrimmed, password: passwordTrimmed }),
        })

        if (!data || !data.token) {
          setError(data?.error || 'Authentication failed. Please confirm your username and password and try again.')
        } else {
          const expiresAt = data.expires_at || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
          setStaffTokenWithId(data.token, data.name, String(data.role || ''), expiresAt, data.id)
          navigate(from, { replace: true })
        }
      } catch (err: any) {
        const body = err?.body
        const message = typeof body === 'string'
          ? body
          : body?.error || err?.message || 'Connection Error: Please check if the server is running.'
        setError(formatStaffErrorMessage(message))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(formatStaffErrorMessage(message === 'Failed to fetch'
        ? 'Connection Error: Backend server unreachable or CORS blocked.'
        : 'Connection Error: Please check if the server is running.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 -z-10" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0 -z-10 bg-black/40 backdrop-blur-sm" />
      
      <div className="w-full max-w-md bg-slate-900/90 p-8 rounded-3xl shadow-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h1 className="font-display text-3xl text-slate-100">Staff Portal</h1>
                <p className="text-sm text-slate-400 mt-1">Access your operational workstation.</p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 text-orange-500">
                <ShieldCheck size={28} />
            </div>
        </div>

        {isAdmin && (
          <div className="mb-8 p-1 bg-orange-500/5 rounded-2xl border border-orange-500/10">
            <Link 
              to="/admin/employees" 
              className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 rounded-xl text-sm font-bold border border-orange-500/20 transition-all group"
            >
              <Users size={20} className="group-hover:scale-110 transition-transform" />
              <span>Admin: Register New Staff</span>
            </Link>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 pr-12 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {passwordRequirements.map((requirement) => {
              const valid = requirement.validate(password)
              if (valid) return null; // Disappear if condition is met
              return (
                <div key={requirement.label} className="flex items-center gap-2">
                  <span className="text-red-500">✖</span>
                  <span>{requirement.label}</span>
                </div>
              )
            })}
          </div>


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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white rounded-2xl px-4 py-4 font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Workstation'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-start items-center">
          <Link to="/" className="text-xs font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors uppercase tracking-widest">
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default StaffLogin