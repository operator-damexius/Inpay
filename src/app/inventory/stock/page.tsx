'use client';

import { useEffect, useState } from 'react';

type Item = {
  _id: string;
  sku: string;
  name: string;
  icon?: string;
  price: number;
  stockOnHand: number;
  reorderLevel: number;
  category?: { name: string };
  location?: { name: string };
  unit?: { name: string; code: string };
};

type StockBalance = {
  _id: string;
  item: Item;
  location: { name: string };
  quantity: number;
};

type StockRow = {
  key: string;
  item: Item;
  location: string;
  quantity: number;
  needsLocation: boolean;
};

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadStock = async () => {
      try {
        const [itemsResponse, balancesResponse] = await Promise.all([
          fetch('/api/inventory/items'),
          fetch('/api/inventory/stock-balances'),
        ]);
        const [itemsData, balancesData]: [unknown, unknown] = await Promise.all([
          itemsResponse.json(),
          balancesResponse.json(),
        ]);
        if (!itemsResponse.ok || !Array.isArray(itemsData)) {
          throw new Error('Could not load items for stock status.');
        }
        if (!balancesResponse.ok || !Array.isArray(balancesData)) {
          throw new Error('Could not load location stock balances.');
        }
        setItems(itemsData);
        setBalances(balancesData);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load stock.');
      } finally {
        setLoading(false);
      }
    };

    void loadStock();
  }, []);

  const balanceItemIds = new Set(balances.map((balance) => balance.item._id));
  const rows: StockRow[] = [
    ...balances.map((balance) => ({
      key: balance._id,
      item: balance.item,
      location: balance.location?.name || 'Unknown location',
      quantity: balance.quantity,
      needsLocation: false,
    })),
    ...items
      .filter((item) => !balanceItemIds.has(item._id))
      .map((item) => ({
        key: item._id,
        item,
        location: item.location?.name || 'Unassigned',
        quantity: item.stockOnHand,
        needsLocation: !item.location && item.stockOnHand > 0,
      })),
  ];
  const filtered = rows.filter(
    ({ item }) =>
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase())
  );
  const listedItems = new Set(filtered.map(({ item }) => item._id)).size;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Stock Status</h1>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <input
          className="input w-full max-w-md mb-2"
          placeholder="Search SKU or item name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Items Listed</div>
            <div className="font-bold">{listedItems}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Total Value</div>
            <div className="font-bold">₱{filtered.reduce((sum, row) => sum + row.item.price * row.quantity, 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Low Stock</div>
            <div className="font-bold text-red-600">
              {filtered.filter((row) => row.item.reorderLevel > 0 && row.quantity <= row.item.reorderLevel).length}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Total On Hand</div>
            <div className="font-bold">{filtered.reduce((sum, row) => sum + row.quantity, 0)}</div>
          </div>
        </div>
      </div>

      {loadError && <p className="text-red-600" role="alert">{loadError}</p>}

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Category</th>
              <th>Location</th>
              <th>Unit</th>
              <th className="text-right">Price</th>
              <th className="text-right">On Hand</th>
              <th className="text-right">Reorder</th>
              <th className="text-right">Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-gray-500 text-center py-8">Loading...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={10} className="text-red-600 text-center py-8">{loadError}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-gray-500 text-center py-8">No items.</td></tr>
            ) : (
              filtered.map(({ key, item, location, quantity, needsLocation }) => {
                const low = item.reorderLevel > 0 && quantity <= item.reorderLevel;
                return (
                  <tr key={key} className={low ? 'bg-red-50' : ''}>
                    <td>{item.sku}</td>
                    <td>{item.icon} {item.name}</td>
                    <td>{item.category?.name || '—'}</td>
                    <td>{location}</td>
                    <td>{item.unit?.code || item.unit?.name || '—'}</td>
                    <td className="text-right">₱{item.price.toFixed(2)}</td>
                    <td className="text-right">{quantity}</td>
                    <td className="text-right">{item.reorderLevel}</td>
                    <td className="text-right">₱{(item.price * quantity).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${needsLocation ? 'badge-warn' : low ? 'badge-bad' : 'badge-ok'}`}>
                        {needsLocation ? 'LOCATION NEEDED' : low ? 'LOW STOCK' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
