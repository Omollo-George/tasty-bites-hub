import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { setAdminToken } from '@/lib/admin-session'
import { getApiUrl } from '@/lib/api'
import heroImage from '@/assets/hero-food.jpg'; // Use the home section image
 
const AdminSignup: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/admin'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const endpoint = getApiUrl('/payments/admin/signup/');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      // Safely validate JSON response to prevent "Unexpected end of JSON input"
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorBody = await response.text();
        console.error('[AdminSignup] Expected JSON but received:', response.status, errorBody.substring(0, 200));
        throw new Error(`Connection Error (${response.status}): The server returned an invalid format. Check if the backend is running.`);
      }

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to create account')
      } else {
        setAdminToken(data.token)
        navigate(from, { replace: true })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === 'Failed to fetch' ? 'Connection Error: Backend server unreachable or CORS blocked.' : msg);
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
        <h1 className="font-display text-3xl mb-4">Admin Sign Up</h1>
        <p className="text-sm text-muted-foreground mb-6">Create an admin account for the dashboard.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm text-muted-foreground">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="admin"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="••••••••"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white rounded-full px-4 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>
        <p className="text-sm text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/admin/login" className="text-orange-500 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default AdminSignup
