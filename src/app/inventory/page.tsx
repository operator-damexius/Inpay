'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { ResponsiveContainer, Treemap } from 'recharts';

type DashboardItem = {
  _id: string;
  sku: string;
  name: string;
  price: number;
  stockOnHand: number;
  reorderLevel: number;
  location?: { _id: string; name: string } | null;
  unit?: { code: string } | null;
};

type DashboardStockBalance = {
  _id: string;
  item: DashboardItem;
  location: { _id: string; name: string };
  quantity: number;
};

type LocationStock = {
  id: string;
  name: string;
  stockValue: number;
  itemCount: number;
  fill: string;
};

type DashboardTransfer = {
  status: string;
};

type DashboardActivity = {
  id: string;
  kind: 'adjustment' | 'purchase' | 'transfer' | 'sale';
  title: string;
  description: string;
  quantityLabel: string;
  createdAt: string;
};

type InventorySummary = {
  totalItems: number;
  lowStock: number;
  totalStockValue: number;
  pendingTransfers: number;
  recentActivity: DashboardActivity[];
};

const LOCATION_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d'];
const ACTIVITY_LABELS: Record<DashboardActivity['kind'], string> = {
  adjustment: 'Adjustment',
  purchase: 'Purchase',
  transfer: 'Transfer',
  sale: 'POS Sale',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

function LocationTreemapCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = '',
  stockValue = 0,
  itemCount = 0,
  fill = '#2563eb',
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  stockValue?: number;
  itemCount?: number;
  fill?: string;
}) {
  const labelLength = Math.max(1, Math.floor((width - 16) / 7));

  return (
    <g>
      <title>
        {`${name}: ${formatCurrency(stockValue)} · ${itemCount} items`}
      </title>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={3} />
      {width > 65 && height > 28 && (
        <text x={x + 10} y={y + 22} fill="#fff" fontSize={13}>
          {name.length > labelLength ? `${name.slice(0, labelLength - 1)}…` : name}
        </text>
      )}
      {width > 125 && height > 58 && (
        <>
          <text x={x + 10} y={y + 43} fill="#fff" fontSize={12}>
            {formatCurrency(stockValue)}
          </text>
          {height > 76 && (
            <text x={x + 10} y={y + 62} fill="#fff" fontSize={11}>
              {itemCount} items
            </text>
          )}
        </>
      )}
    </g>
  );
}

function LocationStockTreemap({
  locations,
  expanded = false,
}: {
  locations: LocationStock[];
  expanded?: boolean;
}) {
  return (
    <div className={expanded ? 'h-[60vh] min-h-96 w-full' : 'h-80 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={locations}
          dataKey="stockValue"
          nameKey="name"
          aspectRatio={4 / 3}
          stroke="#fff"
          content={<LocationTreemapCell />}
          isAnimationActive={false}
        />
      </ResponsiveContainer>
    </div>
  );
}

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
  if (!Array.isArray(data)) throw new Error(`Unexpected response from ${url}`);
  return data as T[];
}

