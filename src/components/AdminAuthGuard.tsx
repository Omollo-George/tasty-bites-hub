import React, { useEffect, useState, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  clearAdminSession,
  getAdminSessionExpiry,
  getAdminToken,
  isAdminSessionValid,
  setAdminSessionExpiry,
  touchAdminSession,
} from '@/lib/admin-session'

const WARNING_THRESHOLD_MS = 60 * 1000

const AdminAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0)
  const lastServerTouch = useRef(Date.now())
  const location = useLocation()

  // HOOK 1: Verify token on mount
  useEffect(() => {
    const token = getAdminToken()
    if (!token || !isAdminSessionValid()) {
      clearAdminSession()
      setAuthorized(false)
      setChecking(false)
      return
    }

    const verify = async () => {
      try {
        const res = await fetch('/api/payments/admin/me/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (res.ok) {
          setAuthorized(true)
          setAdminSessionExpiry()
        } else {
          clearAdminSession()
          setAuthorized(false)
        }
      } catch (err) {
        clearAdminSession()
        setAuthorized(false)
      } finally {
        setChecking(false)
      }
    }

    verify()
  }, [])

  // HOOK 2: Session timeout logic - MUST be before any returns
  useEffect(() => {
    if (!authorized || checking) return

    const logout = async () => {
      const token = getAdminToken()
      if (token) {
        await fetch('/api/payments/admin/signout/', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {})
      }
      clearAdminSession()
      setAuthorized(false)
    }

    const resetExpiry = () => {
      const now = Date.now()
      if (isAdminSessionValid()) {
        touchAdminSession()
        setShowTimeoutWarning(false)
        
        // Throttle server-side updates to once every 5 minutes
        if (now - lastServerTouch.current > 5 * 60 * 1000) {
          lastServerTouch.current = now
          const token = getAdminToken()
          fetch('/api/payments/admin/touch/', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {})
        }
      }
    }

    const updateCountdown = () => {
      const expiry = getAdminSessionExpiry()
      const remainingMs = Math.max(expiry - Date.now(), 0)
      setTimeRemainingSeconds(Math.ceil(remainingMs / 1000))
      setShowTimeoutWarning(remainingMs <= WARNING_THRESHOLD_MS && remainingMs > 0)
      if (remainingMs === 0) {
        logout()
      }
    }

    updateCountdown();
    const countdownInterval = window.setInterval(updateCountdown, 1000)

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ]

    activityEvents.forEach((eventName) => 
      window.addEventListener(eventName, resetExpiry)
    )

    return () => {
      clearInterval(countdownInterval)
      activityEvents.forEach((eventName) => 
        window.removeEventListener(eventName, resetExpiry)
      )
    };
  }, [authorized, checking]);

  // ALL RETURNS GO AFTER HOOKS
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-base text-slate-400 animate-pulse">Checking admin access…</p>
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  const staySignedIn = () => {
    const token = getAdminToken()
    fetch('/api/payments/admin/touch/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {})
    touchAdminSession()
    setShowTimeoutWarning(false)
  }

  return (
    <>
      {showTimeoutWarning && (
        <div className="fixed bottom-4 left-1/2 z-[9999] w-[min(95vw,42rem)] -translate-x-1/2 rounded-2xl border border-amber-900/50 bg-slate-900 px-4 py-3 shadow-lg shadow-black/40 text-slate-100 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Session expiring soon</p>
              <p className="text-sm text-slate-400">
                You will be logged out in {timeRemainingSeconds} second{timeRemainingSeconds === 1 ? '' : 's'} unless you continue using the admin dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={staySignedIn}
              className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Stay signed in
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  )
}

export default AdminAuthGuard