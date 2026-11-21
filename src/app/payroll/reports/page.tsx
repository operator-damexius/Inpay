'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

type Detail = {
  _id: string;
  employee: { employeeNo: string; firstname: string; lastname: string };
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  sssDeduction: number;
  thirteenth: number;
  netPay: number;
};

type Run = { _id: string; periodStart: string; periodEnd: string; status: string };

export default function ReportsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [details, setDetails] = useState<Detail[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/payroll/payroll-runs')
      .then((r) => r.json())
      .then(setRuns);
  }, []);

  const loadDetails = async () => {
    if (!selectedRun) return;
    setLoading(true);
    const data = await fetch(`/api/payroll/payroll-details?run=${selectedRun}`).then((r) => r.json());
    setDetails(data);
    setLoading(false);
  };

  const print = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Payslips</h1>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <form onSubmit={(e) => { e.preventDefault(); loadDetails(); }} className="flex gap-4 items-end">
          <div>
            <label className="label">Select Payroll Run</label>
            <select
              className="input"
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
            >
              <option value="">— Choose a run —</option>
              {runs.map((r) => (
                <option key={r._id} value={r._id}>
                  {new Date(r.periodStart).toLocaleDateString()} — {new Date(r.periodEnd).toLocaleDateString()} ({r.status})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">View</button>
          <button type="button" className="btn-ghost" onClick={print} disabled={!details.length}>
            <Printer size={18} /> Print
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : details.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No payslips yet. Compute payroll first.</p>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Regular</th>
                <th className="text-right">Overtime</th>
                <th className="text-right">Gross</th>
                <th className="text-right">SSS</th>
                <th className="text-right">13th</th>
                <th className="text-right">Net Pay</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d._id}>
                  <td>{d.employee.employeeNo} - {d.employee.firstname} {d.employee.lastname}</td>
                  <td className="text-right">₱{d.regularPay.toFixed(2)}</td>
                  <td className="text-right">₱{d.overtimePay.toFixed(2)}</td>
                  <td className="text-right">₱{d.grossPay.toFixed(2)}</td>
                  <td className="text-right">₱{d.sssDeduction.toFixed(2)}</td>
                  <td className="text-right">₱{d.thirteenth.toFixed(2)}</td>
                  <td className="text-right font-bold">₱{d.netPay.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td>Grand Total</td>
                <td className="text-right"></td>
                <td className="text-right"></td>
                <td className="text-right"></td>
                <td className="text-right"></td>
                <td className="text-right"></td>
                <td className="text-right">₱{details.reduce((sum, d) => sum + d.netPay, 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="print-only mt-8">
        <h2 className="text-xl font-bold mb-4">Payslip</h2>
        {details.map((d) => (
          <div key={d._id} className="border border-gray-300 p-6 mb-6">
            <h3 className="font-bold">{d.employee.employeeNo} - {d.employee.firstname} {d.employee.lastname}</h3>
            <p className="text-sm text-gray-600">Net Pay: ₱{d.netPay.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