export default function InventoryDashboard() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [locationStock, setLocationStock] = useState<LocationStock[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [locationExpanded, setLocationExpanded] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [items, transfers, activity] = await Promise.all([
          fetchArray<DashboardItem>('/api/inventory/items'),
          fetchArray<DashboardTransfer>('/api/inventory/stock-transfers'),
          fetchArray<DashboardActivity>('/api/inventory/recent-activity'),
        ]);
        if (items.some((item) =>
          !Number.isFinite(item.price) ||
          !Number.isFinite(item.stockOnHand) ||
          !Number.isFinite(item.reorderLevel)
        )) {
          throw new Error('Inventory item values are invalid.');
        }

        setSummary({
          totalItems: items.length,
          lowStock: items.filter((item) => item.reorderLevel > 0 && item.stockOnHand <= item.reorderLevel).length,
          totalStockValue: items.reduce((total, item) => total + item.price * item.stockOnHand, 0),
          pendingTransfers: transfers.filter((transfer) => transfer.status === 'Pending').length,
          recentActivity: activity,
        });

        try {
          const balances = await fetchArray<DashboardStockBalance>('/api/inventory/stock-balances');
          const balancedItemIds = new Set(balances.map((balance) => balance.item._id));
          const totals = new Map<string, {
            name: string;
            stockValue: number;
            itemIds: Set<string>;
          }>();

          const addStock = (
            itemId: string,
            locationId: string,
            locationName: string,
            quantity: number,
            price: number,
          ) => {
            if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) {
              throw new Error('Location stock contains an invalid quantity or item price.');
            }
            const location = totals.get(locationId) ?? {
              name: locationName,
              stockValue: 0,
              itemIds: new Set<string>(),
            };
            location.stockValue += quantity * price;
            location.itemIds.add(itemId);
            totals.set(locationId, location);
          };

          balances.forEach((balance) => {
            addStock(
              balance.item._id,
              balance.location._id,
              balance.location.name,
              balance.quantity,
              balance.item.price,
            );
          });

          items
            .filter((item) => !balancedItemIds.has(item._id))
            .forEach((item) => {
              addStock(
                item._id,
                item.location?._id || 'unassigned',
                item.location?.name || 'Unassigned',
                item.stockOnHand,
                item.price,
              );
            });

          setLocationStock(
            Array.from(totals.entries())
              .filter(([, location]) => location.stockValue > 0)
              .sort(([, a], [, b]) => b.stockValue - a.stockValue)
              .map(([id, location], index) => ({
                id,
                name: location.name,
                stockValue: location.stockValue,
                itemCount: location.itemIds.size,
                fill: LOCATION_COLORS[index % LOCATION_COLORS.length],
              }))
          );
        } catch (error) {
          setLocationError(error instanceof Error ? error.message : 'Could not load location stock.');
        } finally {
          setLocationLoading(false);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load inventory dashboard.');
        setLocationError('Could not load location stock.');
        setLocationLoading(false);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const metric = (value: string | number) =>
    loading ? 'Loading...' : loadError || !summary ? '—' : value;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
        <p className="text-gray-600">Manage items, stock, transfers, and purchasing.</p>
      </div>

      {loadError && <p className="text-red-600" role="alert">Could not load dashboard data: {loadError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metric(summary?.totalItems ?? 0)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{metric(summary?.lowStock ?? 0)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Stock Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {loading ? 'Loading...' : loadError || !summary ? '—' : `₱${summary.totalStockValue.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Transfers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metric(summary?.pendingTransfers ?? 0)}</p>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stock Value by Location</h2>
            <p className="text-sm text-gray-500">Tile size represents the value of stock at each location.</p>
          </div>
          <button
            type="button"
            className="btn-ghost px-3 py-2"
            onClick={() => setLocationExpanded(true)}
            disabled={locationLoading || Boolean(locationError) || locationStock.length === 0}
            aria-label="Enlarge stock value by location"
            title="Enlarge chart"
          >
            <Maximize2 size={16} />
            <span className="sr-only">Enlarge chart</span>
          </button>
        </div>
        {locationLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading location stock...</p>
        ) : locationError ? (
          <p className="py-8 text-center text-sm text-red-600" role="alert">{locationError}</p>
        ) : locationStock.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No positive stock value to chart. Items with zero stock value are omitted.
          </p>
        ) : (
          <LocationStockTreemap locations={locationStock} />
        )}
      </section>

      {locationExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expanded-location-treemap-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLocationExpanded(false);
          }}
        >
          <div className="max-h-[95vh] w-full max-w-7xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="expanded-location-treemap-title" className="text-xl font-bold text-gray-900">
                  Stock Value by Location
                </h2>
                <p className="text-sm text-gray-500">Hover over a tile for its stock value and item count.</p>
              </div>
              <button
                type="button"
                className="btn-ghost px-3 py-2"
                onClick={() => setLocationExpanded(false)}
                aria-label="Close enlarged location treemap"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <LocationStockTreemap locations={locationStock} expanded />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 px-4 text-right">Items</th>
                    <th className="py-2 pl-4 text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {locationStock.map((location) => (
                    <tr key={location.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4">{location.name}</td>
                      <td className="py-2 px-4 text-right">{location.itemCount}</td>
                      <td className="py-2 pl-4 text-right whitespace-nowrap">{formatCurrency(location.stockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Stock Activity</h2>
              <Link href="/inventory/adjustments" className="text-sm text-Inpay-600 hover:text-Inpay-700">
                Manage adjustments
              </Link>
            </div>
            {loading ? (
              <p className="text-sm text-gray-500">Loading stock activity...</p>
            ) : loadError || !summary ? (
              <p className="text-sm text-gray-500">Stock activity unavailable.</p>
            ) : summary.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">No stock activity yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {summary.recentActivity.map((activity) => (
                  <li key={activity.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">
                        {activity.description} · {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`badge ${
                        activity.kind === 'purchase' ? 'badge-ok'
                          : activity.kind === 'sale' ? 'badge-bad'
                            : activity.kind === 'transfer' ? 'badge-warn' : ''
                      }`}>
                        {ACTIVITY_LABELS[activity.kind]}
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.quantityLabel}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/inventory/items" className="btn-primary w-full">
              + Add Item
            </Link>
            <Link href="/inventory/stock" className="btn-ghost w-full">
              Stock Status
            </Link>
            <Link href="/inventory/adjustments" className="btn-ghost w-full">
              Adjust Stock
            </Link>
            <Link href="/inventory/transfers" className="btn-ghost w-full">
              Transfers
            </Link>
            <Link href="/inventory/purchasing" className="btn-ghost w-full">
              Purchasing
            </Link>
            <Link href="/inventory/categories" className="btn-ghost w-full">
              Categories
            </Link>
            <Link href="/inventory/units" className="btn-ghost w-full">
              Units
            </Link>
            <Link href="/inventory/locations" className="btn-ghost w-full">
              Locations
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
