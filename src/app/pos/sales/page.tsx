'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';

type Sale = {
  _id: string;
  receiptNo: string;
  cashierName: string;
  customer: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
  location: { name: string };
};
type SalesPage = { sales: Sale[]; total: number; page: number; pageSize: number };

const paymentLabels: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash / E-wallet',
  bank_transfer: 'Bank transfer',
  card: 'Card',
};
const currency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

export default function PosSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), q: search });
    setLoading(true);
    setError('');

    fetch(`/api/pos/sales?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = typeof result === 'object' && result !== null &&
            'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Could not load sales.';
          throw new Error(message);
        }
        if (
          typeof result !== 'object' || result === null ||
          !('sales' in result) || !Array.isArray(result.sales) ||
          !('total' in result) || typeof result.total !== 'number' ||
          !('pageSize' in result) || typeof result.pageSize !== 'number'
        ) {
          throw new Error('Unexpected POS sales response.');
        }
        const salesPage = result as SalesPage;
        setSales(salesPage.sales);
        setTotal(salesPage.total);
        setPageSize(salesPage.pageSize);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load sales.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, search]);

  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/pos" className="btn-ghost"><ArrowLeft size={18} /> Back to POS</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Sales History</h1>
            <p className="text-sm text-gray-600">Search all completed receipts</p>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- This endpoint streams a CSV download. */}
        <a href="/api/pos/sales/export" className="btn-ghost">
          <Download size={17} /> Export all CSV
        </a>
      </div>

      <label className="block max-w-xl">
        <span className="label">Search sales</span>
        <span className="relative block">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Receipt, customer, cashier, location, or payment"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-gray-500">Loading sales...</p> : error && !sales.length ? null : !sales.length ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-gray-500">
          {search ? 'No receipts match your search.' : 'No POS sales have been recorded.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
            <table className="table">
              <thead>
                <tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Location</th><th>Payment</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale._id}>
                    <td><Link className="font-medium text-Inpay-700 hover:underline" href={`/pos/sales/${sale._id}`}>{sale.receiptNo}</Link></td>
                    <td>{new Date(sale.createdAt).toLocaleString()}</td>
                    <td>{sale.customer}</td>
                    <td>{sale.cashierName}</td>
                    <td>{sale.location?.name || '—'}</td>
                    <td>{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</td>
                    <td className="text-right font-medium">{currency(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing {firstResult}–{lastResult} of {total} receipts
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft size={17} /> Previous
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={page * pageSize >= total}
                onClick={() => setPage((current) => current + 1)}
              >
                Next <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
