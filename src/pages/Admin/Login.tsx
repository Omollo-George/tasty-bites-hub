import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { setAdminSessionExpiry, setAdminToken, getAdminToken, isAdminSessionValid } from '@/lib/admin-session'

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/admin'

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

    try {
      const payload = { username: username.trim(), password: password.trim() }
      console.debug('[AdminLogin] signin payload', payload)

      const response = await fetch('/api/payments/admin/signin/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      console.debug('[AdminLogin] signin response', response.status, data)

      if (!response.ok) {
        setError(data.error || 'Failed to sign in')
        setLockoutSeconds(data.lockout_seconds || 0)
        if (data.attempts_left !== undefined && data.lockout_seconds === undefined) {
          setError(`${data.error || 'Invalid credentials.'} ${data.attempts_left} attempt${data.attempts_left === 1 ? '' : 's'} remaining.`)
        }
      } else {
        setLockoutSeconds(0)
        setAdminToken(data.token)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-800">
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
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {passwordRequirements.map((requirement) => {
              const valid = requirement.validate(password)
              return (
                <div key={requirement.label} className="flex items-center gap-2">
                  <span className={valid ? 'text-green-500' : 'text-red-500'}>
                    {valid ? '✔' : '✖'}
                  </span>
                  <span>{requirement.label}</span>
                </div>
              )
            })}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
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
      </div>
    </div>
  )
}

export default AdminLogin
