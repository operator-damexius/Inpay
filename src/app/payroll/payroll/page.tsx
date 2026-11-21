'use client';

import { useEffect, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';

type Run = { _id: string; periodStart: string; periodEnd: string; status: string; datePaid?: string };

export default function PayrollPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [markingPaidId, setMarkingPaidId] = useState('');

  useEffect(() => {
    fetch('/api/payroll/payroll-runs')
      .then((r) => r.json())
      .then((data) => { setRuns(data); setLoading(false); });
  }, []);

  const createRun = async () => {
    const res = await fetch('/api/payroll/payroll-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart: start, periodEnd: end }),
    });
    if (res.ok) {
      const run = await res.json();
      setRuns([run, ...runs]);
      setStart('');
      setEnd('');
    }
  };

  const compute = async (id: string) => {
    if (!confirm('Compute payroll for all employees in this period?')) return;
    await fetch(`/api/payroll/payroll-runs/${id}/compute`, { method: 'POST' });
    location.reload();
  };

  const markPaid = async (id: string) => {
    if (!confirm('Mark this payroll run as paid?')) return;
    setError('');
    setMarkingPaidId(id);
    try {
      const response = await fetch(`/api/payroll/payroll-runs/${id}/mark-paid`, { method: 'POST' });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Could not mark payroll run as paid.');
      }
      setRuns((current) => current.map((run) => run._id === id ? result : run));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not mark payroll run as paid.');
    } finally {
      setMarkingPaidId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Payroll Runs</h1>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Run</h2>
        <form onSubmit={(e) => { e.preventDefault(); createRun(); }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label">Period Start</label>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <label className="label">Period End</label>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          <div className="col-span-2 md:col-span-1">
            <button type="submit" className="btn-primary w-full">Create Run</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold p-4 border-b border-gray-200">Runs</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-gray-500 text-center py-8">Loading...</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={3} className="text-gray-500 text-center py-8">No runs yet.</td></tr>
              ) : (
                runs.map((r) => (
                  <tr key={r._id}>
                    <td>
                      {new Date(r.periodStart).toLocaleDateString()} —{' '}
                      {new Date(r.periodEnd).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`badge ${
                        r.status === 'Paid' ? 'badge-ok' : r.status === 'Closed' ? 'badge-warn' : 'badge-bad'
                      }`}>{r.status}</span>
                      {r.status === 'Paid' && r.datePaid && (
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(r.datePaid).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="text-right">
                      {r.status === 'Open' && (
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => compute(r._id)}
                        >
                          <Play size={14} /> Compute
                        </button>
                      )}
                      {r.status === 'Closed' && (
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => markPaid(r._id)}
                          disabled={markingPaidId === r._id}
                        >
                          <RefreshCw size={14} /> Mark Paid
                        </button>
                      )}
                      {r.status !== 'Open' && (
                        <a href={`/payroll/reports?run=${r._id}`} className="btn-ghost text-xs">
                          Payslips
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
