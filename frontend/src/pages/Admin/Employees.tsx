/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react'
import { getApiUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'
import { getCachedEmployees, preloadEmployeesData, clearEmployeesCache } from '@/lib/admin-data-cache'

type Employee = {
  id: number
  name: string
  role: string
  username?: string
  phone: string
  email: string
  salary: number
  status: string
  account_number?: string
  special_id?: string
  joined_at: string
  document_url?: string | null
  document_name?: string | null
}

const AdminEmployees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newEmp, setNewEmp] = useState({ name: '', role: 'Waiter', phone: '', email: '', salary: 0, account_number: '', special_id: '', username: '', password: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [existingDocumentName, setExistingDocumentName] = useState<string | null>(null)
  const [removeDocument, setRemoveDocument] = useState(false)
  const [togglingIds, setTogglingIds] = useState<number[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const adminToken = getAdminToken() || '';

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

  const passwordIssues = passwordRequirements.filter((requirement) => !requirement.validate(newEmp.password))
  const isPasswordValid = passwordIssues.length === 0

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl('/payments/admin/employees/'), {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid response");
      const data = await res.json()
      if (res.ok) setEmployees(data.employees || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Try to use cached data first for instant display
    const cachedData = getCachedEmployees()
    if (cachedData) {
      setEmployees(cachedData)
      setLoading(false)
      // Refresh in background
      fetchEmployees()
    } else {
      // No cache, fetch normally
      fetchEmployees()
    }
    // Preload for next visit
    preloadEmployeesData()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate password only when the user has entered one.
    if (newEmp.password && !isPasswordValid) {
      alert('Please ensure the workstation password meets all security requirements.')
      return
    }

    try {
      const isUpdating = editingId !== null
      const url = isUpdating ? getApiUrl(`/payments/admin/employees/${editingId}/`) : getApiUrl('/payments/admin/employees/')
      const formData = new FormData()
      formData.append('name', newEmp.name)
      formData.append('role', newEmp.role)
      formData.append('phone', newEmp.phone)
      formData.append('email', newEmp.email)
      if (newEmp.username.trim()) {
        formData.append('username', newEmp.username.trim())
      }
      formData.append('salary', String(newEmp.salary))
      if (newEmp.account_number.trim()) {
        formData.append('account_number', newEmp.account_number.trim())
      }
      if (newEmp.special_id.trim()) {
        formData.append('special_id', newEmp.special_id.trim())
      }
      if (newEmp.password) {
        formData.append('password', newEmp.password)
      }
      if (selectedFile) {
        formData.append('document', selectedFile)
      }
      if (removeDocument) {
        formData.append('remove_document', 'true')
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        body: formData
      })

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`Server Error (${res.status}): Invalid response format.`);
      }

      const data = await res.json()
      if (res.ok) {
        setIsAdding(false)
        setEditingId(null)
        setSelectedFile(null)
        setExistingDocumentName(null)
        setRemoveDocument(false)
        setNewEmp({ name: '', role: 'Waiter', phone: '', email: '', salary: 0, account_number: '', username: '', password: '' })
        clearEmployeesCache()
        fetchEmployees()
        alert(isUpdating ? 'Employee updated!' : 'Employee added!')
      } else {
        alert(data.error || 'Operation failed')
      }
    } catch (err) {
      alert('Connection error')
    }
  }

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setNewEmp({
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      email: emp.email,
      salary: emp.salary,
      account_number: emp.account_number || '',
      special_id: emp.special_id || '',
      username: emp.username || '',
      password: '' // Keep empty unless changing
    })
    setSelectedFile(null)
    setExistingDocumentName(emp.document_name || null)
    setRemoveDocument(false)
    setIsAdding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteEmployee = async (id: number) => {
    if (!window.confirm('Remove this employee?')) return
    try {
      const res = await fetch(getApiUrl(`/payments/admin/employees/${id}/`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      if (res.ok) {
        clearEmployeesCache()
        fetchEmployees()
      } else {
        if (!res.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Server returned non-JSON error page.");
        }
        const data = await res.json()
        alert(data.error || 'Delete failed')
      }
    } catch (err) {
      alert('Delete failed')
    }
  }

  const sendEmail = async (emp: Employee) => {
    if (!emp.email) {
      alert('This employee does not have an email address.')
      return
    }

    const message = window.prompt(`Send an email to ${emp.name}:\n\nEnter your message:`)
    if (!message) return

    try {
      const res = await fetch(getApiUrl(`/payments/admin/employees/${emp.id}/email/`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}` 
        },
        body: JSON.stringify({ message })
      })

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid response from server.");
      }

      const data = await res.json()
      if (res.ok) {
        if (data.mode === 'console') {
          alert('Email queued to console backend, not actually sent. Configure SMTP if you want real delivery.')
        } else {
          alert(`Email sent successfully! mode=${data.mode || 'unknown'} sent=${data.sent ?? 1}`)
        }
      } else {
        alert(data.error || 'Failed to send email. Ensure server SMTP is configured.')
      }
    } catch (err) {
      alert('Error connecting to email service.')
    }
  }

  const sendWhatsApp = (emp: Employee) => {
    if (!emp.phone) {
      alert('This employee does not have a phone number.')
      return
    }

    const content = window.prompt(`WhatsApp Message to ${emp.name}:\n(Greetings and name will be added automatically)`)
    if (!content) return

    const message = `Hello ${emp.name}, ${content}`
    const encodedMsg = encodeURIComponent(message)
    // Normalize phone for WhatsApp wa.me link (targeting Kenyan 254 code)
    let phone = emp.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '254' + phone.substring(1)
    if (phone.length === 9) phone = '254' + phone

    window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank')
  }

  const handleBulkWhatsApp = () => {
    if (selectedIds.length === 0) return
    const content = window.prompt(`Send WhatsApp to ${selectedIds.length} employees:\n(Individual greetings will be added)`)
    if (!content) return

    const selectedEmployees = employees.filter(e => selectedIds.includes(e.id))
    
    selectedEmployees.forEach((emp, index) => {
      if (!emp.phone) return
      const message = `Hello ${emp.name}, ${content}`
      const encodedMsg = encodeURIComponent(message)
      let phone = emp.phone.replace(/\D/g, '')
      if (phone.startsWith('0')) phone = '254' + phone.substring(1)
      if (phone.length === 9) phone = '254' + phone
      
      // Use a slight delay to help the browser manage multiple window requests
      setTimeout(() => {
        window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank')
      }, index * 600)
    })
    setSelectedIds([])
  }

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id))
    }
  }

  const handleBulkEmail = async () => {
    if (selectedIds.length === 0) return
    const selectedEmployees = employees.filter(e => selectedIds.includes(e.id))
    const emailEmployees = selectedEmployees.filter(e => e.email && e.email.trim())

    if (emailEmployees.length === 0) {
      alert('No selected employees have valid email addresses.')
      return
    }

    const message = window.prompt(`Send an email to ${emailEmployees.length} of ${selectedEmployees.length} selected employees with email addresses:\n\nEnter your message:`)
    if (!message) return

    try {
      const res = await fetch(getApiUrl(`/payments/admin/employees/bulk-email/`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}` 
        },
        body: JSON.stringify({ employee_ids: emailEmployees.map((e) => e.id), message })
      })

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid response from server.");
      }

      const data = await res.json()
      if (res.ok && typeof data.count === 'number' && data.count > 0) {
        alert(`Email sent successfully to ${data.count} employees!`)
        setSelectedIds([])
      } else {
        alert(data.error || 'Failed to send bulk email. No emails were delivered.')
      }
    } catch (err) {
      alert('Error connecting to email service.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Personnel</p>
          <h2 className="font-display text-3xl">Employees Management</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <input
              type="text"
              placeholder="Search by name or role..."
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={handleBulkEmail}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-md hover:bg-blue-700 transition-all active:scale-95 whitespace-nowrap"
              >
                Email Selected ({selectedIds.length})
              </button>
              <button 
                onClick={handleBulkWhatsApp}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-md hover:bg-emerald-700 transition-all active:scale-95 whitespace-nowrap"
              >
                WhatsApp Selected ({selectedIds.length})
              </button>
            </div>
          )}
          <button 
            onClick={() => {
                setIsAdding(!isAdding)
                setEditingId(null)
                setNewEmp({ name: '', role: 'Waiter', phone: '', email: '', salary: 0, account_number: '', special_id: '', username: '', password: '' })
                setSelectedFile(null)
                setExistingDocumentName(null)
                setRemoveDocument(false)
            }}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md hover:bg-orange-600 transition-all active:scale-95 whitespace-nowrap"
          >
            {isAdding ? 'Cancel' : 'Register New Employee'}
          </button>
        </div>
      </div>

      {isAdding && (
        <section className="bg-slate-700 p-8 rounded-2xl shadow-lg border border-slate-600/60 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-xl font-display text-white mb-6">{editingId ? 'Edit Employee Details' : 'Registration Form'}</h3>
          <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label>
              <input 
                required
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                value={newEmp.name}
                onChange={e => setNewEmp({...newEmp, name: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Role</label>
              <select 
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                value={newEmp.role}
                onChange={e => setNewEmp({...newEmp, role: e.target.value})}
              >
                <option>Waiter</option>
                <option>Chef</option>
                <option>Manager</option>
                <option>Cashier</option>
                <option>Cleaner</option>
              </select>
            </div>
            <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-bold text-orange-400 uppercase">Workstation Username</label>
                <input 
                    className="w-full rounded-lg border border-orange-500/30 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 outline-none"
                    value={newEmp.username}
                    onChange={e => setNewEmp({...newEmp, username: e.target.value})}
                    placeholder="e.g. john_waiter"
                />
            </div>
            <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-orange-400 uppercase">{editingId ? 'Reset Workstation Password' : 'Workstation Password'}</label>
                <input 
                    type="password"
                    className="w-full rounded-lg border border-orange-500/30 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 outline-none"
                    value={newEmp.password}
                    onChange={e => setNewEmp({...newEmp, password: e.target.value})}
                    placeholder={editingId ? "Leave blank to keep current" : "••••••••"}
                />
                {(newEmp.password || editingId === null) && (
                    <div className="mt-2 space-y-1 text-[10px] text-slate-400">
                        {passwordRequirements.map((requirement) => {
                            const valid = requirement.validate(newEmp.password)
                            if (valid) return null; // Disappear if condition is met
                            return (
                                <div key={requirement.label} className="flex items-center gap-2">
                                    <span className="text-red-500">✖</span>
                                    <span>{requirement.label}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Salary (KES)</label>
              <input 
                type="number"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                value={newEmp.salary}
                onChange={e => setNewEmp({...newEmp, salary: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Phone</label>
              <input 
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                value={newEmp.phone}
                onChange={e => setNewEmp({...newEmp, phone: e.target.value})}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Email</label>
              <input 
                type="email"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                value={newEmp.email}
                onChange={e => setNewEmp({...newEmp, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Bank Account</label>
              <input 
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                value={newEmp.account_number}
                onChange={e => setNewEmp({...newEmp, account_number: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Waiter Special ID</label>
              <input 
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                placeholder="e.g. W001, W002"
                value={newEmp.special_id}
                onChange={e => setNewEmp({...newEmp, special_id: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Employee Document (PDF)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white"
              />
              {existingDocumentName && !selectedFile && (
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>Current file: {existingDocumentName}</span>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-orange-300">
                    <input
                      type="checkbox"
                      checked={removeDocument}
                      onChange={e => setRemoveDocument(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-700 text-orange-500"
                    />
                    Remove existing document
                  </label>
                </div>
              )}
            </div>
            <button type="submit" className="md:col-span-3 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
              {editingId ? 'Update Record' : 'Create Record'}
            </button>
          </form>
        </section>
      )}

      <div className="bg-slate-700 rounded-2xl shadow-sm overflow-hidden border border-slate-600/60">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left border-collapse text-sm">
            <thead className="bg-slate-800">
              <tr className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <th className="px-3 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 w-4 h-4"
                />
              </th>
              <th className="px-3 py-3 min-w-[130px]">Name</th>
              <th className="px-3 py-3 min-w-[90px]">Role</th>
              <th className="px-3 py-3 min-w-[100px]">Special ID</th>
              <th className="px-3 py-3 min-w-[140px]">Phone</th>
              <th className="px-3 py-3 min-w-[90px]">Shift</th>
              <th className="px-3 py-3 min-w-[100px] text-right">Salary</th>
              <th className="px-3 py-3 min-w-[120px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-600">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-muted-foreground">Loading data...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-muted-foreground">No employees found.</td></tr>
            ) : (
              filteredEmployees
                .map(emp => (
                <tr key={emp.id} className="hover:bg-slate-600 transition-colors group">
                  <td className="px-3 py-3">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                      className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-sm">
                    <div>{emp.name}</div>
                    {emp.username && <div className="text-xs text-slate-500 font-mono">@{emp.username}</div>}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <span className="bg-orange-900/30 text-orange-400 px-2 py-1 rounded text-xs font-bold uppercase border border-orange-500/20">
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {emp.special_id ? (
                      <span className="bg-slate-600 text-emerald-300 px-2 py-1 rounded text-xs font-bold border border-emerald-500/30">
                        {emp.special_id}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="font-mono text-slate-200">{emp.phone}</div>
                    <div className="text-xs text-slate-400 truncate">{emp.email}</div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {emp.status === 'on_shift' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">On</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-800/30 text-slate-400 text-xs font-semibold border border-slate-700">Off</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm font-mono text-right">
                    KES {(emp.salary / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2 text-sm">
                      <button 
                        onClick={() => startEdit(emp)}
                        className="text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors font-semibold"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button 
                        onClick={() => sendEmail(emp)}
                        className="text-orange-400 hover:text-orange-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors font-semibold"
                        title="Email"
                      >
                        ✉
                      </button>
                      <button 
                        onClick={() => sendWhatsApp(emp)}
                        className="text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors font-semibold"
                        title="WhatsApp"
                      >
                        💬
                      </button>
                      {emp.document_url && (
                        <a
                          href={emp.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:text-sky-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors font-semibold"
                          title="Download document"
                        >
                          ↓
                        </a>
                      )}
                      <button
                        onClick={async () => {
                          const newStatus = emp.status === 'on_shift' ? 'active' : 'on_shift'
                          setTogglingIds(prev => [...prev, emp.id])
                          try {
                            const res = await fetch(getApiUrl(`/payments/admin/employees/${emp.id}/`), {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus }),
                            })
                            if (res.ok) {
                              // update locally to avoid refetching entire list (prevents blink)
                              setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e))
                            } else {
                              const data = await res.json().catch(() => ({}))
                              alert(data.error || 'Failed to update shift status')
                            }
                          } catch (err) {
                            alert('Failed to update shift status')
                          } finally {
                            setTogglingIds(prev => prev.filter(i => i !== emp.id))
                          }
                        }}
                        disabled={togglingIds.includes(emp.id)}
                        className={`text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors font-semibold ${togglingIds.includes(emp.id) ? 'opacity-60 cursor-wait' : ''}`}
                        title={emp.status === 'on_shift' ? 'Remove from shift' : 'Add to shift'}
                      >
                        {togglingIds.includes(emp.id) ? '…' : (emp.status === 'on_shift' ? '⊘' : '⊕')}
                      </button>
                      <button 
                        onClick={() => deleteEmployee(emp.id)}
                        className="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors font-semibold"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
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

export default AdminEmployees