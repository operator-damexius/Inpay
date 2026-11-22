'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, ReceiptText, Search, ShoppingCart } from 'lucide-react';

type Cashier = { _id: string; employeeNo: string; name: string };
type Location = { _id: string; name: string; code: string };
type Item = {
  _id: string;
  sku: string;
  name: string;
  icon?: string;
  sellingPrice: number;
  isActive: boolean;
  unit?: { name?: string; code?: string };
};
type Balance = { itemId: string; locationId: string; quantity: number };
type PosCatalog = { items: Item[]; locations: Location[]; balances: Balance[] };
type PosConfig = {
  businessName: string;
  paymentMethods: string[];
  quantityPrecision: number;
  taxEnabled: boolean;
};
type CartLine = { item: Item; quantity: number; quantityInput: string };
type PendingSale = {
  idempotencyKey: string;
  locationId: string;
  customer: string;
  paymentMethod: string;
  items: Array<{ itemId: string; quantity: number }>;
  timestamp: number;
};
type Sale = {
  _id: string;
  receiptNo: string;
  cashierName: string;
  businessName: string;
  customer: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  items: Array<{
    sku: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  location: Location;
};

const paymentLabels: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash / E-wallet',
  bank_transfer: 'Bank transfer',
  card: 'Card',
};
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

async function readJson<T = unknown>(response: Response): Promise<T> {
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result &&
      typeof result.error === 'string'
      ? result.error
      : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return result as T;
}

