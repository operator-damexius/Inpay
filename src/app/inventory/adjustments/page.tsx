'use client';

import { useEffect, useState } from 'react';
import { Scale, Plus } from 'lucide-react';
import Link from 'next/link';

type Adjustment = {
  _id: string;
  item: { sku: string; name: string; unit?: { name: string; code: string } };
  location?: { name: string };
  type: string;
  qty: number;
  reason?: string;
  refNo?: string;
  createdAt: string;
};

export default function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({
    itemId: '', type: 'Add', qty: '1', locationId: '', reason: '', refNo: '',
  });
  const selectedItem = items.find((item) => item._id === form.itemId);
  const unitLabel = selectedItem?.unit?.code || selectedItem?.unit?.name;

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory/stock-adjustments').then((r) => r.json()),
      fetch('/api/inventory/items').then((r) => r.json()),
      fetch('/api/inventory/locations').then((r) => r.json()),
    ]).then(([adj, its, locs]) => {
      setAdjustments(adj);
      setItems(its);
      setLocations(locs);
      setLoading(false);
    });
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const res = await fetch('/api/inventory/stock-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: form.itemId,
        type: form.type,
        qty: form.qty,
        locationId: form.locationId || null,
        reason: form.reason || null,
        refNo: form.refNo || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setAdjustments([data, ...adjustments]);
      setOpen(false);
      setForm({ itemId: '', type: 'Add', qty: '1', locationId: '', reason: '', refNo: '' });
    } else {
      const data = await res.json();
      setActionError(data.error || 'Could not apply adjustment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Stock Adjustments</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Scale size={18} /> New Adjustment
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
              <th>Type</th>
              <th>Location</th>
              <th className="text-right">Qty</th>
              <th>Reason</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-gray-500 text-center py-8">Loading...</td></tr>
            ) : adjustments.length === 0 ? (
              <tr><td colSpan={8} className="text-gray-500 text-center py-8">No adjustments yet.</td></tr>
            ) : (
              adjustments.map((a) => (
                <tr key={a._id}>
                  <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td>{a.item.sku} - {a.item.name}</td>
                  <td>{a.item.unit?.code || a.item.unit?.name || '—'}</td>
                  <td>
                    <span className={`badge ${a.type === 'Add' ? 'badge-ok' : a.type === 'Subtract' ? 'badge-warn' : 'badge-bad'}`}>
                      {a.type}
                    </span>
                  </td>
                  <td>{a.location?.name || '—'}</td>
                  <td className="text-right">{a.qty}</td>
                  <td>{a.reason || '—'}</td>
                  <td>{a.refNo || '—'}</td>
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
          <h2 className="text-lg font-bold mb-4">New Adjustment</h2>
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
              <label className="label">Type</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="Add">Add stock</option>
                <option value="Subtract">Subtract stock</option>
                <option value="Set">Set stock level</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity{unitLabel ? ` (${unitLabel})` : ''}</label>
              <input
                className="input"
                type="number"
                min={form.type === 'Set' ? 0 : 1}
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Location</label>
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
                Add a location before adjusting stock. <Link className="underline" href="/inventory/locations">Manage locations</Link>
              </p>
            )}
            <div>
              <label className="label">Reason</label>
              <input
                className="input"
                name="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. cycle count, damaged goods"
              />
            </div>
            <div>
              <label className="label">Reference No.</label>
              <input
                className="input"
                name="refNo"
                value={form.refNo}
                onChange={(e) => setForm({ ...form, refNo: e.target.value })}
                placeholder="e.g. PO-1001"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Apply Adjustment
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
