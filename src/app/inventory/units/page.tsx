'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';

type Unit = {
  _id: string;
  name: string;
  code: string;
};

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const response = await fetch('/api/inventory/units');
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
              ? data.error
              : `Could not load units (${response.status})`
          );
        }
        if (!Array.isArray(data)) throw new Error('Unexpected response while loading units.');
        setUnits(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load units.');
      } finally {
        setLoading(false);
      }
    };

    void loadUnits();
  }, []);

  const addUnit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/inventory/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Could not add unit (${response.status})`
        );
      }
      if (typeof data !== 'object' || data === null || !('_id' in data) || !('name' in data) || !('code' in data)) {
        throw new Error('Unexpected response while adding unit.');
      }

      setUnits((current) => [...current, data as Unit].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setCode('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add unit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Units</h1>
          <p className="text-gray-600">Create units of measure to assign to inventory items.</p>
        </div>
        <Link href="/inventory/items" className="btn-ghost">Inventory Items</Link>
      </div>

      {error && <p className="text-red-600" role="alert">{error}</p>}

      <form onSubmit={addUnit} className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Add a Unit</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="unit-name">Unit Name</label>
            <input
              id="unit-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Piece"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="unit-code">Unit Code</label>
            <input
              id="unit-code"
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. PCS"
              required
            />
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>
          <Plus size={18} /> {saving ? 'Saving...' : 'Add Unit'}
        </button>
      </form>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200 font-semibold text-gray-900">Available Units</div>
        {loading ? (
          <p className="p-6 text-gray-500">Loading units...</p>
        ) : units.length === 0 ? (
          <p className="p-6 text-gray-500">No units yet. Add one above to select it for an item.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {units.map((unit) => (
              <li key={unit._id} className="p-4 flex items-center gap-3">
                <Ruler size={18} className="text-gray-500" />
                <span className="font-medium text-gray-900">{unit.name}</span>
                <span className="text-sm text-gray-500">{unit.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
