'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getPnlCategoryLabel, isPnlCategory, type PnlCategory } from '@/lib/pnl-categories';

type ExpenseCategory = {
  type: PnlCategory;
  amount: number;
};

type ProfitLossReport = {
  income: number;
  expenses: number;
  netProfit: number;
  entryCount: number;
  unclassifiedCount: number;
  nonPnlCount: number;
  expensesByType: ExpenseCategory[];
};

type DateRange = {
  from: string;
  to: string;
};

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d'];

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getInitialRange(): DateRange {
  const today = new Date();
  return {
    from: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toDateInputValue(today),
  };
}

function isProfitLossReport(value: unknown): value is ProfitLossReport {
  if (typeof value !== 'object' || value === null) return false;
  const report = value as Record<string, unknown>;
  return (
    typeof report.income === 'number' &&
    typeof report.expenses === 'number' &&
    typeof report.netProfit === 'number' &&
    typeof report.entryCount === 'number' &&
    typeof report.unclassifiedCount === 'number' &&
    typeof report.nonPnlCount === 'number' &&
    Array.isArray(report.expensesByType) &&
    report.expensesByType.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'type' in entry &&
        isPnlCategory(entry.type) &&
        'amount' in entry &&
        typeof entry.amount === 'number'
    )
  );
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

function formatType(type: string) {
  return isPnlCategory(type) ? getPnlCategoryLabel(type) : type;
}

export default function ProfitLossPage() {
  const initialRange = getInitialRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loadedRange, setLoadedRange] = useState(initialRange);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadReport = async () => {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams(loadedRange);
        const response = await fetch(`/api/ledger/profit-loss?${query.toString()}`);
        const result: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof result === 'object' &&
            result !== null &&
            'error' in result &&
            typeof result.error === 'string'
              ? result.error
              : 'Unable to load the Profit & Loss report.';
          throw new Error(message);
        }
        if (!isProfitLossReport(result)) {
          throw new Error('The Profit & Loss API returned an unexpected response.');
        }
        if (active) setReport(result);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the report.');
          setReport(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReport();
    return () => {
      active = false;
    };
  }, [loadedRange]);

  const generateReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!from || !to) {
      setError('Choose both a start and end date.');
      return;
    }
    if (from > to) {
      setError('The start date must be on or before the end date.');
      return;
    }
    setLoadedRange({ from, to });
  };

  const metric = (value: number, className = 'text-gray-900') => (
    <p className={`mt-1 text-2xl font-bold ${className}`}>
      {loading ? 'Loading...' : error || !report ? '—' : formatCurrency(value)}
    </p>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ledger" className="btn-ghost">
            <ArrowLeft size={18} /> Back to Ledger
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profit &amp; Loss</h1>
            <p className="text-sm text-gray-600">Ledger-based estimate</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Only entries assigned to an income or expense category are included. Transfers and adjustments are
        excluded. Payroll and inventory purchases count only when recorded in the ledger and assigned a P&amp;L
        category; they are not automatically imported from their separate records. POS receipts are retained
        separately in Sales History and are not currently posted to the ledger or included in this report.
      </div>

      <form
        onSubmit={generateReport}
        className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow sm:flex-row sm:items-end"
      >
        <div>
          <label className="label" htmlFor="profit-loss-from">From</label>
          <input
            id="profit-loss-from"
            className="input"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="profit-loss-to">To</label>
          <input
            id="profit-loss-to"
            className="input"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
        </div>
        <button className="btn-primary" type="submit">Generate Report</button>
      </form>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Income</p>
          {metric(report?.income ?? 0, 'text-green-700')}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Expenses</p>
          {metric(report?.expenses ?? 0, 'text-red-700')}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Net Profit / (Loss)</p>
          {metric(report?.netProfit ?? 0, (report?.netProfit ?? 0) >= 0 ? 'text-gray-900' : 'text-red-700')}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ledger Entries</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? 'Loading...' : error || !report ? '—' : report.entryCount}
          </p>
        </div>
      </div>

      {report && (report.unclassifiedCount > 0 || report.nonPnlCount > 0) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Excluded from the totals: {report.unclassifiedCount} unclassified and {report.nonPnlCount} non-P&amp;L
          ledger entries. <Link href="/ledger" className="font-semibold underline">Review them in the Ledger</Link>.
        </p>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Expense Breakdown</h2>
        <p className="mb-4 text-sm text-gray-500">Expenses grouped by P&amp;L category.</p>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading expense data...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">Expense data is unavailable.</p>
        ) : !report?.expensesByType.length ? (
          <p className="py-8 text-center text-sm text-gray-500">No expenses in the selected date range.</p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.expensesByType}
                    dataKey="amount"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                  >
                    {report.expensesByType.map((entry, index) => (
                      <Cell key={entry.type} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Expenses']} />
                  <Legend formatter={(value) => formatType(String(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Expense Category</th>
                    <th className="py-2 px-4 text-right">Amount</th>
                    <th className="py-2 pl-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expensesByType.map((entry, index) => (
                    <tr key={entry.type} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        {formatType(entry.type)}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">{formatCurrency(entry.amount)}</td>
                      <td className="py-2 pl-4 text-right">
                        {report.expenses > 0
                          ? `${((entry.amount / report.expenses) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
