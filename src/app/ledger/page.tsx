'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText } from 'lucide-react';
import { getPnlCategoryLabel, isPnlCategory, PNL_CATEGORIES, type PnlCategory } from '@/lib/pnl-categories';

type LedgerEntry = {
  _id: string;
  type: string;
  reference: string;
  description: string;
  pnlCategory?: PnlCategory;
  amount: number;
  balance: number;
  date: string;
  createdBy?: string;
};

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [classifying, setClassifying] = useState<LedgerEntry | null>(null);
  const [classification, setClassification] = useState<PnlCategory | ''>('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    type: 'payment',
    pnlCategory: '',
    reference: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetch('/api/ledger')
      .then((r) => r.json())
      .then((data) => { setEntries(data); setLoading(false); });
  }, []);

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok) {
      setFormError(result?.error || 'Could not add ledger entry.');
      return;
    }
    setEntries((current) => [result, ...current]);
    setOpen(false);
    setFormError('');
    setForm({ type: 'payment', pnlCategory: '', reference: '', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
  };

  const saveClassification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classifying || !classification) return;
    const res = await fetch(`/api/ledger/${classifying._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnlCategory: classification }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok) {
      setFormError(result?.error || 'Could not classify ledger entry.');
      return;
    }
    setEntries((current) => current.map((entry) => entry._id === result._id ? result : entry));
    setClassifying(null);
    setClassification('');
    setFormError('');
  };

  const currentBalance = entries.length > 0 ? entries[0].balance : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn-ghost">
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ledger/profit-loss" className="btn-ghost">
            <FileText size={18} /> Profit &amp; Loss
          </Link>
          <button
            className="btn-primary"
            onClick={() => {
              setFormError('');
              setOpen(true);
            }}
          >
            <Plus size={18} /> Add Entry
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Current Balance</p>
            <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₱{currentBalance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">No ledger entries yet.</p>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>P&amp;L Category</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td>{new Date(e.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${
                      e.type === 'payment' ? 'badge-ok' : e.type === 'purchase' ? 'badge-warn' : e.type === 'adjustment' ? 'badge-bad' : 'badge-ok'
                    }`}>{e.type}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span>{getPnlCategoryLabel(e.pnlCategory ?? 'unclassified')}</span>
                      <button
                        type="button"
                        className="text-sm text-Inpay-600 hover:text-Inpay-700"
                        onClick={() => {
                          setClassifying(e);
                          setClassification('');
                          setFormError('');
                        }}
                      >
                        {e.pnlCategory && e.pnlCategory !== 'unclassified' ? 'Edit' : 'Classify'}
                      </button>
                    </div>
                  </td>
                  <td>{e.reference}</td>
                  <td>{e.description}</td>
                  <td className={`text-right ${e.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {e.amount >= 0 ? '+' : ''}₱{Math.abs(e.amount).toFixed(2)}
                  </td>
                  <td className="text-right font-medium">₱{e.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Add Ledger Entry</h2>
          <form onSubmit={addEntry} className="space-y-3">
            {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="payment">Payment</option>
                  <option value="purchase">Purchase</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="transfer">Transfer</option>
                  <option value="item">Item</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">P&amp;L Category</label>
              <select
                className="input"
                value={form.pnlCategory}
                onChange={(e) => setForm({ ...form, pnlCategory: e.target.value })}
                required
              >
                <option value="">— Select category —</option>
                {PNL_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Reference (SKU, Invoice, etc.)</label>
              <input
                className="input"
                name="reference"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                required
                placeholder="e.g. SKU-001, INV-1001"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                name="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                placeholder="What was this transaction?"
              />
            </div>
            <div>
              <label className="label">Amount (positive income, negative expense)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                name="amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <FileText size={16} /> Add Entry
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={`fixed inset-0 z-50 flex items-center justify-center ${classifying ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setClassifying(null)} />
        <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-2 text-lg font-bold">Classify Ledger Entry</h2>
          {classifying && (
            <p className="mb-4 text-sm text-gray-600">
              {classifying.reference} · {classifying.description} · ₱{Math.abs(classifying.amount).toFixed(2)}
            </p>
          )}
          <form onSubmit={saveClassification} className="space-y-3">
            {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
            <div>
              <label className="label">P&amp;L Category</label>
              <select
                className="input"
                value={classification}
                onChange={(e) => setClassification(isPnlCategory(e.target.value) ? e.target.value : '')}
                required
              >
                <option value="">— Select category —</option>
                {PNL_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setClassifying(null);
                  setFormError('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">Save Category</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
