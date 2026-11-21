'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Save, Barcode } from 'lucide-react';
import Link from 'next/link';

type Item = {
  _id: string;
  sku: string;
  name: string;
  price: number;
  sellingPrice: number;
  stockOnHand: number;
  reorderLevel: number;
  icon?: string;
  notes?: string;
  isActive: boolean;
  category?: { _id?: string; name: string };
  unit?: { _id?: string; name: string };
  location?: { _id?: string; name: string };
};

type Unit = {
  _id: string;
  name: string;
  code: string;
};

async function fetchArray<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (!Array.isArray(data)) {
    throw new Error(`Unexpected response from ${url}`);
  }

  return data as T[];
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [form, setForm] = useState({
    sku: '', name: '', icon: '', price: '', sellingPrice: '', reorderLevel: '', stockOnHand: '',
    category: '', unit: '', location: '', notes: '', isActive: true,
  });
  const [editForm, setEditForm] = useState({
    _id: '', sku: '', name: '', icon: '', price: '', sellingPrice: '', reorderLevel: '', stockOnHand: '',
    category: '', unit: '', location: '', notes: '', isActive: true,
  });
  const [cats, setCats] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [locs, setLocs] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [items, cats, units, locs] = await Promise.all([
          fetchArray<Item>('/api/inventory/items'),
          fetchArray<any>('/api/inventory/categories'),
          fetchArray<Unit>('/api/inventory/units'),
          fetchArray<any>('/api/inventory/locations'),
        ]);
        setItems(items);
        setCats(cats);
        setUnits(units);
        setLocs(locs);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load inventory data.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const generateSKU = () => {
    const cat = cats.find((c: any) => c._id === form.category);
    const prefix = cat?.name?.substring(0, 3).toUpperCase() || 'ITM';
    const random = Math.floor(1000 + Math.random() * 9000);
    setForm({ ...form, sku: `${prefix}-${random}` });
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const initialStock = Number(form.stockOnHand || 0);
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      setFormError('Initial stock must be a non-negative whole number.');
      return;
    }
    if (initialStock > 0 && !form.location) {
      setFormError('Choose a location for the initial stock.');
      return;
    }
    if (!form.unit) {
      setFormError('Choose a unit of measure for the item.');
      return;
    }

    const res = await fetch('/api/inventory/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error || 'Could not add item.');
      return;
    }
    setItems([data, ...items]);
    setOpen(false);
    setForm({ sku: '', name: '', icon: '', price: '', sellingPrice: '', reorderLevel: '', stockOnHand: '', category: '', unit: '', location: '', notes: '', isActive: true });
  };

  const updateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!editForm.unit) {
      setFormError('Choose a unit of measure for the item.');
      return;
    }
    const res = await fetch(`/api/inventory/items/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems(items.map((i) => (i._id === updated._id ? updated : i)));
      setEditOpen(false);
      setEditingId('');
      setFormError('');
    } else {
      const data = await res.json();
      setFormError(data.error || 'Could not update item.');
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/inventory/items/${id}`, { method: 'DELETE' });
    setItems(items.filter((i) => i._id !== id));
  };

  const startEdit = (item: Item) => {
    setFormError('');
    setEditingId(item._id);
    setEditForm({
      _id: item._id,
      sku: item.sku,
      name: item.name,
      icon: item.icon || '',
      price: item.price.toString(),
      sellingPrice: item.sellingPrice?.toString() || '0',
      reorderLevel: item.reorderLevel.toString(),
      stockOnHand: item.stockOnHand.toString(),
      category: item.category?._id || '',
      unit: item.unit?._id || '',
      location: item.location?._id || '',
      notes: item.notes || '',
      isActive: item.isActive,
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <div className="flex gap-2">
          <Link href="/inventory/units" className="btn-ghost">Manage Units</Link>
          <button className="btn-primary" onClick={() => { setFormError(''); setOpen(true); }}>
            <Plus size={18} /> Add Item
          </button>
        </div>
      </div>

      {items.some((item) => item.stockOnHand > 0 && !item.location) && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="status">
          Some existing stock has no assigned location. Edit each affected item to assign its location, then run <code>npm run migrate:stock-balances</code>.
        </p>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : loadError ? (
        <p className="text-red-600" role="alert">Could not load items: {loadError}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No items yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Category</th>
              <th>Unit</th>
              <th className="text-right">Inventory Price</th>
              <th className="text-right">Selling Price</th>
              <th className="text-right">On Hand</th>
              <th className="text-right">Reorder</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i._id} className={i.stockOnHand <= i.reorderLevel && i.reorderLevel > 0 ? 'bg-red-50' : ''}>
                <td>{i.sku}</td>
                <td>{i.icon} {i.name}</td>
                <td>{i.category?.name || '—'}</td>
                <td>{i.unit?.name || '—'}</td>
                <td className="text-right">₱{i.price.toFixed(2)}</td>
                <td className="text-right">₱{(i.sellingPrice || 0).toFixed(2)}</td>
                <td className="text-right">{i.stockOnHand}</td>
                <td className="text-right">{i.reorderLevel}</td>
                <td className="text-right">
                  <button
                    className="text-Inpay-600 hover:text-Inpay-700 mr-2"
                    title="Edit"
                    onClick={() => startEdit(i)}
                  >
                    <Edit3 size={16} />
                  </button>{' '}
                  <button
                    className="text-red-600 hover:text-red-700"
                    title="Delete"
                    onClick={() => deleteItem(i._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Item Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Add Item</h2>
          <form onSubmit={addItem} className="space-y-3">
            {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">SKU</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    name="sku"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-ghost px-3"
                    onClick={generateSKU}
                    title="Auto-generate SKU"
                  >
                    <Barcode size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Icon</label>
                <input
                  className="input"
                  name="icon"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="📦"
                />
              </div>
            </div>
            <div>
              <label className="label">Item Name</label>
              <input
                className="input"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">—</option>
                  {cats.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Unit of Measure</label>
                <select
                  className="input"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                >
                  <option value="">— Select unit —</option>
                  {units.map((unit) => <option key={unit._id} value={unit._id}>{unit.name} ({unit.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location</label>
                <select
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                >
                  <option value="">—</option>
                  {locs.map((l: any) => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Inventory Price</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="price"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Selling Price</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="sellingPrice"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Reorder Level</label>
                <input
                  className="input"
                  type="number"
                  name="reorderLevel"
                  value={form.reorderLevel}
                  onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Stock On Hand</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  name="stockOnHand"
                  value={form.stockOnHand}
                  onChange={(e) => setForm({ ...form, stockOnHand: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                name="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Item notes..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Save Item
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Item Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${editOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setEditOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Edit Item</h2>
          <form onSubmit={updateItem} className="space-y-3">
            {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
            <input type="hidden" name="_id" value={editForm._id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">SKU</label>
                <input
                  className="input"
                  name="sku"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Icon</label>
                <input
                  className="input"
                  name="icon"
                  value={editForm.icon}
                  onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                  placeholder="📦"
                />
              </div>
            </div>
            <div>
              <label className="label">Item Name</label>
              <input
                className="input"
                name="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                >
                  <option value="">—</option>
                  {cats.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Unit of Measure</label>
                <select
                  className="input"
                  value={editForm.unit}
                  onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  required
                >
                  <option value="">— Select unit —</option>
                  {units.map((unit) => <option key={unit._id} value={unit._id}>{unit.name} ({unit.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Default Location</label>
                <select
                  className="input"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                >
                  <option value="">—</option>
                  {locs.map((l: any) => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Inventory Price</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  name="price"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Selling Price</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="sellingPrice"
                  value={editForm.sellingPrice}
                  onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Reorder Level</label>
                <input
                  className="input"
                  type="number"
                  name="reorderLevel"
                  value={editForm.reorderLevel}
                  onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                name="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Update Item
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
