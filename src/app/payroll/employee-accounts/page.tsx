'use client';

import { useEffect, useState } from 'react';
import { Plus, User, Trash2, Edit3, Save, Wallet } from 'lucide-react';

type Account = {
  _id: string;
  employee: string;
  employeeNo: string;
  firstname: string;
  lastname: string;
  balance: number;
  isActive: boolean;
};

export default function EmployeeAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [form, setForm] = useState({
    employeeId: '', employeeNo: '', firstname: '', lastname: '', balance: '', isActive: true,
  });
  const [editForm, setEditForm] = useState({
    _id: '', employeeId: '', employeeNo: '', firstname: '', lastname: '', balance: '', isActive: true,
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/employee-accounts').then((r) => r.json()),
      fetch('/api/payroll/employees').then((r) => r.json()),
    ]).then(([accs, emps]) => {
      setAccounts(accs);
      setEmployees(emps);
      setLoading(false);
    });
  }, []);

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/employee-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
      }),
    });
    if (res.ok) {
      const acc = await res.json();
      setAccounts([acc, ...accounts]);
      setOpen(false);
      setForm({ employeeId: '', employeeNo: '', firstname: '', lastname: '', balance: '', isActive: true });
    }
  };

  const updateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/employee-accounts/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAccounts(accounts.map((a) => (a._id === updated._id ? updated : a)));
      setEditOpen(false);
      setEditingId('');
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this employee account?')) return;
    await fetch(`/api/employee-accounts/${id}`, { method: 'DELETE' });
    setAccounts(accounts.filter((a) => a._id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Employee Accounts</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Wallet size={18} /> Add Account
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-gray-500">No employee accounts yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Employee No.</th>
              <th>Name</th>
              <th className="text-right">Balance</th>
              <th>Active</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a._id}>
                <td>{a.employeeNo}</td>
                <td>{a.firstname} {a.lastname}</td>
                <td className={`text-right ${a.balance >= 0 ? 'text-green-600' : 'text-red-600'} font-medium`}>
                  ₱{a.balance.toFixed(2)}
                </td>
                <td>
                  <span className={`badge ${a.isActive ? 'badge-ok' : 'badge-bad'}`}>
                    {a.isActive ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="text-right">
                  <button
                    className="text-Inpay-600 hover:text-Inpay-700 mr-2"
                    title="Edit"
                    onClick={() => {
                      setEditingId(a._id);
                      setEditForm({
                        _id: a._id,
                        employeeId: a.employee,
                        employeeNo: a.employeeNo,
                        firstname: a.firstname,
                        lastname: a.lastname,
                        balance: a.balance.toString(),
                        isActive: a.isActive,
                      });
                      setEditOpen(true);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>{' '}
                  <button
                    className="text-red-600 hover:text-red-700"
                    title="Delete"
                    onClick={() => deleteAccount(a._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Add Employee Account</h2>
          <form onSubmit={addAccount} className="space-y-3">
            <div>
              <label className="label">Employee</label>
              <select
                className="input"
                name="employeeId"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                required
              >
                <option value="">— Select employee —</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.employeeNo} - {e.firstname} {e.lastname}
                  </option>
                ))}
              </select>
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
              <label className="label">Employee No.</label>
              <input
                className="input"
                name="employeeNo"
                value={form.employeeNo}
                onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Opening Balance</label>
              <input
                className="input"
                type="number"
                step="0.01"
                name="balance"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Save Account
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={`fixed inset-0 z-50 flex items-center justify-center ${editOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setEditOpen(false)} />
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
          <h2 className="text-lg font-bold mb-4">Edit Employee Account</h2>
          <form onSubmit={updateAccount} className="space-y-3">
            <input type="hidden" name="_id" value={editingId} />
            <div>
              <label className="label">Employee No.</label>
              <input
                className="input"
                name="employeeNo"
                value={editForm.employeeNo}
                onChange={(e) => setEditForm({ ...editForm, employeeNo: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input
                  className="input"
                  name="firstname"
                  value={editForm.firstname}
                  onChange={(e) => setEditForm({ ...editForm, firstname: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  className="input"
                  name="lastname"
                  value={editForm.lastname}
                  onChange={(e) => setEditForm({ ...editForm, lastname: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Balance</label>
              <input
                className="input"
                type="number"
                step="0.01"
                name="balance"
                value={editForm.balance}
                onChange={(e) => setEditForm({ ...editForm, balance: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              />
              <label className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} /> Update Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
