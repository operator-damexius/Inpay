'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

type Detail = {
  _id: string;
  employee: { employeeNo: string; firstname: string; lastname: string } | null;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  sssDeduction: number;
  thirteenth: number;
  netPay: number;
  baseHoursPaid?: number;
  overtimeHours?: number;
  breakHours?: number;
  hourlyRate?: number;
  overtimeMultiplier?: number;
  sssRate?: number;
  thirteenthRate?: number;
};

type Run = { _id: string; periodStart: string; periodEnd: string; status: string };

export default function ReportsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [details, setDetails] = useState<Detail[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/payroll/payroll-runs')
      .then((r) => r.json())
      .then(setRuns);
  }, []);

  useEffect(() => {
    const requestedRun = new URLSearchParams(window.location.search).get('run');
    if (!requestedRun) return;
    // Keep the select in sync with the payroll run that linked to this report.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRun(requestedRun);
    setError('');
    setLoading(true);
    fetch(`/api/payroll/payroll-details?run=${encodeURIComponent(requestedRun)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load payslips.');
        return result;
      })
      .then(setDetails)
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const loadDetails = async () => {
    if (!selectedRun) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/payroll/payroll-details?run=${encodeURIComponent(selectedRun)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load payslips.');
      setDetails(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load payslips.');
    } finally {
      setLoading(false);
    }
  };

  const print = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Payslips</h1>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

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
          <p className="px-4 pt-4 text-sm text-gray-600">
            Gross = base pay + overtime pay. Net pay = gross − SSS. The 13th-month amount is an accrual shown separately,
            not a deduction from take-home pay.
          </p>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="text-right">Base Pay Hrs</th>
                  <th className="text-right">OT Hrs</th>
                  <th className="text-right">Break Hrs</th>
                  <th className="text-right">Hourly Rate</th>
                  <th className="text-right">Regular Pay</th>
                  <th className="text-right">Overtime Pay</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">SSS</th>
                  <th className="text-right">13th Accrual</th>
                  <th className="text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d) => (
                  <tr key={d._id}>
                    <td>
                      {d.employee
                        ? `${d.employee.employeeNo} - ${d.employee.firstname} ${d.employee.lastname}`
                        : 'Employee record unavailable'}
                    </td>
                    <td className="text-right">{d.baseHoursPaid?.toFixed(2) ?? '—'}</td>
                    <td className="text-right">{d.overtimeHours?.toFixed(2) ?? '—'}</td>
                    <td className="text-right">{d.breakHours?.toFixed(2) ?? '—'}</td>
                    <td className="text-right">{d.hourlyRate === undefined ? '—' : `₱${d.hourlyRate.toFixed(2)}`}</td>
                    <td className="text-right">₱{d.regularPay.toFixed(2)}</td>
                    <td className="text-right">
                      ₱{d.overtimePay.toFixed(2)}
                      {d.overtimeMultiplier !== undefined && (
                        <span className="block text-xs text-gray-500">×{d.overtimeMultiplier.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="text-right">₱{d.grossPay.toFixed(2)}</td>
                    <td className="text-right">
                      ₱{d.sssDeduction.toFixed(2)}
                      {d.sssRate !== undefined && (
                        <span className="block text-xs text-gray-500">{(d.sssRate * 100).toFixed(2)}%</span>
                      )}
                    </td>
                    <td className="text-right">
                      ₱{d.thirteenth.toFixed(2)}
                      {d.thirteenthRate !== undefined && (
                        <span className="block text-xs text-gray-500">{(d.thirteenthRate * 100).toFixed(2)}%</span>
                      )}
                    </td>
                    <td className="text-right font-bold">₱{d.netPay.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-50">
                  <td>Grand Total</td>
                  <td className="text-right">
                    {details.reduce((sum, detail) => sum + (detail.baseHoursPaid ?? 0), 0).toFixed(2)}
                  </td>
                  <td className="text-right">
                    {details.reduce((sum, detail) => sum + (detail.overtimeHours ?? 0), 0).toFixed(2)}
                  </td>
                  <td className="text-right">
                    {details.reduce((sum, detail) => sum + (detail.breakHours ?? 0), 0).toFixed(2)}
                  </td>
                  <td className="text-right"></td>
                  <td className="text-right">₱{details.reduce((sum, detail) => sum + detail.regularPay, 0).toFixed(2)}</td>
                  <td className="text-right">₱{details.reduce((sum, detail) => sum + detail.overtimePay, 0).toFixed(2)}</td>
                  <td className="text-right">₱{details.reduce((sum, detail) => sum + detail.grossPay, 0).toFixed(2)}</td>
                  <td className="text-right">₱{details.reduce((sum, detail) => sum + detail.sssDeduction, 0).toFixed(2)}</td>
                  <td className="text-right">₱{details.reduce((sum, detail) => sum + detail.thirteenth, 0).toFixed(2)}</td>
                  <td className="text-right">₱{details.reduce((sum, detail) => sum + detail.netPay, 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="print-only mt-8">
        <h2 className="text-xl font-bold mb-4">Payslip</h2>
        {details.map((d) => (
          <div key={d._id} className="border border-gray-300 p-6 mb-6">
            <h3 className="font-bold">
              {d.employee
                ? `${d.employee.employeeNo} - ${d.employee.firstname} ${d.employee.lastname}`
                : 'Employee record unavailable'}
            </h3>
            <p className="text-sm text-gray-600">Base-pay hours: {d.baseHoursPaid?.toFixed(2) ?? '—'}</p>
            <p className="text-sm text-gray-600">Overtime hours: {d.overtimeHours?.toFixed(2) ?? '—'}</p>
            <p className="text-sm text-gray-600">Unpaid break: {d.breakHours?.toFixed(2) ?? '—'} hours</p>
            <p className="text-sm text-gray-600">Regular pay: ₱{d.regularPay.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Overtime pay: ₱{d.overtimePay.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Gross pay: ₱{d.grossPay.toFixed(2)}</p>
            <p className="text-sm text-gray-600">SSS: ₱{d.sssDeduction.toFixed(2)}</p>
            <p className="text-sm text-gray-600">13th-month accrual (not deducted): ₱{d.thirteenth.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Net Pay: ₱{d.netPay.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
