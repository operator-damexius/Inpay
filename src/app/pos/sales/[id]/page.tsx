'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

type Receipt = {
  receiptNo: string;
  cashierName: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  customer: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  location: { name: string };
  items: Array<{ sku: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

const currency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

export default function PosReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void params.then(({ id }) => fetch(`/api/pos/sales/${id}`).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Could not load receipt.');
      if (active) setReceipt(result);
    })).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load receipt.');
    });
    return () => { active = false; };
  }, [params]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/pos/sales" className="btn-ghost print:hidden"><ArrowLeft size={18} /> Sales history</Link>
        {receipt && <button className="btn-primary print:hidden" onClick={() => window.print()}>Print receipt</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!receipt && !error ? <p className="text-gray-500">Loading receipt...</p> : receipt && (
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow print:border-0 print:shadow-none">
          <header className="border-b border-gray-200 pb-4 text-center">
            <h1 className="text-xl font-bold">{receipt.businessName || 'Inpay'}</h1>
            <p className="text-sm text-gray-500">Sales receipt</p>
            {receipt.businessAddress && <p className="text-sm text-gray-600">{receipt.businessAddress}</p>}
            {receipt.businessPhone && <p className="text-sm text-gray-600">{receipt.businessPhone}</p>}
            <p className="mt-3 font-semibold">{receipt.receiptNo}</p>
            <p className="text-sm text-gray-600">{new Date(receipt.createdAt).toLocaleString()}</p>
          </header>
          <div className="grid grid-cols-2 gap-3 border-b border-gray-200 py-4 text-sm">
            <p>Customer: <span className="font-medium">{receipt.customer}</span></p>
            <p>Cashier: <span className="font-medium">{receipt.cashierName}</span></p>
            <p>Location: <span className="font-medium">{receipt.location?.name || '—'}</span></p>
            <p>Payment: <span className="font-medium">{receipt.paymentMethod}</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={`${item.sku}-${index}`}>
                    <td>{item.name}<span className="block text-xs text-gray-500">{item.sku}</span></td>
                    <td className="text-right">{item.quantity} {item.unit}</td>
                    <td className="text-right">{currency(item.unitPrice)}</td>
                    <td className="text-right">{currency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{currency(receipt.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{currency(receipt.tax)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold"><span>Total</span><span>{currency(receipt.total)}</span></div>
          </div>
        </article>
      )}
    </div>
  );
}
