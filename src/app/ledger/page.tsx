'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Plus, RefreshCw, FileText } from 'lucide-react';
import { getPnlCategoryLabel, isPnlCategory, PNL_CATEGORIES, type PnlCategory } from '@/lib/pnl-categories';

type LedgerEntry = {
  _id: string;
  source?: 'legacy' | 'journal';
  type: string;
  reference: string;
  description: string;
  pnlCategory?: PnlCategory;
  amount: number;
  balance: number | null;
  debit: number | null;
  credit: number | null;
  accounts: string;
  date: string;
  createdBy?: string;
  auditLog?: Array<{
    action: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: string;
  }>;
};

type LedgerAccount = {
  _id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  isActive: boolean;
  balance: number;
  lastReconciliation?: {
    statementDate: string;
    difference: number;
    reference: string;
  } | null;
};

type Filters = { q: string; type: string; category: string; from: string; to: string };

function getLocalDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [open, setOpen] = useState(false);
  const [classifying, setClassifying] = useState<LedgerEntry | null>(null);
  const [classification, setClassification] = useState<PnlCategory | ''>('');
  const [formError, setFormError] = useState('');
  const [filters, setFilters] = useState<Filters>({ q: '', type: '', category: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ q: '', type: '', category: '', from: '', to: '' });
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset' });
  const [accountError, setAccountError] = useState('');
  const [reconciling, setReconciling] = useState<LedgerAccount | null>(null);
  const [reconciliationForm, setReconciliationForm] = useState({
    statementDate: getLocalDateInputValue(),
    actualBalance: '',
    reference: '',
    reason: '',
  });
  const [form, setForm] = useState({
    type: 'payment',
    pnlCategory: '',
    reference: '',
    description: '',
    amount: '',
    date: getLocalDateInputValue(),
    accountCode: 'CASH',
    fromAccountCode: 'CASH',
    toAccountCode: 'BANK',
  });

  const loadData = useCallback(async (nextPage = page, selectedFilters = appliedFilters) => {
    setLoading(true);
    setPageError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      Object.entries(selectedFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const [entriesResponse, accountsResponse] = await Promise.all([
        fetch(`/api/ledger?${params.toString()}`),
        fetch('/api/ledger/accounts'),
      ]);
      const entriesResult = await entriesResponse.json().catch(() => null);
      const accountsResult = await accountsResponse.json().catch(() => null);
      if (!entriesResponse.ok) throw new Error(entriesResult?.error || 'Could not load ledger entries.');
      if (!accountsResponse.ok) throw new Error(accountsResult?.error || 'Could not load ledger accounts.');
      setEntries(entriesResult.entries);
      setTotalEntries(entriesResult.total);
      setAccounts(accountsResult);
    } catch (loadError) {
      setPageError(loadError instanceof Error ? loadError.message : 'Could not load ledger data.');
    } finally {
      setLoading(false);
    }
  }, [page, appliedFilters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addEntry = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || 'Could not add ledger entry.');
      setOpen(false);
      setForm({ type: 'payment', pnlCategory: '', reference: '', description: '', amount: '', date: getLocalDateInputValue(), accountCode: 'CASH', fromAccountCode: 'CASH', toAccountCode: 'BANK' });
      await loadData(1, appliedFilters);
      setPage(1);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Could not add ledger entry.');
    }
  };

  const saveClassification = async (e: FormEvent) => {
    e.preventDefault();
    if (!classifying || !classification) return;
    setFormError('');
    try {
      const res = await fetch(`/api/ledger/${classifying._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnlCategory: classification }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || 'Could not classify ledger entry.');
      setClassifying(null);
      setClassification('');
      await loadData();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Could not classify ledger entry.');
    }
  };

  const reverseEntry = async (entry: LedgerEntry) => {
    if (!confirm(`Create a reversing entry for ${entry.reference}? This will not delete the original.`)) return;
    try {
      const response = await fetch(`/api/ledger/${encodeURIComponent(entry._id)}/reverse`, {
        method: 'POST',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Could not reverse ledger entry.');
      await loadData();
    } catch (reverseError) {
      setPageError(reverseError instanceof Error ? reverseError.message : 'Could not reverse ledger entry.');
    }
  };

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    setAccountError('');
    try {
      const response = await fetch('/api/ledger/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Could not create account.');
      setAccountOpen(false);
      setAccountForm({ code: '', name: '', type: 'asset' });
      await loadData();
    } catch (saveError) {
      setAccountError(saveError instanceof Error ? saveError.message : 'Could not create account.');
    }
  };

  const reconcileAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!reconciling) return;
    setAccountError('');
    try {
      const response = await fetch(`/api/ledger/accounts/${reconciling._id}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reconciliationForm),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Could not reconcile account.');
      setReconciling(null);
      setReconciliationForm({ statementDate: getLocalDateInputValue(), actualBalance: '', reference: '', reason: '' });
      await loadData();
    } catch (saveError) {
      setAccountError(saveError instanceof Error ? saveError.message : 'Could not reconcile account.');
    }
  };

  const pageCount = Math.max(1, Math.ceil(totalEntries / 25));

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
          <a
            className="btn-ghost"
            href={`/api/ledger/export?${new URLSearchParams(Object.fromEntries(
              Object.entries(appliedFilters).filter(([, value]) => value)
            )).toString()}`}
          >
            <Download size={18} /> Export CSV
          </a>
          <button className="btn-ghost" onClick={() => void loadData()}>
            <RefreshCw size={18} /> Refresh
          </button>
          <button className="btn-ghost" onClick={() => { setAccountError(''); setAccountOpen(true); }}>
            <Plus size={18} /> Add Account
          </button>
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

      {pageError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{pageError}</p>}

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Account balances</h2>
            <p className="text-sm text-gray-600">Balances are calculated from balanced journal entries; corrections are recorded as reversals.</p>
          </div>
          <p className="text-sm text-gray-600">Total entries: <span className="font-semibold text-gray-900">{totalEntries}</span></p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {accounts.map((account) => (
            <div key={account._id} className="rounded-md border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase text-gray-500">{account.code} · {account.type}</p>
              <p className="font-medium text-gray-900">{account.name}</p>
              <p className={`text-lg font-bold ${account.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                ₱{account.balance.toFixed(2)}
              </p>
              {account.lastReconciliation && (
                <p className="text-xs text-gray-500">
                  Reconciled {new Date(`${account.lastReconciliation.statementDate.slice(0, 10)}T00:00:00`).toLocaleDateString()} · {account.lastReconciliation.reference}
                  {account.lastReconciliation.difference !== 0 && ` · Difference ₱${account.lastReconciliation.difference.toFixed(2)}`}
                </p>
              )}
              {account.type === 'asset' && account.isActive && (
                <button
                  type="button"
                  className="mt-2 text-sm text-Inpay-600 hover:text-Inpay-700"
                  onClick={() => {
                    setAccountError('');
                    setReconciling(account);
                    setReconciliationForm({
                      statementDate: getLocalDateInputValue(),
                      actualBalance: account.balance.toFixed(2),
                      reference: '',
                      reason: '',
                    });
                  }}
                >
                  Reconcile
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setAppliedFilters(filters);
        }}
        className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow sm:grid-cols-2 xl:grid-cols-6"
      >
        <div className="xl:col-span-2">
          <label className="label" htmlFor="ledger-search">Search</label>
          <input id="ledger-search" className="input" maxLength={100} placeholder="Reference, description, creator" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ledger-type">Type</label>
          <select id="ledger-type" className="input" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">All types</option>
            {['payment', 'purchase', 'adjustment', 'transfer', 'item', 'pos-sale', 'payroll-run', 'reconciliation'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ledger-category">P&amp;L Category</label>
          <select id="ledger-category" className="input" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
            <option value="">All categories</option>
            {PNL_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            <option value="unclassified">Unclassified</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ledger-from">From</label>
          <input id="ledger-from" className="input" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ledger-to">To</label>
          <input id="ledger-to" className="input" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        </div>
        <div className="flex items-end gap-2 xl:col-span-6">
          <button type="submit" className="btn-primary">Apply filters</button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const empty = { q: '', type: '', category: '', from: '', to: '' };
              setFilters(empty);
              setPage(1);
              setAppliedFilters(empty);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No ledger entries match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>P&amp;L Category</th>
                <th>Reference</th>
                <th>Description / Accounts</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Legacy amount</th>
                <th>Created by / history</th>
                <th>Actions</th>
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
                      {e.source === 'legacy' && (
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
                      )}
                    </div>
                  </td>
                  <td>{e.reference}</td>
                  <td>
                    <p>{e.description}</p>
                    {e.accounts && <p className="text-xs text-gray-500">{e.accounts}</p>}
                  </td>
                  <td className="text-right">{e.debit === null ? '—' : `₱${e.debit.toFixed(2)}`}</td>
                  <td className="text-right">{e.credit === null ? '—' : `₱${e.credit.toFixed(2)}`}</td>
                  <td className={`text-right ${e.source === 'legacy' ? (e.amount >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                    {e.source === 'legacy' ? `${e.amount >= 0 ? '+' : ''}₱${Math.abs(e.amount).toFixed(2)}` : '—'}
                  </td>
                  <td>
                    <p>{e.createdBy || '—'}</p>
                    {e.auditLog && e.auditLog.length > 0 && (
                      <details className="text-xs text-gray-600">
                        <summary className="cursor-pointer text-Inpay-600">View changes</summary>
                        <ul className="mt-1 space-y-1">
                          {e.auditLog.map((audit, index) => (
                            <li key={`${audit.changedAt}-${index}`}>
                              {audit.action.replace(/_/g, ' ')}: {audit.oldValue} → {audit.newValue} · {audit.changedBy} · {new Date(audit.changedAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>
                    <button type="button" className="text-sm text-red-700 hover:text-red-900" onClick={() => void reverseEntry(e)}>
                      Reverse
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <button className="btn-ghost" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          </div>
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
            {form.pnlCategory === 'transfer' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">From account</label>
                  <select className="input" value={form.fromAccountCode} onChange={(e) => setForm({ ...form, fromAccountCode: e.target.value })} required>
                    {accounts.filter((account) => account.type === 'asset' && account.isActive).map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">To account</label>
                  <select className="input" value={form.toAccountCode} onChange={(e) => setForm({ ...form, toAccountCode: e.target.value })} required>
                    {accounts.filter((account) => account.type === 'asset' && account.isActive).map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="ledger-account">
                  {['sales_income', 'other_income'].includes(form.pnlCategory) ? 'Deposit account' : 'Payment / adjustment account'}
                </label>
                <select
                  id="ledger-account"
                  className="input"
                  value={form.accountCode}
                  onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
                  required
                >
                  {accounts.filter((account) => account.type === 'asset' && account.isActive).map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}
                </select>
              </div>
            )}
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
              <label className="label">Amount (positive income, negative expense; transfers use a positive amount)</label>
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

        <div className={`fixed inset-0 z-50 flex items-center justify-center ${accountOpen ? '' : 'hidden'}`}>
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setAccountOpen(false)} />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">Add Ledger Account</h2>
            <form onSubmit={createAccount} className="space-y-3">
              {accountError && <p className="text-sm text-red-600" role="alert">{accountError}</p>}
              <div>
                <label className="label" htmlFor="account-code">Account code</label>
                <input id="account-code" className="input" maxLength={20} value={accountForm.code} onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="account-name">Account name</label>
                <input id="account-name" className="input" maxLength={100} value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="account-type">Account type</label>
                <select id="account-type" className="input" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setAccountOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Account</button>
              </div>
            </form>
          </div>
        </div>

        <div className={`fixed inset-0 z-50 flex items-center justify-center ${reconciling ? '' : 'hidden'}`}>
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setReconciling(null)} />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold">Reconcile {reconciling?.name}</h2>
            <p className="mb-4 text-sm text-gray-600">
              Book balance: ₱{(reconciling?.balance ?? 0).toFixed(2)}. Reconciliation records a balanced adjustment; it does not edit prior entries.
            </p>
            <form onSubmit={reconcileAccount} className="space-y-3">
              {accountError && <p className="text-sm text-red-600" role="alert">{accountError}</p>}
              <div>
                <label className="label" htmlFor="reconcile-date">Statement date</label>
                <input id="reconcile-date" className="input" type="date" value={reconciliationForm.statementDate} onChange={(event) => setReconciliationForm({ ...reconciliationForm, statementDate: event.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="actual-balance">Actual cash / statement balance</label>
                <input id="actual-balance" className="input" type="number" min={0} step="0.01" value={reconciliationForm.actualBalance} onChange={(event) => setReconciliationForm({ ...reconciliationForm, actualBalance: event.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="reconcile-reference">Statement / count reference</label>
                <input id="reconcile-reference" className="input" maxLength={100} value={reconciliationForm.reference} onChange={(event) => setReconciliationForm({ ...reconciliationForm, reference: event.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="reconcile-reason">Reason for difference</label>
                <textarea id="reconcile-reason" className="input" maxLength={500} value={reconciliationForm.reason} onChange={(event) => setReconciliationForm({ ...reconciliationForm, reason: event.target.value })} required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setReconciling(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Record Reconciliation</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
