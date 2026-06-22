import React, { useEffect, useState, useRef } from 'react'
import { DEFAULT_MENU_ITEMS as CUSTOMER_DEFAULT_MENU_ITEMS } from '@/components/MenuSection'
import { getApiUrl } from '@/lib/api'
import { getAdminToken } from '@/lib/admin-session'
import { formatImageUrl } from '@/lib/image'

type TableItem = {
  id: number
  number: string
  name: string
  status: string
}

type MenuItemType = {
  id: number
  name: string
  price: number
  category: string
  description: string
  food_cost: number
  image_url?: string
  popular: boolean
  spicy: boolean
}

const AdminMenu: React.FC = () => {
  const [tables, setTables] = useState<TableItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([])
  const [tableNumber, setTableNumber] = useState('')
  const [tableName, setTableName] = useState('')
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    food_cost: '',
    image_url: '',
    popular: false,
    spicy: false,
  })
  const [editingItem, setEditingItem] = useState<MenuItemType | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [menuSearch, setMenuSearch] = useState('')
  const [newItemPreviewUrl, setNewItemPreviewUrl] = useState<string>('')
  const [editItemPreviewUrl, setEditItemPreviewUrl] = useState<string>('')
  const [newItemPreviewError, setNewItemPreviewError] = useState(false)
  const [editItemPreviewError, setEditItemPreviewError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const adminToken = getAdminToken() || '';

  const fetchTables = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/pos/tables/'), {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
      if (!response.headers.get("content-type")?.includes("application/json")) return;
      const data = await response.json()
      setTables(data.tables || [])
    } catch (error) {
      console.error(error)
    }
  }

  const fetchMenuItems = async () => {
    try {
      const response = await fetch(getApiUrl('/payments/menu-items/'), {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const localPreviewUrl = URL.createObjectURL(file)
    if (isEditing) {
      setEditItemPreviewUrl(localPreviewUrl)
    } else {
      setNewItemPreviewUrl(localPreviewUrl)
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(getApiUrl('/payments/admin/upload-image/'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      })
      const data = await response.json()
      console.log('Image upload response data:', data); // Log the response for debugging
      if (response.ok) {
        const imageUrl = data.url || data.image_url || data.image; // Handle different backend property names
        if (imageUrl) {
          if (isEditing && editingItem) {
            setEditingItem({ ...editingItem, image_url: imageUrl })
            setEditItemPreviewUrl(imageUrl)
            setEditItemPreviewError(false)
          } else {
            setNewItem({ ...newItem, image_url: imageUrl })
            setNewItemPreviewUrl(imageUrl)
            setNewItemPreviewError(false)
          }
        } else {
          alert('Upload successful, but no image URL returned from server.')
        }
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      alert('Error uploading image')
    } finally {
      setUploading(false)
    }
  }

  const handleCreateItem = async () => {
    if (!newItem.name || !newItem.category || !newItem.price) {
      alert('Name, Category, and Price are required.')
      return
    }
    const price = Number(newItem.price);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price greater than 0.');
      return;
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
          price: price,
          food_cost: Number(newItem.food_cost || 0),
        }),
      })

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Server returned invalid format.");
      }

      const data = await response.json()
      if (response.ok) {
        setNewItem({ name: '', price: '', category: '', description: '', food_cost: '', image_url: '', popular: false, spicy: false })
        setNewItemPreviewUrl('')
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
        setEditItemPreviewUrl('')
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

  const loadDefaultMenuItems = async () => {
    if (!window.confirm('This will add the default menu items to your menu. Proceed?')) {
      return
    }

    setLoading(true)
    try {
      for (const item of (CUSTOMER_DEFAULT_MENU_ITEMS as any)) {
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
            image_url: (item as any).image_url,
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
          console.error(`Failed to add item "${item.name}":`, data.error || 'Unknown error')
          alert(`Failed to add "${item.name}". Reason: ${data.error || 'Server rejected item data.'}`)
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
              <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Food Image</label>
                <p className="text-xs text-slate-500">Enter a public image URL or upload a local image file from your computer.</p>
                <div className="flex gap-2 flex-wrap">
                  <input
                    placeholder="https://example.com/image.jpg"
                    className="min-w-0 w-full flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                    value={newItem.image_url}
                    onChange={e => {
                      const value = e.target.value
                      setNewItem({...newItem, image_url: value})
                      setNewItemPreviewError(false)
                      setNewItemPreviewUrl(formatImageUrl(value))
                    }}
                  />
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, false)}
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload Local File'}
                  </button>
                </div>
                {(newItemPreviewUrl || newItem.image_url) && (
                  <img
                    src={newItemPreviewUrl || formatImageUrl(newItem.image_url)}
                    className="h-20 max-w-full w-full sm:w-32 object-cover rounded-lg mt-2 border border-slate-700" 
                    alt="Preview" 
                    onError={() => setNewItemPreviewError(true)}
                    onLoad={() => setNewItemPreviewError(false)}
                  />
                )}
                {newItemPreviewError && (
                  <p className="text-xs text-rose-400">Preview failed to load. Check the image URL or upload a local file.</p>
                )}
              </div>
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
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-400">Image URL</label>
                <p className="text-xs text-slate-500">Paste a browser-accessible image URL or upload a local file.</p>
                <div className="flex gap-2 flex-wrap">
                  <input 
                    className="min-w-0 w-full flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100" 
                    value={editingItem.image_url || ''} 
                    onChange={e => {
                      const value = e.target.value
                      setEditingItem({...editingItem, image_url: value})
                      setEditItemPreviewError(false)
                      setEditItemPreviewUrl(formatImageUrl(value))
                    }} 
                  />
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={editFileInputRef}
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, true)}
                  />
                  <button 
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Upload Local File'}
                  </button>
                </div>
                {(editItemPreviewUrl || editingItem.image_url) && (
                  <img
                    src={editItemPreviewUrl || formatImageUrl(editingItem.image_url)}
                    className="h-20 max-w-full w-full sm:w-32 object-cover rounded-lg mt-2 border border-slate-700" 
                    alt="Preview" 
                    onError={() => setEditItemPreviewError(true)}
                    onLoad={() => setEditItemPreviewError(false)}
                  />
                )}
                {editItemPreviewError && (
                  <p className="text-xs text-rose-400">Preview failed to load. Check the image URL or upload a local file.</p>
                )}
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
      </div>
    </div>
  )
}

export default AdminMenu
