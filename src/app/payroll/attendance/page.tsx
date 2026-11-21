'use client';

import { useEffect, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';

type Attendance = {
  _id: string;
  employee: { firstname: string; lastname: string; shift: string };
  workDate: string;
  timeIn?: string;
  timeOut?: string;
  totalHours: number;
  overtimeHours: number;
};

export default function AttendancePage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [empId, setEmpId] = useState('');
  const [type, setType] = useState<'time_in' | 'time_out'>('time_in');

  useEffect(() => {
    Promise.all([
      fetch('/api/payroll/employees').then((r) => r.json()),
      fetch('/api/payroll/attendance').then((r) => r.json()),
    ])
      .then(([emps, recs]) => {
        setEmployees(emps);
        setRecords(recs);
        setLoading(false);
      });
  }, []);

  const clock = async () => {
    const res = await fetch('/api/payroll/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId, type }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      location.reload();
    } else {
      alert(data.error || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Clock In / Out</h2>
        <form onSubmit={(e) => { e.preventDefault(); clock(); }} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label">Employee</label>
            <select
              className="input"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              required
            >
              <option value="">— Select —</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.employeeNo} - {e.firstname} {e.lastname} ({e.shift})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Action</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as 'time_in' | 'time_out')}
              required
            >
              <option value="time_in">Time In</option>
              <option value="time_out">Time Out</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1 flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              Record
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold p-4 border-b border-gray-200">Today&apos;s Attendance</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Shift</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th className="text-right">Hours</th>
                <th className="text-right">OT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-gray-500 text-center py-8">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-gray-500 text-center py-8">No records yet.</td></tr>
              ) : (
                records.map((r) => (
                  <tr key={r._id}>
                    <td>{r.employee.firstname} {r.employee.lastname}</td>
                    <td>{r.employee.shift}</td>
                    <td>{r.timeIn ? new Date(r.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{r.timeOut ? new Date(r.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="text-right">{r.totalHours.toFixed(2)}</td>
                    <td className="text-right">{r.overtimeHours.toFixed(2)}</td>
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
