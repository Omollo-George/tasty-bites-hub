import React, { useEffect, useState } from 'react'
import { DEFAULT_MENU_ITEMS as CUSTOMER_DEFAULT_MENU_ITEMS } from '@/components/MenuSection'
import { getApiUrl } from '@/lib/api'

type TableItem = {
  id: number
  number: string
  name: string
  status: string
}

type QueueItem = {
  order_id: string
  table: string
  items: Array<{ name: string; quantity: number; modifiers: string[] }>
  created_at: string
  status: string
  phone: string
  total_amount: number
  split_count: number
}

type MenuItemType = {
  id: number
  name: string
  price: number
  category: string
  description: string
  food_cost: number
  popular: boolean
  spicy: boolean
}

const AdminMenu: React.FC = () => {
  const [tables, setTables] = useState<TableItem[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([])
  const [tableNumber, setTableNumber] = useState('')
  const [tableName, setTableName] = useState('')
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    food_cost: '',
    popular: false,
    spicy: false,
  })
  const [editingItem, setEditingItem] = useState<MenuItemType | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  const [receiptText, setReceiptText] = useState<string | null>(null)
  const [menuSearch, setMenuSearch] = useState('')
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  const fetchTables = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/pos/tables/'))
      if (!response.headers.get("content-type")?.includes("application/json")) return;
      const data = await response.json()
      setTables(data.tables || [])
    } catch (error) {
      console.error(error)
    }
  }

  const fetchQueue = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/kds/queue/'))
      if (!response.headers.get("content-type")?.includes("application/json")) return;
      const data = await response.json()
      setQueue(data.queue || [])
    } catch (error) {
      console.error(error)
    }
  }

  const fetchMenuItems = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/menu-items/'))
      if (!response.headers.get("content-type")?.includes("application/json")) return;
      const data = await response.json()
      if (response.ok && Array.isArray(data.menu_items)) {
        setMenuItems(data.menu_items)
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchTables()
    fetchQueue()
    fetchMenuItems()
  }, [])

  const createTable = async () => {
    if (!tableNumber.trim()) return

    try {
      const response = await fetch(getApiUrl('/payments/pos/tables/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ number: tableNumber.trim(), name: tableName.trim() }),
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned invalid format.");
      }

      const data = await response.json()
      if (response.ok) {
        setTableNumber('')
        setTableName('')
        fetchTables()
      } else {
        alert(data.error || 'Failed to create table')
      }
    } catch (error) {
      console.error(error)
      alert('Table creation failed')
    }
  }

  const deleteTable = async (id: number) => {
    if (!window.confirm('Delete this table?')) return

    try {
      const response = await fetch(getApiUrl(`/payments/pos/tables/${id}/`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned invalid format.");
      }

      const data = await response.json()
      if (response.ok) {
        fetchTables()
      } else {
        alert(data.error || 'Failed to delete table')
      }
    } catch (error) {
      console.error(error)
      alert('Table deletion failed')
    }
  }

  const markReady = async (orderId: string) => {
    try {
      const response = await fetch(getApiUrl(`/payments/kds/complete/${encodeURIComponent(orderId)}/`), {
        method: 'POST',
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned invalid format.");
      }

      const data = await response.json()
      if (response.ok) {
        fetchQueue()
      } else {
        alert(data.error || 'Failed to update order status')
      }
    } catch (error) {
      console.error(error)
      alert('Unable to update order status')
    }
  }

  const handleCreateItem = async () => {
    if (!newItem.name || !newItem.category || !newItem.price) {
      alert('Name, Category, and Price are required.')
      return
    }
    try {
      const response = await fetch(getApiUrl('/payments/menu-items/create/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          ...newItem,
          price: Number(newItem.price),
          food_cost: Number(newItem.food_cost || 0),
        }),
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned invalid format.");
      }

      const data = await response.json()
      if (response.ok) {
        setNewItem({ name: '', price: '', category: '', description: '', food_cost: '', popular: false, spicy: false })
        fetchMenuItems()
      } else {
        alert(data.error || 'Failed to create menu item')
      }
    } catch (error) {
      alert('Error creating menu item')
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return
    try {
      const response = await fetch(getApiUrl(`/payments/menu-items/${editingItem.id}/update-price/`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          ...editingItem,
          price: Number(editingItem.price),
          food_cost: Number(editingItem.food_cost),
        }),
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned invalid format.");
      }

      if (response.ok) {
        setEditingItem(null)
        fetchMenuItems()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update item')
      }
    } catch (error) {
      alert('Error updating item')
    }
  }

  const deleteMenuItem = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this menu item? This cannot be undone.')) return

    try {
      const response = await fetch(getApiUrl(`/payments/menu-items/${id}/delete/`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })

      if (!response.headers.get("content-type")?.includes("application/json") && !response.ok) {
        throw new Error("Server returned invalid format.");
      }

      if (response.ok) {
        fetchMenuItems()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete item')
      }
    } catch (error) {
      alert('Error deleting menu item')
    }
  }

  const clearAllData = async () => {
    if (!window.confirm('WARNING: This will delete ALL orders, transactions, wastage logs, tables, and menu items. This cannot be undone. Proceed?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(getApiUrl('/payments/admin/clear/'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      if (response.ok) {
        alert('All operational data has been cleared.')
        // Refresh with seed=0 to see a truly empty menu
        const menuRes = await fetch(getApiUrl('/payments/menu-items/?seed=0'))

        if (!menuRes.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Invalid response from server.");
        }

        const menuData = await menuRes.json()
        setMenuItems(menuData.menu_items || [])
        fetchTables()
        fetchQueue()
      } else {
        alert('Failed to clear data.')
      }
    } catch (error) {
      alert('Error clearing data.')
    } finally {
      setLoading(false)
    }
  }

  const printReceipt = async (orderId: string) => {
    try {
      const response = await fetch(getApiUrl(`/payments/pos/receipt/${encodeURIComponent(orderId)}/`))

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid response from server.");
      }

      const data = await response.json()
      if (response.ok) {
        setSelectedReceipt(orderId)
        const lines = [
          data.header,
          `Order: ${data.order_no}`,
          `Table: ${data.table}`,
          `Phone: ${data.phone || 'N/A'}`,
          `Status: ${data.is_paid ? 'Paid' : 'Pending'}`,
          `Created: ${data.timestamp}`,
          '',
          'Items:',
          ...data.items.map((item: any) => {
            const line = `${item.quantity}x ${item.name} @ ${item.price.toFixed(2)} = ${item.subtotal.toFixed(2)}`
            return item.modifiers?.length ? `${line}\n  Modifiers: ${item.modifiers.join(', ')}` : line
          }).flat(),
          '',
          `Total: ${data.total.toFixed(2)}`,
          `Split: ${data.split_count} → ${data.per_person.toFixed(2)} each`,
          data.footer,
        ]
        setReceiptText(lines.join('\n'))
      }
    } catch (error) {
      console.error(error)
      alert('Failed to load receipt')
    }
  }

  const loadDefaultMenuItems = async () => {
    if (!window.confirm('This will add the default menu items to your menu. Proceed?')) {
      return
    }

    setLoading(true)
    try {
      for (const item of CUSTOMER_DEFAULT_MENU_ITEMS) {
        const response = await fetch(getApiUrl('/payments/menu-items/create/'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: item.name,
            price: item.price,
            category: item.category,
            description: item.description,
            food_cost: 0, // Default food_cost as it's not in CUSTOMER_DEFAULT_MENU_ITEMS
            popular: item.popular,
            spicy: item.spicy || false, // Default spicy to false if not present
          }),
        })
        if (!response.ok) {
          if (!response.headers.get("content-type")?.includes("application/json")) {
            alert("Server error while loading defaults.");
            break;
          }
          const data = await response.json()
          console.error(`Failed to add default item ${item.name}:`, data.error || 'Unknown error')
          alert(`Failed to add some default menu items. Check console for details.`)
          break // Stop on first error
        }
      }
      alert('Default menu items loaded successfully!')
      fetchMenuItems() // Refresh the list
    } catch (error) {
      console.error('Error loading default menu items:', error)
      alert('Error loading default menu items.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <p className="text-sm text-slate-400">System Management</p>
          <h2 className="font-display text-3xl text-slate-100">Menu & POS Control</h2>
        </div>
        <div className="flex gap-3">
          {menuItems.length === 0 && (
            <button
              onClick={loadDefaultMenuItems}
              disabled={loading}
              className="rounded-xl bg-hero-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] shadow-md active:scale-95"
            >
              {loading ? 'Loading Defaults...' : 'Load Default Menu'}
            </button>
          )}
          <button
            onClick={clearAllData}
            disabled={loading}
            className="rounded-xl border border-red-900/50 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-950/30 disabled:opacity-50"
          >
            {loading ? 'Clearing...' : 'Clear All Operational Data'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-800">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">Table Manager</p>
              <h3 className="font-semibold text-xl text-slate-100">Manage Tables</h3>
            </div>
          </div>

          <div className="grid gap-4 mb-6 md:grid-cols-2">
            <input
              value={tableNumber}
              onChange={(event) => setTableNumber(event.target.value)}
              placeholder="Table number"
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <input
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              placeholder="Table name (optional)"
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <button
            onClick={createTable}
            className="mb-8 w-full rounded-xl bg-hero-gradient px-5 py-3 text-sm font-semibold text-primary-foreground hover:scale-[1.02] transition-all shadow-md active:scale-95"
          >
            Add Table
          </button>

          <div className="space-y-3">
            {tables.map((table) => (
              <div key={table.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-100">Table {table.number}</p>
                  <p className="text-sm text-slate-400">{table.name || 'Unnamed table'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight ${
                    table.status === 'occupied' ? 'bg-red-900/30 text-red-400' : table.status === 'reserved' ? 'bg-amber-900/30 text-amber-400' : 'bg-emerald-900/30 text-emerald-400'
                  }`}>
                    {table.status}
                  </span>
                  <button
                    onClick={() => deleteTable(table.id)}
                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-800">
          <div className="mb-4">
            <p className="text-sm text-slate-400">Menu Management</p>
            <h3 className="font-semibold text-xl text-slate-100">Add New Food</h3>
          </div>
          
          <div className="mb-8 rounded-2xl bg-slate-950 p-6 border border-slate-800">
            <h4 className="text-sm font-semibold mb-3 text-slate-100">Add New Item</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-3">
              <input
                placeholder="Item Name"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
              />
              <input
                placeholder="Category (e.g. Burgers)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={newItem.category}
                onChange={e => setNewItem({...newItem, category: e.target.value})}
              />
              <input
                type="number"
                placeholder="Price"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={newItem.price}
                onChange={e => setNewItem({...newItem, price: e.target.value})}
              />
              <input
                type="number"
                placeholder="Food Cost"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                value={newItem.food_cost}
                onChange={e => setNewItem({...newItem, food_cost: e.target.value})}
              />
              <input
                placeholder="Description"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 sm:col-span-2"
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
              />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={newItem.popular} onChange={e => setNewItem({...newItem, popular: e.target.checked})} /> Popular
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={newItem.spicy} onChange={e => setNewItem({...newItem, spicy: e.target.checked})} /> Spicy
              </label>
            </div>
            <button
              onClick={handleCreateItem}
              className="w-full rounded-xl bg-hero-gradient px-4 py-3 text-sm font-bold text-primary-foreground hover:scale-[1.02] transition-all shadow-lg shadow-orange-500/20"
            >
              Create Menu Item
            </button>
          </div>
          </section>

          <section className="bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-800">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Inventory</p>
                <h3 className="font-semibold text-xl text-slate-100">Existing Foods</h3>
              </div>
              <input
                placeholder="Search menu..."
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20 w-full sm:w-auto transition-all"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
              />
            </div>

            {menuItems.length === 0 ? (
              <p className="text-slate-400">No menu items available yet.</p>
            ) : (
              <div className="space-y-3">
                {menuItems
                  .filter(item => 
                    item.name.toLowerCase().includes(menuSearch.toLowerCase()) || 
                    item.category.toLowerCase().includes(menuSearch.toLowerCase())
                  )
                  .map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between group transition-all hover:bg-slate-900 hover:shadow-md hover:border-orange-500/20">
                    <div>
                      <p className="font-semibold text-slate-100">{item.name}</p>
                      <p className="text-sm text-slate-400">{item.category} • {item.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-100">KES {item.price.toFixed(2)}</span>
                      <button
                        onClick={() => setEditingItem(item)}
                        className="rounded-lg bg-slate-800 border border-slate-600 px-4 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteMenuItem(item.id)}
                        className="p-1.5 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {editingItem && (
          <section className="bg-slate-900 p-6 rounded-xl shadow-lg border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-xl text-slate-100">Edit: {editingItem.name}</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-100">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Name</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Category</label>
                <input className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Price (KES)</label>
                <input type="number" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Food Cost (KES)</label>
                <input type="number" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" value={editingItem.food_cost} onChange={e => setEditingItem({...editingItem, food_cost: Number(e.target.value)})} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-400">Description</label>
                <textarea className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editingItem.popular} onChange={e => setEditingItem({...editingItem, popular: e.target.checked})} /> Popular
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editingItem.spicy} onChange={e => setEditingItem({...editingItem, spicy: e.target.checked})} /> Spicy
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={handleUpdateItem} className="flex-1 rounded-lg bg-hero-gradient py-2 text-sm font-semibold text-primary-foreground">Save Changes</button>
              <button onClick={() => setEditingItem(null)} className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-semibold text-slate-200">Cancel</button>
            </div>
          </section>
        )}

        <section className="bg-slate-900 p-6 rounded-xl shadow-card border border-slate-800">
          <div className="mb-4">
            <p className="text-sm text-slate-400">Kitchen Queue</p>
            <h3 className="font-semibold text-xl text-slate-100">Live Orders</h3>
          </div>

          {queue.length === 0 ? (
            <p className="text-slate-400">No active orders in the queue.</p>
          ) : (
            <div className="space-y-4">
              {queue.map((order) => (
                <div key={order.order_id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">Order {order.order_id}</p>
                      <p className="text-sm text-slate-400">Table {order.table}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => markReady(order.order_id)}
                        className="rounded-full bg-green-600 px-3 py-1 text-sm text-white"
                      >
                        Mark Ready
                      </button>
                      <button
                        onClick={() => printReceipt(order.order_id)}
                        className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300"
                      >
                        Print Receipt
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-slate-400">
                    <p>{order.items.length} items • {order.status} • KES {order.total_amount.toFixed(2)}</p>
                    {order.phone && <p>Phone: {order.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {receiptText && (
        <section className="bg-slate-900 rounded-xl p-6 shadow-card border border-slate-800">
          <div className="mb-4">
            <p className="text-sm text-slate-400">Receipt Preview</p>
            <h3 className="font-semibold text-xl text-slate-100">Order {selectedReceipt}</h3>
          </div>
          <pre className="whitespace-pre-wrap break-words text-sm text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800">{receiptText}</pre>
        </section>
      )}
    </div>
  )
}

export default AdminMenu
