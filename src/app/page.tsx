'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Maximize2, X } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

type Item = {
  _id: string;
  sku: string;
  name: string;
  price: number;
  stockOnHand: number;
  category?: { name: string };
};

type CategorySummary = {
  name: string;
  value: number;
  itemCount: number;
  quantity: number;
};

function TopItemsValueChart({
  items,
  expanded = false,
}: {
  items: Array<Item & { stockValue: number }>;
  expanded?: boolean;
}) {
  return (
    <div className={expanded ? 'h-[60vh] min-h-96 w-full' : 'h-64 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} margin={{ top: 8, right: 16, bottom: expanded ? 36 : 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: expanded ? 13 : 11 }}
            interval={0}
            angle={expanded ? -20 : -30}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompactCurrency} />
          <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Stock value']} />
          <Bar dataKey="stockValue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryValueBreakdown({
  categories,
  categoryValue,
  totalItems,
  totalQuantity,
  expanded = false,
}: {
  categories: CategorySummary[];
  categoryValue: number;
  totalItems: number;
  totalQuantity: number;
  expanded?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 ${expanded ? 'xl:grid-cols-2' : '2xl:grid-cols-2'} gap-4 items-center`}>
      <div className={expanded ? 'h-[28rem] w-full' : 'h-64 w-full'}>
        {categories.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            No stock data to display.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                cx="50%"
                cy="50%"
                innerRadius={expanded ? 90 : 55}
                outerRadius={expanded ? 150 : 95}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
              >
                {categories.map((category, index) => (
                  <Cell key={category.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 px-2 text-right">Items</th>
              <th className="py-2 px-2 text-right">On Hand</th>
              <th className="py-2 pl-2 text-right">Stock Value</th>
              <th className="py-2 pl-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category.name} className="border-b border-gray-100">
                <td className="py-2 pr-3">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {category.name}
                </td>
                <td className="py-2 px-2 text-right">{category.itemCount}</td>
                <td className="py-2 px-2 text-right">{category.quantity}</td>
                <td className="py-2 pl-2 text-right whitespace-nowrap">{formatCurrency(category.value)}</td>
                <td className="py-2 pl-2 text-right">
                  {categoryValue > 0 ? `${((category.value / categoryValue) * 100).toFixed(1)}%` : '0.0%'}
                </td>
              </tr>
            ))}
            <tr className="font-semibold text-gray-900">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 px-2 text-right">{totalItems}</td>
              <td className="py-2 px-2 text-right">{totalQuantity}</td>
              <td className="py-2 pl-2 text-right whitespace-nowrap">{formatCurrency(categoryValue)}</td>
              <td className="py-2 pl-2 text-right">{categoryValue > 0 ? '100%' : '0.0%'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryExpanded, setCategoryExpanded] = useState(false);
  const [topItemsExpanded, setTopItemsExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/inventory/items')
      .then((r) => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  // Top 8 items by stock value
  const topItems = items
    .map((item) => ({ ...item, stockValue: item.price * item.stockOnHand }))
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 8);

  // Category breakdown
  const categoryMap = new Map<string, { name: string; value: number; itemCount: number; quantity: number }>();
  items.forEach((i) => {
    const cat = i.category?.name || 'Uncategorized';
    const val = i.price * i.stockOnHand;
    const summary = categoryMap.get(cat) || { name: cat, value: 0, itemCount: 0, quantity: 0 };
    summary.value += val;
    summary.itemCount += 1;
    summary.quantity += i.stockOnHand;
    categoryMap.set(cat, summary);
  });
  const categoryData = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value);

  const totalValue = items.reduce((sum, i) => sum + i.price * i.stockOnHand, 0);
  const categoryValue = categoryData.reduce((sum, category) => sum + category.value, 0);
  const totalItems = items.length;
  const lowStock = items.filter((i) => i.stockOnHand <= (i as any).reorderLevel && (i as any).reorderLevel > 0).length;
  const totalQuantity = items.reduce((sum, item) => sum + item.stockOnHand, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-Inpay-600"></div>
      </div>
    );
  }

  return (
    <AppShell>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Overview of your inventory and payroll.</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Items</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalItems}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Stock Value</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₱{totalValue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Stock Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${lowStock > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {lowStock}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Top Items by Stock Value</h2>
              <button
                type="button"
                className="btn-ghost px-3 py-2"
                onClick={() => setTopItemsExpanded(true)}
                aria-label="Enlarge top items by stock value"
                title="Enlarge chart"
              >
                <Maximize2 size={16} />
                <span className="sr-only">Enlarge chart</span>
              </button>
            </div>
            <TopItemsValueChart items={topItems} />
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Stock Value by Category</h2>
              <button
                type="button"
                className="btn-ghost px-3 py-2"
                onClick={() => setCategoryExpanded(true)}
                aria-label="Enlarge stock value by category"
                title="Enlarge chart"
              >
                <Maximize2 size={16} />
                <span className="sr-only">Enlarge chart</span>
              </button>
            </div>
            <CategoryValueBreakdown
              categories={categoryData}
              categoryValue={categoryValue}
              totalItems={totalItems}
              totalQuantity={totalQuantity}
            />
          </div>
        </div>

        {topItemsExpanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-top-items-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setTopItemsExpanded(false);
            }}
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 id="expanded-top-items-title" className="text-xl font-bold text-gray-900">
                  Top Items by Stock Value
                </h2>
                <button
                  type="button"
                  className="btn-ghost px-3 py-2"
                  onClick={() => setTopItemsExpanded(false)}
                  aria-label="Close enlarged top items chart"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <TopItemsValueChart items={topItems} expanded />
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pr-4">SKU</th>
                      <th className="py-2 pr-4">Item</th>
                      <th className="py-2 px-4 text-right">On Hand</th>
                      <th className="py-2 px-4 text-right">Unit Price</th>
                      <th className="py-2 pl-4 text-right">Stock Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item) => (
                      <tr key={item._id} className="border-b border-gray-100">
                        <td className="py-2 pr-4">{item.sku}</td>
                        <td className="py-2 pr-4">{item.name}</td>
                        <td className="py-2 px-4 text-right">{item.stockOnHand}</td>
                        <td className="py-2 px-4 text-right whitespace-nowrap">{formatCurrency(item.price)}</td>
                        <td className="py-2 pl-4 text-right whitespace-nowrap">{formatCurrency(item.stockValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {categoryExpanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-category-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCategoryExpanded(false);
            }}
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 id="expanded-category-title" className="text-xl font-bold text-gray-900">
                  Stock Value by Category
                </h2>
                <button
                  type="button"
                  className="btn-ghost px-3 py-2"
                  onClick={() => setCategoryExpanded(false)}
                  aria-label="Close enlarged chart"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <CategoryValueBreakdown
                categories={categoryData}
                categoryValue={categoryValue}
                totalItems={totalItems}
                totalQuantity={totalQuantity}
                expanded
              />
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/inventory/items" className="btn-primary w-full">
              + Add Item
            </Link>
            <Link href="/inventory/stock" className="btn-ghost w-full">
              Stock Status
            </Link>
            <Link href="/payroll/employees" className="btn-ghost w-full">
              + Add Employee
            </Link>
            <Link href="/payroll/attendance" className="btn-ghost w-full">
              Record Attendance
            </Link>
          </div>
        </div>
    </AppShell>
  );
}
