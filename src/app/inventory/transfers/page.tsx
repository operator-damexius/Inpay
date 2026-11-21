'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';

type Transfer = {
  _id: string;
  item: { _id: string; sku: string; name: string; unit?: { name: string; code: string } };
  fromLocation?: { _id: string; name: string };
  toLocation?: { _id: string; name: string };
  qty: number;
  status: string;
  refNo?: string;
  createdAt: string;
};

type Location = {
  _id: string;
  name: string;
};

type LocationBalance = {
  item: { _id: string };
  location: { _id: string };
  quantity: number;
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locs, setLocs] = useState<Location[]>([]);
  const [balances, setBalances] = useState<LocationBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({
    itemId: '', fromLocationId: '', toLocationId: '', qty: '1', refNo: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory/stock-transfers').then((r) => r.json()),
      fetch('/api/inventory/items').then((r) => r.json()),
      fetch('/api/inventory/locations').then((r) => r.json()),
      fetch('/api/inventory/stock-balances').then((r) => r.json()),
    ]).then(([tr, its, ls, stock]) => {
      setTransfers(tr);
      setItems(its);
      setLocs(ls);
      setBalances(stock);
      setLoading(false);
    });
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/inventory/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: form.itemId,
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        qty: form.qty,
        refNo: form.refNo || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTransfers([data, ...transfers]);
      setActionError('');
      setOpen(false);
      setForm({ itemId: '', fromLocationId: '', toLocationId: '', qty: '1', refNo: '' });
    } else {
      const data = await res.json();
      setActionError(data.error || 'Could not create transfer.');
    }
  };

  const receive = async (id: string) => {
    const response = await fetch(`/api/inventory/stock-transfers/${id}/receive`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      setActionError(data.error || 'Could not receive transfer.');
      return;
    }

    setTransfers((current) => current.map((transfer) => transfer._id === id ? data : transfer));
    setBalances((current) => {
      if (!data.item || !data.fromLocation || !data.toLocation) return current;
      const source = data.fromLocation._id;
      const destination = data.toLocation._id;
      const hasDestination = current.some(
        (balance) => balance.item._id === data.item._id && balance.location._id === destination
      );
      return [
        ...current.map((balance) => {
          if (balance.item._id !== data.item._id) return balance;
          if (balance.location._id === source) return { ...balance, quantity: balance.quantity - data.qty };
          if (balance.location._id === destination) return { ...balance, quantity: balance.quantity + data.qty };
          return balance;
        }),
        ...(!hasDestination ? [{
          item: { _id: data.item._id },
          location: { _id: destination },
          quantity: data.qty,
        }] : []),
      ];
    });
    setActionError('');
  };

  const selectedItem = items.find((item) => item._id === form.itemId);
  const unitLabel = selectedItem?.unit?.code || selectedItem?.unit?.name;
  const availableAtSource = balances.find(
    (balance) => balance.item._id === form.itemId && balance.location._id === form.fromLocationId
  )?.quantity;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <ArrowRight size={18} /> New Transfer
        </button>
      </div>

      {actionError && <p className="text-red-600" role="alert">{actionError}</p>}

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <table className="table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Item</th>
              <th>Unit</th>
              <th>From</th>
              <th>To</th>
              <th className="text-right">Qty</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-gray-500 text-center py-8">Loading...</td></tr>
            ) : transfers.length === 0 ? (
              <tr><td colSpan={8} className="text-gray-500 text-center py-8">No transfers yet.</td></tr>
            ) : (
              transfers.map((t) => (
                <tr key={t._id}>
                  <td>{t.refNo || '—'}</td>
                  <td>{t.item.sku} - {t.item.name}</td>
                  <td>{t.item.unit?.code || t.item.unit?.name || '—'}</td>
                  <td>{t.fromLocation?.name || '—'}</td>
                  <td>{t.toLocation?.name || '—'}</td>
                  <td className="text-right">{t.qty}</td>
                  <td>
                    <span className={`badge ${
                      t.status === 'Completed' ? 'badge-ok' : t.status === 'Cancelled' ? 'badge-bad' : 'badge-warn'
                    }`}>{t.status}</span>
                  </td>
                  <td className="text-right">
                    {t.status === 'Pending' && (
                      <button className="btn-ghost text-xs" onClick={() => receive(t._id)}>
                        Receive
                      </button>
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
          <h2 className="text-lg font-bold mb-4">New Transfer</h2>
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
              <label className="label">From Location</label>
              <select
                className="input"
                value={form.fromLocationId}
                disabled={locs.length === 0}
                onChange={(e) => setForm({
                  ...form,
                  fromLocationId: e.target.value,
                  toLocationId: form.toLocationId === e.target.value ? '' : form.toLocationId,
                })}
                required
              >
                <option value="">— Select source —</option>
                {locs.map((l) => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">To Location</label>
              <select
                className="input"
                value={form.toLocationId}
                disabled={locs.length === 0}
                onChange={(e) => setForm({ ...form, toLocationId: e.target.value })}
                required
              >
                <option value="">— Select destination —</option>
                {locs.map((l) => (
                  <option key={l._id} value={l._id} disabled={l._id === form.fromLocationId}>{l.name}</option>
                ))}
              </select>
            </div>
            {form.itemId && form.fromLocationId && (
              <p className="text-sm text-gray-600">
                Available at source: {availableAtSource ?? 0}. Stock moves when the destination receives the transfer.
              </p>
            )}
            {form.itemId && form.fromLocationId && availableAtSource === undefined && (
              <p className="text-sm text-amber-700">
                No location balance found. Assign existing stock to a location and run <code>npm run migrate:stock-balances</code>.
              </p>
            )}
            {locs.length === 0 && (
              <p className="text-sm text-amber-700">
                Add locations before creating a transfer. <Link className="underline" href="/inventory/locations">Manage locations</Link>
              </p>
            )}
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
              <label className="label">Reference No.</label>
              <input
                className="input"
                name="refNo"
                value={form.refNo}
                onChange={(e) => setForm({ ...form, refNo: e.target.value })}
                placeholder="e.g. TR-1001"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={locs.length === 0 || items.length === 0}>
                Create Transfer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
