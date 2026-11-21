'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

type Purchase = {
  _id: string;
  item: { sku: string; name: string; unit?: { name: string; code: string } };
  location?: { name: string };
  supplier?: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  status: string;
  reference?: string;
};

export default function PurchasingPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({
    itemId: '', locationId: '', supplier: '', purchaseDate: '', qty: '1', unitCost: '0', status: 'Ordered', reference: '',
  });
  const selectedItem = items.find((item) => item._id === form.itemId);
  const unitLabel = selectedItem?.unit?.code || selectedItem?.unit?.name;

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory/purchases').then((r) => r.json()),
      fetch('/api/inventory/items').then((r) => r.json()),
      fetch('/api/inventory/locations').then((r) => r.json()),
    ]).then(([pur, its, locs]) => {
      setPurchases(pur);
      setItems(its);
      setLocations(locs);
      setLoading(false);
    });
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const res = await fetch('/api/inventory/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: form.itemId,
        locationId: form.locationId,
        supplier: form.supplier || null,
        qty: form.qty,
        unitCost: form.unitCost,
        purchaseDate: form.purchaseDate,
        status: form.status,
        reference: form.reference || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPurchases([data, ...purchases]);
      setOpen(false);
      setForm({ itemId: '', locationId: '', supplier: '', purchaseDate: '', qty: '1', unitCost: '0', status: 'Ordered', reference: '' });
    } else {
      const data = await res.json();
      setActionError(data.error || 'Could not record purchase.');
    }
  };

  const receive = async (id: string) => {
    const response = await fetch(`/api/inventory/purchases/${id}/receive`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      setActionError(data.error || 'Could not receive purchase.');
      return;
    }

    setPurchases((current) => current.map((purchase) => purchase._id === id ? data : purchase));
    setActionError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Purchasing</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <ShoppingCart size={18} /> New Purchase
        </button>
      </div>

      {actionError && <p className="text-red-600" role="alert">{actionError}</p>}

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th>Unit</th>
              <th>Location</th>
              <th>Supplier</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Cost</th>
              <th className="text-right">Total</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-gray-500 text-center py-8">Loading...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={10} className="text-gray-500 text-center py-8">No purchases yet.</td></tr>
            ) : (
              purchases.map((p) => (
                <tr key={p._id}>
                  <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                  <td>{p.item.sku} - {p.item.name}</td>
                  <td>{p.item.unit?.code || p.item.unit?.name || '—'}</td>
                  <td>{p.location?.name || '—'}</td>
                  <td>{p.supplier || '—'}</td>
                  <td className="text-right">{p.qty}</td>
                  <td className="text-right">₱{p.unitCost.toFixed(2)}</td>
                  <td className="text-right">₱{p.totalCost.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${
                      p.status === 'Received' ? 'badge-ok' : p.status === 'Cancelled' ? 'badge-bad' : 'badge-warn'
                    }`}>{p.status}</span>
                  </td>
                  <td className="text-right">
                    {p.status === 'Ordered' ? (
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => receive(p._id)}
                      >
                        <RefreshCw size={14} /> Receive
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">{p.status}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${
          open ? '' : 'hidden'
        }`}
      >
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">New Purchase</h2>
          <form onSubmit={add} className="space-y-3">
            <div>
              <label className="label">Item</label>
              <select
                className="input"
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                required
              >
                <option value="">— Select item —</option>
                {items.map((i) => (
                  <option key={i._id} value={i._id}>
                    {i.sku} - {i.name}{i.unit?.code ? ` (${i.unit.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Receive At</label>
              <select
                className="input"
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                required
              >
                <option value="">— Select location —</option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>{location.name}</option>
                ))}
              </select>
            </div>
            {locations.length === 0 && (
              <p className="text-sm text-amber-700">
                Add a location before recording a purchase. <Link className="underline" href="/inventory/locations">Manage locations</Link>
              </p>
            )}
            <div>
              <label className="label">Supplier</label>
              <input
                className="input"
                name="supplier"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Supplier name"
              />
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input
                className="input"
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity{unitLabel ? ` (${unitLabel})` : ''}</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Unit Cost</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Ordered">Ordered</option>
                <option value="Received">Received (adds stock)</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Reference No.</label>
              <input
                className="input"
                name="refNo"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="e.g. PO-1001"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Record Purchase
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