export default function PosPage() {
  const [cashier, setCashier] = useState<Cashier | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employeeNo, setEmployeeNo] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [locationId, setLocationId] = useState('');
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/pos/auth/session')
      .then(readJson<{ cashier: Cashier | null }>)
      .then((result) => setCashier(result.cashier))
      .catch((sessionError) => setLoginError(
        sessionError instanceof Error ? sessionError.message : 'Could not verify cashier session.'
      ))
      .finally(() => setCheckingSession(false));
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextConfig, catalog] = await Promise.all([
        fetch('/api/pos/config').then(readJson<PosConfig>),
        fetch('/api/pos/catalog').then(readJson<PosCatalog>),
      ]);
      setConfig(nextConfig);
      setItems(catalog.items.filter((item) => item.isActive));
      setLocations(catalog.locations);
      setBalances(catalog.balances);
      const defaultLocation = catalog.locations.find(
        (location) => location.name.trim().toLowerCase() === 'main warehouse'
      ) || catalog.locations[0];
      setLocationId((current) => current || defaultLocation?._id || '');
      setPaymentMethod((current) => current || nextConfig.paymentMethods[0] || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load POS data.');
      if (loadError instanceof Error && loadError.message.includes('Cashier sign-in')) {
        setCashier(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cashier) void loadCatalog();
  }, [cashier, loadCatalog]);

  const availableByItem = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const balance of balances) {
      if (balance.locationId === locationId) {
        quantities.set(balance.itemId, balance.quantity);
      }
    }
    return quantities;
  }, [balances, locationId]);

  const filteredItems = items.filter((item) => {
    const term = query.trim().toLowerCase();
    return !term || item.name.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term);
  });
  const subtotal = Math.round(cart.reduce((total, line) => total + line.item.sellingPrice * line.quantity, 0) * 100) / 100;
  const precision = config?.quantityPrecision ?? 2;
  const quantityStep = 1 / (10 ** precision);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    setSigningIn(true);
    try {
      const result = await readJson<{ cashier: Cashier }>(await fetch('/api/pos/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeNo, pin }),
      }));
      setCashier(result.cashier);
      setPin('');
    } catch (signInError) {
      setLoginError(signInError instanceof Error ? signInError.message : 'Could not sign in.');
    } finally {
      setSigningIn(false);
    }
  };

  const addItem = (item: Item) => {
    setSale(null);
    setCart((current) => {
      const existing = current.find((line) => line.item._id === item._id);
      if (existing) {
        if (existing.quantity + 1 > (availableByItem.get(item._id) || 0)) return current;
        return current.map((line) => line.item._id === item._id
          ? { ...line, quantity: line.quantity + 1, quantityInput: String(line.quantity + 1) }
          : line
        );
      }
      const quantity = Math.min(1, availableByItem.get(item._id) || 0);
      return [...current, { item, quantity, quantityInput: String(quantity) }];
    });
  };

  const updateQuantity = (itemId: string, value: string) => {
    const available = availableByItem.get(itemId) || 0;
    const parsed = Number(value);
    setCart((current) => current.map((line) => {
      if (line.item._id !== itemId) return line;
      if (value === '' || !Number.isFinite(parsed) || parsed <= 0) {
        return { ...line, quantityInput: value };
      }
      const quantity = Math.min(parsed, available);
      return {
        ...line,
        quantity,
        quantityInput: quantity === parsed ? value : String(quantity),
      };
    }));
  };

  const [offlineQueue, setOfflineQueue] = useState<PendingSale[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('inpay_offline_sales');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error('Saved offline sales are not in a valid format.');
        const normalized = parsed.map((entry): PendingSale => {
          if (
            typeof entry !== 'object' ||
            entry === null ||
            !('locationId' in entry) ||
            typeof entry.locationId !== 'string' ||
            !('customer' in entry) ||
            typeof entry.customer !== 'string' ||
            !('paymentMethod' in entry) ||
            typeof entry.paymentMethod !== 'string' ||
            !('items' in entry) ||
            !Array.isArray(entry.items) ||
            !('timestamp' in entry) ||
            typeof entry.timestamp !== 'number'
          ) {
            throw new Error('Saved offline sales are not in a valid format.');
          }
          const items = entry.items.map((line: unknown) => {
            if (
              typeof line !== 'object' ||
              line === null ||
              !('itemId' in line) ||
              typeof line.itemId !== 'string' ||
              !('quantity' in line) ||
              typeof line.quantity !== 'number' ||
              !Number.isFinite(line.quantity) ||
              line.quantity <= 0
            ) {
              throw new Error('Saved offline sale contains an invalid item.');
            }
            return { itemId: line.itemId, quantity: line.quantity };
          });
          const idempotencyKey = 'idempotencyKey' in entry &&
              typeof entry.idempotencyKey === 'string' &&
              /^[A-Za-z0-9_-]{16,100}$/.test(entry.idempotencyKey)
            ? entry.idempotencyKey
            : crypto.randomUUID().replace(/-/g, '');
          return {
            idempotencyKey,
            locationId: entry.locationId,
            customer: entry.customer,
            paymentMethod: entry.paymentMethod,
            items,
            timestamp: entry.timestamp,
          };
        });
        setOfflineQueue(normalized);
        localStorage.setItem('inpay_offline_sales', JSON.stringify(normalized));
      }
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : 'Could not load saved offline sales.');
    }
  }, []);

  const saveQueue = (queue: PendingSale[]) => {
    try {
      localStorage.setItem('inpay_offline_sales', JSON.stringify(queue));
      setOfflineQueue(queue);
      return true;
    } catch (storageError) {
      setError(storageError instanceof Error
        ? `Could not save the offline sale on this device: ${storageError.message}`
        : 'Could not save the offline sale on this device.');
      return false;
    }
  };

  const syncOfflineSales = useCallback(async () => {
    if (offlineQueue.length === 0 || syncing) return;
    setSyncing(true);
    const remaining = [...offlineQueue];
    for (const pending of [...offlineQueue]) {
      try {
        await readJson(await fetch('/api/pos/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId: pending.locationId,
            customer: pending.customer,
            paymentMethod: pending.paymentMethod,
            items: pending.items,
            idempotencyKey: pending.idempotencyKey,
          }),
        }));
        remaining.shift();
        if (!saveQueue([...remaining])) break;
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : 'Could not sync offline sales.');
        break; // stop syncing on first network failure
      }
    }
    setSyncing(false);
    if (remaining.length === 0) {
      await loadCatalog();
    }
  }, [offlineQueue, syncing, loadCatalog]);

  useEffect(() => {
    const handleOnline = () => {
      void syncOfflineSales();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncOfflineSales]);

  const checkout = async () => {
    if (!locationId || !paymentMethod || cart.length === 0) return;
    setSubmitting(true);
    setError('');
    const salePayload = {
      idempotencyKey: crypto.randomUUID().replace(/-/g, ''),
      locationId,
      customer,
      paymentMethod,
      items: cart.map((line) => ({ itemId: line.item._id, quantity: line.quantity })),
      timestamp: Date.now(),
    };

    try {
      const completedSale = await readJson(await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: salePayload.locationId,
          customer: salePayload.customer,
          paymentMethod: salePayload.paymentMethod,
          items: salePayload.items,
          idempotencyKey: salePayload.idempotencyKey,
        }),
      })) as Sale;
      setSale(completedSale);
      setCart([]);
      setCustomer('');
      await loadCatalog();
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : 'Checkout failed.';
      if (checkoutError instanceof TypeError || !navigator.onLine) {
        if (saveQueue([...offlineQueue, salePayload])) {
          setError('Network unavailable: sale saved locally and will sync when connection returns.');
          setCart([]);
          setCustomer('');
        }
      } else {
        setError(message);
        if (message.includes('Cashier sign-in')) {
          setCashier(null);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/pos/auth/logout', { method: 'POST' });
    setCashier(null);
    setCart([]);
    setSale(null);
  };

  if (checkingSession) return <p className="text-gray-500">Checking cashier session...</p>;

  if (!cashier) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900">POS Cashier Sign-in</h1>
        <p className="mt-2 text-sm text-gray-600">Use your employee number and assigned 6-digit PIN.</p>
        {loginError && <p role="alert" className="mt-4 text-sm text-red-600">{loginError}</p>}
        <form onSubmit={signIn} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="employeeNo">Employee number</label>
            <input id="employeeNo" className="input" value={employeeNo} onChange={(event) => setEmployeeNo(event.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="cashierLoginPin">6-digit PIN</label>
            <input
              id="cashierLoginPin"
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={signingIn || pin.length !== 6}>
            {signingIn ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500">
          An administrator must assign a PIN from Settings or Payroll → Employees.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{config?.businessName || 'Inpay'} POS</h1>
          <p className="text-sm text-gray-600">Signed in as {cashier.name} · {cashier.employeeNo}</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-ghost" href="/pos/sales"><ReceiptText size={17} /> Sales history</Link>
          <button className="btn-ghost" onClick={signOut}><LogOut size={17} /> Sign out</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {offlineQueue.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div>
            <span className="font-semibold">Offline Queue:</span> {offlineQueue.length} sale(s) saved locally.
          </div>
          <button
            className="btn-ghost text-amber-900 hover:bg-amber-100"
            onClick={() => void syncOfflineSales()}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}
      {sale && (
        <section className="rounded-lg border border-green-200 bg-green-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-800">Sale completed</p>
              <h2 className="text-xl font-bold text-gray-900">{sale.receiptNo}</h2>
              <p className="text-sm text-gray-600">{sale.customer} · {sale.cashierName}</p>
            </div>
            <div className="flex gap-2">
              <Link className="btn-ghost" href={`/pos/sales/${sale._id}`}>View receipt</Link>
            </div>
          </div>
          <p className="mt-3 text-lg font-bold">{formatCurrency(sale.total)}</p>
        </section>
      )}

      {loading && !items.length ? (
        <p className="text-gray-500">Loading POS inventory...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow xl:col-span-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="label">Search items</span>
                <span className="relative block">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9" placeholder="Search SKU or item name" value={query} onChange={(event) => setQuery(event.target.value)} />
                </span>
              </label>
              <label className="sm:w-64 sm:flex-none">
                <span className="label">Stock location</span>
                <select
                  className="input"
                  value={locationId}
                  onChange={(event) => {
                    if (cart.length && !confirm('Changing the location will clear the current sale. Continue?')) return;
                    setCart([]);
                    setLocationId(event.target.value);
                  }}
                >
                  <option value="">Select stock location</option>
                  {locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}
                </select>
              </label>
            </div>
            {locations.length === 0 && <p className="text-sm text-amber-700">Add a stock location before using POS.</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="rounded-md border border-gray-200 p-3 text-left hover:border-Inpay-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => addItem(item)}
                  disabled={(availableByItem.get(item._id) || 0) <= 0 || !item.sellingPrice || item.sellingPrice <= 0}
                >
                  <span className="block font-medium text-gray-900">{item.icon} {item.name}</span>
                  <span className="block text-xs text-gray-500">
                    {item.sku} · {(availableByItem.get(item._id) || 0) > 0
                      ? `${availableByItem.get(item._id)} available`
                      : 'Out of stock at selected location'}
                  </span>
                  {item.sellingPrice > 0 ? (
                    <span className="mt-2 block font-semibold text-Inpay-700">{formatCurrency(item.sellingPrice)} / {item.unit?.code || item.unit?.name || 'unit'}</span>
                  ) : (
                    <span className="mt-2 block text-xs text-amber-700">Set a POS selling price in Inventory → Items</span>
                  )}
                </button>
              ))}
              {!filteredItems.length && <p className="col-span-full py-8 text-center text-sm text-gray-500">No items match this search.</p>}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow xl:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><ShoppingCart size={18} /> Current sale</h2>
            <div className="space-y-3">
              {cart.map((line) => (
                <div key={line.item._id} className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.item.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(line.item.sellingPrice)} each</p>
                  </div>
                  <input
                    className="input w-24"
                    aria-label={`Quantity for ${line.item.name}`}
                    type="number"
                    min={quantityStep}
                    max={availableByItem.get(line.item._id) || 0}
                    step={quantityStep}
                    value={line.quantityInput}
                    onChange={(event) => updateQuantity(line.item._id, event.target.value)}
                    onBlur={() => {
                      if (!line.quantityInput || !Number.isFinite(Number(line.quantityInput)) || Number(line.quantityInput) <= 0) {
                        updateQuantity(line.item._id, String(line.quantity));
                      }
                    }}
                  />
                  <button className="text-sm text-red-600" onClick={() => setCart((current) => current.filter((entry) => entry.item._id !== line.item._id))}>
                    Remove
                  </button>
                </div>
              ))}
              {!cart.length && <p className="py-6 text-center text-sm text-gray-500">Select items to start a sale.</p>}
            </div>
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <div>
                <label className="label" htmlFor="pos-customer">Customer (optional)</label>
                <input id="pos-customer" className="input" maxLength={160} placeholder="Walk-in" value={customer} onChange={(event) => setCustomer(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="pos-payment">Payment method</label>
                <select id="pos-payment" className="input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {(config?.paymentMethods || []).map((method) => <option key={method} value={method}>{paymentLabels[method] || method}</option>)}
                </select>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <p className="text-xs text-gray-500">Tax is disabled. Checkout deducts stock from the selected location.</p>
              <button
                type="button"
                className="btn-primary w-full justify-center"
                onClick={() => void checkout()}
                disabled={submitting || !cart.length || !locationId || !paymentMethod}
              >
                {submitting ? 'Completing sale...' : `Confirm sale · ${formatCurrency(subtotal)}`}
              </button>
              <p className="text-xs text-gray-500">Quantity precision: {precision} decimal place{precision === 1 ? '' : 's'}.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
