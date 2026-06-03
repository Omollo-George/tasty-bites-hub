import React, { useEffect, useState } from 'react'
import { getApiUrl } from '@/lib/api'

type Employee = {
  id: number
  name: string
  role: string
  phone: string
  email: string
  salary: number
  status: string
  account_number?: string
  joined_at: string
}

const AdminEmployees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newEmp, setNewEmp] = useState({ name: '', role: 'Waiter', phone: '', email: '', salary: 0, account_number: '' })
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const adminToken = localStorage.getItem('admin_token') || '';

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

  useEffect(() => { fetchEmployees() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(getApiUrl('/payments/admin/employees/'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}` 
        },
        body: JSON.stringify(newEmp)
      })

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`Server Error (${res.status}): Invalid response format.`);
      }

      const data = await res.json()
      if (res.ok) {
        setIsAdding(false)
        setNewEmp({ name: '', role: 'Waiter', phone: '', email: '', salary: 0, account_number: '' })
        fetchEmployees()
      } else {
        alert(data.error || 'Failed to add employee')
      }
    } catch (err) {
      alert('Failed to add employee')
    }
  }

  const deleteEmployee = async (id: number) => {
    if (!window.confirm('Remove this employee?')) return
    try {
      const res = await fetch(getApiUrl(`/payments/admin/employees/${id}/`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      if (res.ok) {
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
        alert('Email sent successfully!')
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
    const message = window.prompt(`Send an email to ${selectedIds.length} selected employees:\n\nEnter your message:`)
    if (!message) return

    try {
      const res = await fetch(getApiUrl(`/payments/admin/employees/bulk-email/`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}` 
        },
        body: JSON.stringify({ employee_ids: selectedIds, message })
      })

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid response from server.");
      }

      const data = await res.json()
      if (res.ok) {
        alert(`Email sent successfully to ${data.count} employees!`)
        setSelectedIds([])
      } else {
        alert(data.error || 'Failed to send bulk email.')
      }
    } catch (err) {
      alert('Error connecting to email service.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Personnel</p>
          <h2 className="font-display text-3xl">Employees Management</h2>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search by name or role..."
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 w-64 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
            onClick={() => setIsAdding(!isAdding)}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md hover:bg-orange-600 transition-all active:scale-95 whitespace-nowrap"
          >
            {isAdding ? 'Cancel' : 'Add Employee'}
          </button>
        </div>
      </div>

      {isAdding && (
        <section className="bg-slate-700 p-8 rounded-2xl shadow-lg border border-slate-600/60 animate-in fade-in slide-in-from-top-4">
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
            <button type="submit" className="md:col-span-3 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
              Save Employee
            </button>
          </form>
        </section>
      )}

      <div className="bg-slate-700 rounded-2xl shadow-sm overflow-hidden border border-slate-600/60">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-800">
            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
              <th className="px-6 py-4 w-10">
                <input 
                  type="checkbox" 
                  checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                />
              </th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Salary</th>
              <th className="px-6 py-4">Account No.</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-600">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading data...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No employees found.</td></tr>
            ) : (
              filteredEmployees
                .map(emp => (
                <tr key={emp.id} className="hover:bg-slate-600 transition-colors group">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                      className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                    />
                  </td>
                  <td className="px-6 py-4 font-medium">{emp.name}</td>
                  <td className="px-6 py-4">
                    <span className="bg-orange-900/30 text-orange-400 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border border-orange-500/20">
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div>{emp.phone}</div>
                    <div className="text-xs text-slate-400">{emp.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono">
                    KES {emp.salary.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-400">
                    {emp.account_number || '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => sendEmail(emp)}
                        className="text-orange-500 hover:text-orange-400 text-sm font-semibold"
                      >
                        Email
                      </button>
                      <button 
                        onClick={() => sendWhatsApp(emp)}
                        className="text-emerald-500 hover:text-emerald-400 text-sm font-semibold"
                      >
                        WhatsApp
                      </button>
                      <button 
                        onClick={() => deleteEmployee(emp.id)}
                        className="text-slate-400 hover:text-red-500 text-sm font-semibold transition-colors"
                      >
                        Remove
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
  )
}

export default AdminEmployees