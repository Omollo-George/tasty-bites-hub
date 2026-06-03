import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminToken } from '@/lib/admin-session'
import { getApiUrl } from '@/lib/api'

interface AdminUser {
  username: string
  created_at?: string
}

interface SessionLog {
  username: string
  login_time: string
  logout_time: string | null
}

const AdminSettings: React.FC = () => {
  const [baseCurrency] = useState('KES')
  const [displayCurrency] = useState('KES')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      navigate('/admin/login')
      return
    }

    const loadConfig = fetch(getApiUrl('/payments/config/'))
      .then((res) => res.headers.get("content-type")?.includes("application/json") ? res.json() : Promise.reject("Invalid format"))
      .then((data) => {
        // No longer loading default_phone or conversion_rate
      })

    const loadUsers = fetch(getApiUrl('/payments/admin/users/'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.headers.get("content-type")?.includes("application/json") ? res.json() : Promise.reject("Invalid format"))
      .then((data) => setUsers(data.users || []))
      .catch((err) => console.error('Failed to load admin users', err))

    const loadLogs = fetch(getApiUrl('/payments/admin/session-logs/'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.headers.get("content-type")?.includes("application/json") ? res.json() : Promise.reject("Invalid format"))
      .then((data) => setLogs(data.logs || []))

    Promise.all([loadConfig, loadUsers, loadLogs])
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [navigate])

  const saveSettings = async () => {
    const token = getAdminToken()
    if (!token) {
      navigate('/admin/login')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(getApiUrl('/payments/admin/settings/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base_currency: 'KES',
          display_currency: 'KES',
        }),
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid server response.");
      }

      const data = await response.json()
      if (!response.ok) {
        setMessage(data.error || 'Failed to save settings')
      } else {
        setMessage('Settings saved successfully.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setMessage(message)
    } finally {
      setSaving(false)
    }
  }

  const addUser = async () => {
    const token = getAdminToken()
    if (!token) {
      navigate('/admin/login')
      return
    }

    setUserMessage('')
    setSaving(true)

    try {
      const response = await fetch(getApiUrl('/payments/admin/users/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid server response.");
      }

      const data = await response.json()
      if (!response.ok) {
        setUserMessage(data.error || 'Failed to create user')
      } else {
        setUsers((current) => [...current, { username: data.username }])
        setNewUsername('')
        setNewPassword('')
        setUserMessage('User created successfully.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setUserMessage(`Unable to create user: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async (username: string) => {
    const token = getAdminToken()
    if (!token) {
      navigate('/admin/login')
      return
    }

    setUserMessage('')
    setSaving(true)

    try {
      const response = await fetch(getApiUrl(`/payments/admin/users/${encodeURIComponent(username)}/`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid server response.");
      }

      const data = await response.json()
      if (!response.ok) {
        setUserMessage(data.error || 'Failed to remove user')
      } else {
        setUsers((current) => current.filter((user) => user.username !== username))
        setUserMessage('User removed successfully.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setUserMessage(`Unable to remove user: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-slate-400">Settings</p>
          <h2 className="font-display text-3xl text-slate-100">Admin Settings</h2>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-orange-500 text-white rounded-full px-5 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        {loading ? (
          <p className="text-slate-400">Loading settings…</p>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <label className="grid gap-2">
              <span className="text-sm text-slate-400">Currency</span>
              <input
                type="text"
                value={baseCurrency}
                disabled
                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-500"
              />
            </label>
          </div>
        )}
        {message ? <p className="mt-4 text-sm text-slate-400">{message}</p> : null}
      </div>
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-slate-400">Admin User Management</p>
            <h3 className="font-semibold text-xl text-slate-100">Create a new admin user</h3>
          </div>
        </div>

        <div className="grid gap-6">
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Username</span>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100"
              placeholder="new-admin"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100"
              placeholder="••••••••"
            />
          </label>
          <button
            type="button"
            onClick={addUser}
            disabled={saving || !newUsername || !newPassword}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-white font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Processing…' : 'Create Admin User'}
          </button>
          {userMessage ? <p className="text-sm text-slate-400">{userMessage}</p> : null}
        </div>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <div className="mb-4">
          <p className="text-sm text-slate-400">Existing Admin Users</p>
          <h3 className="font-semibold text-xl text-slate-100">Current accounts</h3>
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-slate-400">No admin users found yet.</p>
        ) : (
          <ul className="space-y-3">
            {users.map((user) => (
              <li key={user.username} className="rounded-xl border border-slate-700 p-4 bg-slate-900/50 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-200">{user.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeUser(user.username)}
                  disabled={saving}
                  className="rounded-full border border-red-900/50 px-4 py-2 text-red-400 hover:bg-red-950/30 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-slate-800 p-6 rounded-xl shadow-card border border-slate-700">
        <div className="mb-4">
          <p className="text-sm text-slate-400">Security Audit</p>
          <h3 className="font-semibold text-xl text-slate-100">Session History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Logged In</th>
                <th className="px-4 py-3">Logged Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {logs.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No session logs found.</td></tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-4 font-medium text-slate-200">{log.username}</td>
                    <td className="px-4 py-4 text-sm text-slate-400">
                      {new Date(log.login_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-400">
                      {log.logout_time ? new Date(log.logout_time).toLocaleString() : <span className="text-emerald-500 font-semibold italic">Active Now</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
