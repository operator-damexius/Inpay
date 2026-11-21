'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';

type Location = {
  _id: string;
  name: string;
  code: string;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const response = await fetch('/api/inventory/locations');
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
              ? data.error
              : `Could not load locations (${response.status})`
          );
        }
        if (!Array.isArray(data)) {
          throw new Error('Unexpected response while loading locations.');
        }
        setLocations(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load locations.');
      } finally {
        setLoading(false);
      }
    };

    void loadLocations();
  }, []);

  const addLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/inventory/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Could not add location (${response.status})`
        );
      }

      setLocations((current) => [...current, data as Location].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setCode('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-600">Add the places where inventory is stored.</p>
        </div>
        <Link href="/inventory/transfers" className="btn-ghost">Stock Transfers</Link>
      </div>

      {error && <p className="text-red-600" role="alert">{error}</p>}

      <form onSubmit={addLocation} className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Add a Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="location-name">Location Name</label>
            <input
              id="location-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Main Warehouse"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="location-code">Location Code</label>
            <input
              id="location-code"
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. WH-01"
              required
            />
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>
          <Plus size={18} /> {saving ? 'Saving...' : 'Add Location'}
        </button>
      </form>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-gray-200 font-semibold text-gray-900">Saved Locations</div>
        {loading ? (
          <p className="p-6 text-gray-500">Loading locations...</p>
        ) : locations.length === 0 ? (
          <p className="p-6 text-gray-500">No locations yet. Add one above to use it in a transfer.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {locations.map((location) => (
              <li key={location._id} className="p-4 flex items-center gap-3">
                <MapPin size={18} className="text-gray-500" />
                <span className="font-medium text-gray-900">{location.name}</span>
                <span className="text-sm text-gray-500">{location.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
