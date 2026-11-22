'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, KeyRound } from 'lucide-react';

type Employee = {
  _id: string;
  employeeNo: string;
  firstname: string;
  lastname: string;
  shift: string;
  ratePerDay: number;
  dateHired?: string | null;
  isActive: boolean;
  hasPosPin?: boolean;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [cashierEmployee, setCashierEmployee] = useState<Employee | null>(null);
  const [cashierPin, setCashierPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeNo: '',
    firstname: '',
    lastname: '',
    shift: '1st',
    ratePerDay: '',
    dateHired: '',
    isActive: true,
  });

  useEffect(() => {
    fetch('/api/payroll/employees')
      .then((r) => r.json())
      .then((data) => { setEmployees(data); setLoading(false); });
  }, []);

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch(editingId ? `/api/payroll/employees/${editingId}` : '/api/payroll/employees', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        ratePerDay: parseFloat(form.ratePerDay),
        dateHired: form.dateHired || null,
      }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok) {
      setError(result?.error || 'Could not save employee.');
      return;
    }
    setEmployees((current) => editingId
      ? current.map((employee) => employee._id === result._id ? result : employee)
      : [result, ...current]);
    setOpen(false);
    setEditingId('');
    setForm({ employeeNo: '', firstname: '', lastname: '', shift: '1st', ratePerDay: '', dateHired: '', isActive: true });
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    const response = await fetch(`/api/payroll/employees/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error || 'Could not delete employee.');
      return;
    }
    setEmployees(employees.filter((e) => e._id !== id));
  };

  const saveCashierPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cashierEmployee) return;
    setError('');
    setSavingPin(true);
    try {
      const response = await fetch(`/api/admin/pos/cashiers/${cashierEmployee._id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cashierPin }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || 'Could not save cashier PIN.');
        return;
      }
      setEmployees((current) => current.map((employee) =>
        employee._id === cashierEmployee._id ? { ...employee, hasPosPin: true } : employee
      ));
      setCashierEmployee(null);
      setCashierPin('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save cashier PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  const removeCashierPin = async (employee: Employee) => {
    if (!confirm(`Remove POS cashier access for ${employee.firstname} ${employee.lastname}?`)) return;
    try {
      const response = await fetch(`/api/admin/pos/cashiers/${employee._id}/pin`, { method: 'DELETE' });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || 'Could not remove cashier PIN.');
        return;
      }
      setEmployees((current) => current.map((currentEmployee) =>
        currentEmployee._id === employee._id ? { ...currentEmployee, hasPosPin: false } : currentEmployee
      ));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove cashier PIN.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingId('');
            setError('');
            setForm({ employeeNo: '', firstname: '', lastname: '', shift: '1st', ratePerDay: '', dateHired: '', isActive: true });
            setOpen(true);
          }}
        >
          <Plus size={18} /> Add Employee
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : employees.length === 0 ? (
        <p className="text-gray-500">No employees yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Employee No.</th>
              <th>Name</th>
              <th>Shift</th>
              <th className="text-right">Rate/Day</th>
              <th>Active</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e._id}>
                <td>{e.employeeNo}</td>
                <td>{e.firstname} {e.lastname}</td>
                <td>{e.shift}</td>
                <td className="text-right">₱{e.ratePerDay.toFixed(2)}</td>
                <td>
                  <span className={`badge ${e.isActive ? 'badge-ok' : 'badge-bad'}`}>
                    {e.isActive ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="text-right">
                  <button
                    className="text-Inpay-600 hover:text-Inpay-700"
                    title="Edit"
                    aria-label={`Edit ${e.firstname} ${e.lastname}`}
                    onClick={() => {
                      setEditingId(e._id);
                      setError('');
                      setForm({
                        employeeNo: e.employeeNo,
                        firstname: e.firstname,
                        lastname: e.lastname,
                        shift: e.shift,
                        ratePerDay: String(e.ratePerDay),
                        dateHired: e.dateHired ? e.dateHired.slice(0, 10) : '',
                        isActive: e.isActive,
                      });
                      setOpen(true);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>{' '}
                  <button
                    className={e.hasPosPin ? 'text-green-700 hover:text-green-800' : 'text-Inpay-600 hover:text-Inpay-700'}
                    title={e.hasPosPin ? 'Change POS PIN' : 'Set POS PIN'}
                    aria-label={`${e.hasPosPin ? 'Change' : 'Set'} POS PIN for ${e.firstname} ${e.lastname}`}
                    onClick={() => {
                      setError('');
                      setCashierPin('');
                      setCashierEmployee(e);
                    }}
                  >
                    <KeyRound size={16} />
                  </button>{' '}
                  <button
                    className="text-red-600 hover:text-red-700 ml-2"
                    title="Delete"
                    onClick={() => deleteEmployee(e._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${
          open ? '' : 'hidden'
        }`}
      >
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
          <form onSubmit={saveEmployee} className="space-y-3">
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="label">Employee No.</label>
              <input
                className="input"
                name="employeeNo"
                value={form.employeeNo}
                onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input
                  className="input"
                  name="firstname"
                  value={form.firstname}
                  onChange={(e) => setForm({ ...form, firstname: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  className="input"
                  name="lastname"
                  value={form.lastname}
                  onChange={(e) => setForm({ ...form, lastname: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Shift</label>
              <select
                className="input"
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
              >
                <option>1st</option>
                <option>2nd</option>
                <option>3rd</option>
              </select>
            </div>
            <div>
              <label className="label">Rate per Day</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                name="ratePerDay"
                value={form.ratePerDay}
                onChange={(e) => setForm({ ...form, ratePerDay: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Date Hired</label>
              <input
                className="input"
                type="date"
                value={form.dateHired}
                onChange={(e) => setForm({ ...form, dateHired: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active employee
            </label>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingId ? 'Update Employee' : 'Save Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {cashierEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setCashierEmployee(null)} />
          <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold">POS Cashier PIN</h2>
            <p className="mb-4 text-sm text-gray-600">
              {cashierEmployee.firstname} {cashierEmployee.lastname} ({cashierEmployee.employeeNo})
            </p>
            <form onSubmit={saveCashierPin} className="space-y-3">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div>
                <label className="label" htmlFor="cashier-pin">6-digit PIN</label>
                <input
                  id="cashier-pin"
                  className="input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={cashierPin}
                  onChange={(event) => setCashierPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <div className="flex justify-between gap-2 pt-2">
                {cashierEmployee.hasPosPin ? (
                  <button
                    type="button"
                    className="btn-ghost text-red-700"
                    onClick={() => {
                      void removeCashierPin(cashierEmployee);
                      setCashierEmployee(null);
                    }}
                  >
                    Remove PIN
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setCashierEmployee(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={savingPin || cashierPin.length !== 6}>
                    {savingPin ? 'Saving...' : 'Save PIN'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
