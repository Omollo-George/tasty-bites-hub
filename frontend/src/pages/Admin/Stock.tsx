import React, { useEffect, useState, useMemo } from 'react'; // Removed Fragment import
import { Search, Filter, AlertTriangle, CheckCircle, XCircle, Trash2, Edit2, Plus } from 'lucide-react'; // Removed Fragment import
import { getApiUrl, getSseUrl, apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { getAdminToken } from '@/lib/admin-session';
import { getCachedStock, clearStockCache, preloadStockData } from '@/lib/admin-data-cache';

type MenuItemType = {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  food_cost: number;
  popular: boolean;
  spicy: boolean;
  stock_level: number;
  min_stock_level: number;
  sku: string;
  // Add other fields from MenuItemType if needed for editing
};

type StockAvailabilityItem = {
  id: number;
  name: string;
  price: number;
  food_cost: number;
  stock_level: number;
  min_stock_level: number;
  stock_at_time: number;
};

const AdminStock: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingItem, setEditingItem] = useState<MenuItemType | null>(null); // State for item being edited
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [mostConsumed, setMostConsumed] = useState<{name: string, total_quantity: number}[]>([]);
  const [stockFormData, setStockFormData] = useState({
    item_id: '',
    quantity: 0,
    cost: 0,
    price: 0,
    created_at: new Date().toISOString().slice(0, 16)
  });
  const [selectedStockItemId, setSelectedStockItemId] = useState('');
  const [stockQueryTime, setStockQueryTime] = useState(new Date().toISOString().slice(0, 16));
  const [availabilityAtTime, setAvailabilityAtTime] = useState<StockAvailabilityItem[] | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityCollapsed, setAvailabilityCollapsed] = useState(false);

  const adminToken = getAdminToken() || ''; 

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const data: any = await apiFetch('/payments/menu-items/', { headers: { Authorization: `Bearer ${adminToken}` } });
      if (Array.isArray(data.menu_items)) {
        const enrichedItems = data.menu_items.map((item: MenuItemType) => ({ // Use MenuItemType for item
          ...item,
          // Defensive coding: safeguard against missing category or id to prevent render crashes
          sku: `TB-${(item.category || 'GEN').substring(0, 3).toUpperCase()}-${String(item.id || 0).padStart(4, '0')}`,
          stock_level: item.stock_level ?? 0,
          min_stock_level: item.min_stock_level ?? 10
        }));
        setMenuItems(enrichedItems);
      }
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const enrichStockItems = (items: MenuItemType[]): MenuItemType[] => {
    return items.map((item: MenuItemType) => ({
      ...item,
      sku: `TB-${(item.category || 'GEN').substring(0, 3).toUpperCase()}-${String(item.id || 0).padStart(4, '0')}`,
      stock_level: item.stock_level ?? 0,
      min_stock_level: item.min_stock_level ?? 10
    }));
  };

  const fetchMostConsumed = async () => {
    try {
      try {
        const mc: any = await apiFetch('/payments/stock/most-consumed/', { headers: { Authorization: `Bearer ${adminToken}` } });
        setMostConsumed(mc.results || [])
      } catch (e) {
        // ignore non-critical
      }
    } catch (error) {
      console.error('Failed to fetch most consumed stock:', error);
    }
  };

  const fetchStockAvailability = async () => {
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    try {
      const params = new URLSearchParams({ at: stockQueryTime });
      if (selectedStockItemId) {
        params.set('item_id', selectedStockItemId);
      }

      const data: any = await apiFetch(`/payments/admin/stock/availability/?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!Array.isArray(data.items)) {
        setAvailabilityAtTime(null);
        setAvailabilityError('Unexpected response from stock availability endpoint.');
      } else {
        setAvailabilityAtTime(data.items.map((item: any) => ({
          id: Number(item.id),
          name: String(item.name),
          price: Number(item.price || 0),
          food_cost: Number(item.food_cost || 0),
          stock_level: Number(item.stock_level || 0),
          min_stock_level: Number(item.min_stock_level || 0),
          stock_at_time: Number(item.stock_at_time || 0),
        })));
      }
    } catch (error) {
      console.error('Failed to fetch stock availability:', error);
      setAvailabilityAtTime(null);
      setAvailabilityError(error instanceof Error ? error.message : 'Unable to load stock availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const { toast } = useToast();

  useEffect(() => {
    // Try to use cached data first for instant display
    const cachedData = getCachedStock()
    if (cachedData && Array.isArray(cachedData)) {
      const enrichedItems = enrichStockItems(cachedData)
      setMenuItems(enrichedItems)
      setLoading(false)
      // Refresh in background
      fetchMenuItems()
    } else {
      // No cache, fetch normally
      fetchMenuItems()
    }
    fetchMostConsumed()
    // Preload for next visit
    preloadStockData()
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.EventSource) {
      return;
    }

    let es: EventSource | null = null
    try {
      es = new EventSource(getSseUrl('/payments/stream/'))
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (!payload || !payload.type) return

          if (payload.type === 'stock_update' && payload.data) {
            const data = payload.data
            setMenuItems((items) => items.map((item) => {
              if (item.id !== Number(data.item_id)) return item
              return {
                ...item,
                stock_level: Number(data.stock_level ?? item.stock_level),
                min_stock_level: Number(data.min_stock_level ?? item.min_stock_level),
              }
            }))
          }

          if (payload.type === 'stock_alert' && payload.data) {
            const data = payload.data
            toast({
              title: `Low stock: ${data.name}`,
              description: `Remaining ${data.stock_level}. Minimum ${data.min_stock_level}.`,
              variant: 'destructive',
            })
          }
        } catch (error) {
          // ignore malformed event payloads
        }
      }
      es.onerror = () => {
        if (es) {
          es.close()
          es = null
        }
      }
    } catch (error) {
      console.error('Failed to open stock SSE connection', error)
    }

    return () => {
      if (es) {
        es.close()
      }
    }
  }, [toast]);

  const categories = useMemo(() => ['All', ...new Set(menuItems.map(i => i.category))], [menuItems]);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'Low Stock') matchesStatus = item.stock_level > 0 && item.stock_level < item.min_stock_level;
    if (statusFilter === 'Out of Stock') matchesStatus = item.stock_level === 0;
    if (statusFilter === 'In Stock') matchesStatus = item.stock_level >= item.min_stock_level;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = useMemo(() => ({
    total: menuItems.length,
    lowStock: menuItems.filter(i => i.stock_level > 0 && i.stock_level < i.min_stock_level).length,
    outOfStock: menuItems.filter(i => i.stock_level === 0).length,
    totalValue: menuItems.reduce((acc, i) => acc + (i.food_cost * i.stock_level), 0)
  }), [menuItems]);

  const handleSaveStock = async () => {
    if (!editingItem) return;

    try {
      const updateRes = await apiFetch(`/payments/menu-items/${editingItem.id}/update-price/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: editingItem.name,
          category: editingItem.category,
          price: editingItem.price,
          food_cost: editingItem.food_cost,
          description: editingItem.description,
          popular: editingItem.popular,
          spicy: editingItem.spicy,
          stock_level: editingItem.stock_level,
          min_stock_level: editingItem.min_stock_level,
        }),
      });

      if (updateRes.ok) {
        clearStockCache();
        await fetchMenuItems(); // Refresh data to keep menu and stock in sync
        setEditingItem(null);
      } else {
        alert('Failed to update item details. Please check your connection.');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert(`Error updating item: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this item entirely? This cannot be undone.')) return;
    try {
      try {
        await apiFetch(`/payments/menu-items/${id}/delete/`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } })
        clearStockCache();
        await fetchMenuItems();
      } catch (error) {
        clearStockCache();
        await fetchMenuItems();
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error connecting to delete service.');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      try {
        await apiFetch('/payments/admin/stock/add/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            ...stockFormData,
            price: stockFormData.price,
          }),
        })
        clearStockCache();
        await fetchMenuItems();
        setIsAddingStock(false);
        setStockFormData({ item_id: '', quantity: 0, cost: 0, price: 0, created_at: new Date().toISOString().slice(0, 16) });
      } catch (err) {
        const errorMsg = err?.body || err?.message || 'Failed to add stock.'
        alert(errorMsg)
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      alert(`Error adding stock: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <React.Fragment>
      <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 font-medium">Inventory Management</p>
          <h2 className="font-display text-3xl text-slate-100">Stock Control Panel</h2>
        </div>
        <button onClick={() => setIsAddingStock(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 flex items-center gap-2">
          <Plus size={20} />
          <span>New Stock Adjustment</span>
        </button>
      </div>

      {stats.lowStock > 0 && (
        <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-4 text-amber-200 animate-pulse">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm font-medium">Warning: {stats.lowStock} item(s) are below their minimum stock levels.</p>
        </div>
      )}

      {/* Most Consumed Stock */}
      <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="font-semibold text-xl text-slate-100 mb-4">Most Consumed Stock (Sold)</h3>
        <div className="pb-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mostConsumed.length === 0 ? (
              <p className="text-slate-400 text-sm">No sales data yet.</p>
            ) : (
              mostConsumed.map((item, idx) => (
                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 min-w-0">
                  <p className="text-xs text-slate-400 font-bold uppercase truncate whitespace-nowrap">{item.name}</p>
                  <p className="text-2xl font-display text-orange-500">{item.total_quantity}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <div className="pb-2">
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
          {[
            { label: 'Total Items', value: stats.total, icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Out of Stock', value: stats.outOfStock, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Inventory Value', value: `KES ${stats.totalValue.toLocaleString()}`, icon: Filter, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map((stat, idx) => (
            <div key={idx} className="min-w-[220px] flex-[0_0_220px] bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-slate-100">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-semibold text-xl text-slate-100">Stock Availability At Specific Time</h3>
            <p className="text-sm text-slate-400">Choose a date/time and optionally an item to see the available stock then.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAvailabilityCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
            >
              {availabilityCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <button
              type="button"
              onClick={fetchStockAvailability}
              disabled={availabilityLoading}
              className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {availabilityLoading ? 'Loading…' : 'Show Availability'}
            </button>
          </div>
        </div>

        {!availabilityCollapsed && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)] w-full md:w-auto">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Lookup Time</label>
                <input
                  type="datetime-local"
                  value={stockQueryTime}
                  onChange={(e) => setStockQueryTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Focus Item (optional)</label>
                <select
                  value={selectedStockItemId}
                  onChange={(e) => setSelectedStockItemId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">All Items</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {availabilityError ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-sm text-red-200">
                {availabilityError}
              </div>
            ) : null}

            {availabilityAtTime ? (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-sm text-slate-400">
                      <th className="py-3">Item</th>
                      <th className="py-3">Current Stock</th>
                      <th className="py-3">Stock At Time</th>
                      <th className="py-3">Min Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availabilityAtTime.map((item) => (
                      <tr key={item.id} className="border-b border-slate-700 last:border-b-0">
                        <td className="py-3 text-slate-100">{item.name}</td>
                        <td className="py-3 text-slate-400">{item.stock_level}</td>
                        <td className="py-3 text-slate-100">{item.stock_at_time}</td>
                        <td className="py-3 text-slate-400">{item.min_stock_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          type="text"
            placeholder="Search by product name or SKU..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <select 
            className="bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20 flex-1 lg:min-w-[150px]"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <select 
            className="bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20 flex-1 lg:min-w-[150px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl shadow-sm overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left border-collapse min-w-0">
            <thead className="bg-slate-950">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4 text-center">Current Stock</th>
                <th className="px-6 py-4 text-center">Min Level</th>
                <th className="px-6 py-4">Pricing</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading inventory data...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No products match your criteria.</td></tr>
            ) : (
              filteredItems.map(item => {
                const isLow = item.stock_level > 0 && item.stock_level < item.min_stock_level;
                const isOut = item.stock_level === 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-100 truncate whitespace-nowrap">{item.name}</p>
                        <p className="text-[10px] font-mono text-slate-500 tracking-tight truncate whitespace-nowrap">{item.sku}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate whitespace-nowrap">{item.category}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-100'}`}>
                        {item.stock_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-400">
                      {item.min_stock_level}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-slate-100 font-medium">KES {item.price.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">Cost: KES {item.food_cost.toLocaleString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight inline-flex items-center gap-1.5 border ${
                        isOut ? 'bg-red-900/30 text-red-400 border-red-500/20' : 
                        isLow ? 'bg-amber-900/30 text-amber-400 border-amber-500/20' : 
                        'bg-emerald-900/30 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {isOut ? <XCircle size={10}/> : isLow ? <AlertTriangle size={10}/> : <CheckCircle size={10}/>}
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingItem({ ...item })}
                          className="p-2 text-slate-400 hover:text-orange-500 transition-colors bg-slate-800 rounded-lg border border-slate-700"
                        >
                          <Edit2 size={16} /> {/* Set item for editing */}
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-800 rounded-lg border border-slate-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div> {/* Closes table wrapper */}
      </div> {/* Closes space-y-6 content div */}

      {/* Add Stock Modal */}
      {isAddingStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-800 w-full max-w-lg">
            <h3 className="font-display text-2xl text-slate-100 mb-4">Add Inventory Stock</h3>
            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Select Product</label>
                <select
                  required
                  value={stockFormData.item_id}
                  onChange={(e) => {
                    const selectedItemId = e.target.value
                    const item = menuItems.find((m) => String(m.id) === selectedItemId)
                    setStockFormData({
                      ...stockFormData,
                      item_id: selectedItemId,
                      price: item ? item.price : 0,
                    })
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">-- Choose Item --</option>
                  {menuItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={stockFormData.quantity}
                    onChange={(e) => setStockFormData({ ...stockFormData, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Menu Price (Auto)</label>
                  <input
                    type="number"
                    value={stockFormData.price}
                    readOnly
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Food Cost (Total)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={stockFormData.cost}
                    onChange={(e) => setStockFormData({ ...stockFormData, cost: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date & Time Added</label>
                <input
                  type="datetime-local"
                  required
                  value={stockFormData.created_at}
                  onChange={(e) => setStockFormData({ ...stockFormData, created_at: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsAddingStock(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95">Complete Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Modal/Form - conditionally rendered */}
      {editingItem && ( 
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <h3 className="font-display text-2xl text-slate-100 mb-4">Edit Item Details</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Item Name</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                <input
                  type="text"
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              <label className="block text-sm font-medium text-slate-400 mb-1">Current Stock Level</label>
              <input
                type="number"
                min={0}
                value={editingItem.stock_level}
                onChange={(e) => setEditingItem({ ...editingItem, stock_level: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Minimum Stock Level</label>
              <input
                type="number"
                min={0}
                value={editingItem.min_stock_level}
                onChange={(e) => setEditingItem({ ...editingItem, min_stock_level: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Price (KES)</label>
                <input
                  type="number"
                  value={editingItem.price}
                  onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Food Cost (KES)</label>
                <input
                  type="number"
                  value={editingItem.food_cost}
                  onChange={(e) => setEditingItem({ ...editingItem, food_cost: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/20 h-20"
              />
            </div>
            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={editingItem.popular} onChange={e => setEditingItem({ ...editingItem, popular: e.target.checked })} className="rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-0" />
                Popular
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={editingItem.spicy} onChange={e => setEditingItem({ ...editingItem, spicy: e.target.checked })} className="rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-0" />
                Spicy
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStock}
                className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

  </React.Fragment>
  );
};

export default AdminStock;