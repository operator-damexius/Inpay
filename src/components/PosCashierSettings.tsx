'use client';

import { FormEvent, useEffect, useState } from 'react';

type CashierEmployee = {
  _id: string;
  employeeNo: string;
  firstname: string;
  lastname: string;
  isActive: boolean;
  hasPosPin: boolean;
};

function isCashierEmployee(value: unknown): value is CashierEmployee {
  if (typeof value !== 'object' || value === null) return false;
  const employee = value as Record<string, unknown>;
  return (
    typeof employee._id === 'string' &&
    typeof employee.employeeNo === 'string' &&
    typeof employee.firstname === 'string' &&
    typeof employee.lastname === 'string' &&
    typeof employee.isActive === 'boolean' &&
    typeof employee.hasPosPin === 'boolean'
  );
}

function getErrorMessage(result: unknown, fallback: string) {
  if (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof result.error === 'string'
  ) {
    return result.error;
  }
  return fallback;
}

export default function PosCashierSettings() {
  const [employees, setEmployees] = useState<CashierEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const loadEmployees = async () => {
      try {
        const response = await fetch('/api/payroll/employees', { cache: 'no-store' });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(result, 'Could not load employees.'));
        }
        if (!Array.isArray(result) || !result.every(isCashierEmployee)) {
          throw new Error('The employee list response was invalid.');
        }
        if (active) setEmployees(result);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load employees.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEmployees();
    return () => {
      active = false;
    };
  }, []);

  const savePin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const employee = employees.find((entry) => entry._id === editingId);
    if (!employee) return;

    setWorking(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/pos/cashiers/${employee._id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(result, 'Could not save cashier PIN.'));
      }
      setEmployees((current) => current.map((entry) =>
        entry._id === employee._id ? { ...entry, hasPosPin: true } : entry
      ));
      setEditingId('');
      setPin('');
      setMessage(`POS PIN saved for ${employee.firstname} ${employee.lastname}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save cashier PIN.');
    } finally {
      setWorking(false);
    }
  };

  const removePin = async (employee: CashierEmployee) => {
    if (!window.confirm(`Remove POS cashier access for ${employee.firstname} ${employee.lastname}?`)) {
      return;
    }
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/pos/cashiers/${employee._id}/pin`, {
        method: 'DELETE',
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(result, 'Could not remove cashier PIN.'));
      }
      setEmployees((current) => current.map((entry) =>
        entry._id === employee._id ? { ...entry, hasPosPin: false } : entry
      ));
      setEditingId('');
      setPin('');
      setMessage(`POS PIN removed for ${employee.firstname} ${employee.lastname}.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove cashier PIN.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">POS cashier PINs</h2>
        <p className="mt-1 text-sm text-gray-600">
          Assign or change a six-digit PIN for active employees who use the POS.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading employees...</p>
      ) : employees.length === 0 ? (
        <p className="text-sm text-gray-500">No employees found. Add employees in Payroll first.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {employees.map((employee) => (
            <li key={employee._id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {employee.firstname} {employee.lastname}
                  </p>
                  <p className="text-xs text-gray-500">
                    {employee.employeeNo} · {employee.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={employee.hasPosPin ? 'badge-ok' : 'badge-warn'}>
                    {employee.hasPosPin ? 'PIN assigned' : 'No PIN'}
                  </span>
                  <button
                    type="button"
                    className="text-sm font-medium text-Inpay-600 hover:text-Inpay-700 disabled:text-gray-400"
                    disabled={!employee.isActive || working}
                    onClick={() => {
                      setError('');
                      setMessage('');
                      setPin('');
                      setEditingId(editingId === employee._id ? '' : employee._id);
                    }}
                  >
                    {employee.hasPosPin ? 'Change' : 'Assign'}
                  </button>
                </div>
              </div>

              {editingId === employee._id && (
                <form onSubmit={savePin} className="mt-3 space-y-3 rounded-md bg-gray-50 p-3">
                  <div>
                    <label className="label" htmlFor={`cashier-pin-${employee._id}`}>
                      New 6-digit PIN
                    </label>
                    <input
                      id={`cashier-pin-${employee._id}`}
                      className="input"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {employee.hasPosPin && (
                      <button
                        type="button"
                        className="btn-ghost text-red-700"
                        disabled={working}
                        onClick={() => void removePin(employee)}
                      >
                        Remove PIN
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={working}
                      onClick={() => {
                        setEditingId('');
                        setPin('');
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={working || pin.length !== 6}>
                      {working ? 'Saving...' : 'Save PIN'}
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
