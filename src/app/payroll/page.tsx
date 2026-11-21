'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Maximize2, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type AttendanceRecord = {
  _id: string;
  employee: { firstname: string; lastname: string } | null;
  workDate: string;
  timeIn?: string;
  timeOut?: string;
  totalHours: number;
};

type PayrollDashboardData = {
  totalEmployees: number;
  presentToday: number;
  openRuns: number;
  latestRun: { periodStart: string; periodEnd: string; netPay: number | null } | null;
  payrollHistory: { periodStart: string; periodEnd: string; status: string; netPay: number }[];
  recentAttendance: AttendanceRecord[];
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const formatCompactCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);

function formatPeriod(periodStart: string, periodEnd: string) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const startLabel = start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

function PayrollHistoryChart({
  periods,
  expanded = false,
}: {
  periods: PayrollDashboardData['payrollHistory'];
  expanded?: boolean;
}) {
  const chartData = periods.map((period) => ({
    period: formatPeriod(period.periodStart, period.periodEnd),
    netPay: period.netPay,
  }));

  return (
    <div className={expanded ? 'h-[60vh] min-h-96 w-full' : 'h-80 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={formatCompactCurrency}
            domain={[0, 'auto']}
          />
          <YAxis
            type="category"
            dataKey="period"
            width={145}
            tick={{ fontSize: expanded ? 13 : 11 }}
            interval={0}
          />
          <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Net pay']} />
          <Bar dataKey="netPay" name="Net pay" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PayrollDashboard() {
  const [data, setData] = useState<PayrollDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/payroll/dashboard')
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || 'Unable to load payroll dashboard.');
        }
        return response.json();
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const metric = (value: string | number) => loading ? 'Loading...' : error ? '—' : value;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll Dashboard</h1>
        <p className="text-gray-600">Manage employees, attendance, and payroll runs.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metric(data?.totalEmployees ?? '—')}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Present Today</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metric(data?.presentToday ?? '—')}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open Runs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metric(data?.openRuns ?? '—')}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Pay (Latest Processed Run)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {loading || error
              ? metric('—')
              : data?.latestRun?.netPay !== null && data?.latestRun
                ? formatCurrency(data.latestRun.netPay)
                : '—'}
          </p>
          {!loading && !error && data?.latestRun && (
            <p className="text-xs text-gray-500 mt-1">
              {data.latestRun.netPay === null
                ? 'Payroll details not computed'
                : `${new Date(data.latestRun.periodStart).toLocaleDateString()} – ${new Date(data.latestRun.periodEnd).toLocaleDateString()}`}
            </p>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Net Pay by Pay Period</h2>
            <p className="text-sm text-gray-500">Latest 6 processed payroll runs</p>
          </div>
          <button
            type="button"
            className="btn-ghost px-3 py-2"
            onClick={() => setHistoryExpanded(true)}
            disabled={loading || Boolean(error) || !data?.payrollHistory.length}
            aria-label="Enlarge net pay by pay period chart"
            title="Enlarge chart"
          >
            <Maximize2 size={16} />
            <span className="sr-only">Enlarge chart</span>
          </button>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading payroll history...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600" role="alert">{error}</p>
        ) : data?.payrollHistory.length ? (
          <PayrollHistoryChart periods={data.payrollHistory} />
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">
            No processed payroll runs to chart yet.
          </p>
        )}
      </section>

      {historyExpanded && data?.payrollHistory.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expanded-payroll-history-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryExpanded(false);
          }}
        >
          <div className="w-full max-w-7xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="expanded-payroll-history-title" className="text-xl font-bold text-gray-900">
                  Net Pay by Pay Period
                </h2>
                <p className="text-sm text-gray-500">Latest 6 processed payroll runs</p>
              </div>
              <button
                type="button"
                className="btn-ghost px-3 py-2"
                onClick={() => setHistoryExpanded(false)}
                aria-label="Close enlarged payroll chart"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <PayrollHistoryChart periods={data.payrollHistory} expanded />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Attendance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-500">Employee</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Date</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Time In</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Time Out</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-500">Loading...</td></tr>
                  ) : error ? (
                    <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-500">Attendance is unavailable.</td></tr>
                  ) : data?.recentAttendance.length ? (
                    data.recentAttendance.map((record) => (
                      <tr key={record._id}>
                        <td className="px-4 py-3 border-b border-gray-100">
                          {record.employee
                            ? `${record.employee.firstname} ${record.employee.lastname}`
                            : 'Employee unavailable'}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100">{new Date(record.workDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 border-b border-gray-100">
                          {record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100">
                          {record.timeOut ? new Date(record.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right">{record.totalHours.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-500">No attendance records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/payroll/employees" className="btn-primary w-full">
              + Add Employee
            </Link>
            <Link href="/payroll/attendance" className="btn-ghost w-full">
              Record Attendance
            </Link>
            <Link href="/payroll/payroll" className="btn-ghost w-full">
              Process Payroll
            </Link>
            <Link href="/payroll/reports" className="btn-ghost w-full">
              Reports & Payslips
            </Link>
            <Link href="/payroll/employee-accounts" className="btn-ghost w-full">
              Employee Accounts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
