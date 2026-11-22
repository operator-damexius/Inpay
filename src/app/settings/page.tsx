'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PosCashierSettings from '@/components/PosCashierSettings';
import { normalizePayrollSettings } from '@/lib/payroll-settings';

type Settings = {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  currency: 'PHP';
  timezone: string;
  posPaymentMethods: string[];
  posQuantityPrecision: number;
  taxEnabled: boolean;
  taxRate: number;
  payrollOvertimeEnabled: boolean;
  payrollOvertimeMultiplier: number;
  payrollHoursPerDay: number;
  payrollUnpaidBreakHours: number;
  payrollSssEnabled: boolean;
  payrollSssRate: number;
  payrollThirteenthEnabled: boolean;
  payrollThirteenthRate: number;
};

type RecoveryBackup = {
  id: string;
  filename: string;
  uploadDate: string;
  length: number;
  purpose?: string;
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash / e-wallet' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [accountForm, setAccountForm] = useState({
    currentPassword: '',
    username: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [backups, setBackups] = useState<RecoveryBackup[]>([]);
  const [backupError, setBackupError] = useState('');
  const [operation, setOperation] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const sessionResponse = await fetch('/api/admin/session');
        const session = await sessionResponse.json();
        if (session.databaseReady === false && session.error) {
          throw new Error(session.error);
        }
        if (!session.configured) {
          throw new Error('Admin login is not configured. Set ADMIN_SESSION_SECRET and, for initial setup, ADMIN_USERNAME and ADMIN_PASSWORD in the server environment.');
        }
        if (!session.authenticated) {
          router.replace('/admin/login');
          return;
        }

        const [response, accountResponse] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/account'),
        ]);
        const [result, accountResult] = await Promise.all([
          response.json(),
          accountResponse.json(),
        ]);
        if (!response.ok) throw new Error(result.error || 'Could not load settings.');
        if (!accountResponse.ok) throw new Error(accountResult.error || 'Could not load system account.');
        if (active) setSettings({ ...result, ...normalizePayrollSettings(result) });
        if (active) {
          setAdminUsername(accountResult.username);
          setAccountForm((current) => ({ ...current, username: accountResult.username }));
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load settings.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSettings();
    return () => {
      active = false;
    };
  }, [router]);

  const refreshBackups = async () => {
    const response = await fetch('/api/admin/database/backups');
    const result = await response.json();
    if (!response.ok || !Array.isArray(result)) {
      throw new Error(result.error || 'Could not load recovery backups.');
    }
    setBackups(result);
  };

  const settingsReady = settings !== null;
  useEffect(() => {
    if (!settingsReady) return;
    refreshBackups().catch((loadError: Error) => setBackupError(loadError.message));
  }, [settingsReady]);

  const updateSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save settings.');
      setSettings({ ...result, ...normalizePayrollSettings(result) });
      setMessage('Settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateSystemAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (accountForm.newPassword !== accountForm.confirmPassword) {
      setAccountError('New password and confirmation do not match.');
      return;
    }
    setAccountSaving(true);
    setAccountError('');
    setAccountMessage('');
    try {
      const response = await fetch('/api/admin/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: accountForm.currentPassword,
          username: accountForm.username,
          newPassword: accountForm.newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update system account.');
      setAdminUsername(result.username);
      setAccountForm({
        currentPassword: '',
        username: result.username,
        newPassword: '',
        confirmPassword: '',
      });
      setAccountMessage('System account updated. Other admin sessions were signed out.');
    } catch (saveError) {
      setAccountError(saveError instanceof Error ? saveError.message : 'Could not update system account.');
    } finally {
      setAccountSaving(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin/login');
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not sign out.');
    }
  };

  const importBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restoreFile) {
      setBackupError('Choose a backup file to restore.');
      return;
    }
    setOperation('restore');
    setBackupError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.set('backup', restoreFile);
      formData.set('confirmation', restoreConfirmation);
      const response = await fetch('/api/admin/database/import', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Restore failed.');
      setMessage(`Restore complete. A recovery backup was saved as ${result.recoveryBackup.filename}.`);
      setRestoreFile(null);
      setRestoreConfirmation('');
      await refreshBackups();
      const settingsResponse = await fetch('/api/admin/settings');
      const restoredSettings = await settingsResponse.json();
      if (!settingsResponse.ok) throw new Error(restoredSettings.error || 'Restore completed but settings could not be reloaded.');
      setSettings({ ...restoredSettings, ...normalizePayrollSettings(restoredSettings) });
    } catch (restoreError) {
      setBackupError(restoreError instanceof Error ? restoreError.message : 'Restore failed.');
    } finally {
      setOperation('');
    }
  };

  const resetBusinessData = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (resetConfirmation !== 'RESET ALL BUSINESS DATA') {
      setBackupError('Type RESET ALL BUSINESS DATA exactly to continue.');
      return;
    }
    if (!window.confirm('This will clear business records after saving a recovery backup. Continue?')) return;
    setOperation('reset');
    setBackupError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/database/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: resetConfirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Reset failed.');
      setMessage(`Business data cleared. Settings were preserved. Recovery backup: ${result.recoveryBackup.filename}.`);
      setResetConfirmation('');
      await refreshBackups();
    } catch (resetError) {
      setBackupError(resetError instanceof Error ? resetError.message : 'Reset failed.');
    } finally {
      setOperation('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showSettingsSections />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-gray-500">Loading settings...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showSettingsSections />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage business details, POS behavior, access, and data.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={logout}>Admin logout</button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}

      {settings && (
        <form onSubmit={updateSettings} className="grid items-start gap-6 xl:grid-cols-2">
          <section id="business-settings" className="scroll-mt-32 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow xl:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900">Business details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="business-name">Business name</label>
                <input
                  id="business-name"
                  className="input"
                  value={settings.businessName}
                  onChange={(event) => setSettings({ ...settings, businessName: event.target.value })}
                  maxLength={250}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="business-phone">Phone</label>
                <input
                  id="business-phone"
                  className="input"
                  value={settings.businessPhone}
                  onChange={(event) => setSettings({ ...settings, businessPhone: event.target.value })}
                  maxLength={250}
                />
              </div>
              <div>
                <label className="label" htmlFor="business-email">Email</label>
                <input
                  id="business-email"
                  className="input"
                  type="email"
                  value={settings.businessEmail}
                  onChange={(event) => setSettings({ ...settings, businessEmail: event.target.value })}
                  maxLength={250}
                />
              </div>
              <div>
                <label className="label" htmlFor="business-address">Address</label>
                <input
                  id="business-address"
                  className="input"
                  value={settings.businessAddress}
                  onChange={(event) => setSettings({ ...settings, businessAddress: event.target.value })}
                  maxLength={250}
                />
              </div>
            </div>
          </section>

          <section id="fiscal-settings" className="scroll-mt-32 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Fiscal and regional settings</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="label" htmlFor="fiscal-month">Fiscal year starts</label>
                <select
                  id="fiscal-month"
                  className="input"
                  value={settings.fiscalYearStartMonth}
                  onChange={(event) => setSettings({
                    ...settings,
                    fiscalYearStartMonth: Number(event.target.value),
                  })}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fiscal-day">Start day</label>
                <input
                  id="fiscal-day"
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  value={settings.fiscalYearStartDay}
                  onChange={(event) => setSettings({
                    ...settings,
                    fiscalYearStartDay: Number(event.target.value),
                  })}
                  required
                />
              </div>
              <div>
                <span className="label">Currency / timezone</span>
                <p className="pt-2 text-sm text-gray-700">{settings.currency} · {settings.timezone}</p>
              </div>
            </div>
          </section>

          <section id="pos-settings" className="scroll-mt-32 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">POS defaults</h2>
              <p className="mt-1 text-sm text-gray-600">
                Configure accepted payment methods, quantity precision, and point-of-sale tax.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50/50 p-4">
                <span className="label">Payment methods</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((method) => (
                    <label key={method.value} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={settings.posPaymentMethods.includes(method.value)}
                        onChange={(event) => {
                          const methods = event.target.checked
                            ? [...settings.posPaymentMethods, method.value]
                            : settings.posPaymentMethods.filter((value) => value !== method.value);
                          setSettings({ ...settings, posPaymentMethods: methods });
                        }}
                      />
                      {method.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/50 p-4">
                <div>
                  <label className="label" htmlFor="quantity-precision">Quantity decimal places</label>
                  <input
                    id="quantity-precision"
                    className="input"
                    type="number"
                    min={0}
                    max={4}
                    value={settings.posQuantityPrecision}
                    onChange={(event) => setSettings({
                      ...settings,
                      posQuantityPrecision: Number(event.target.value),
                    })}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/50 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={Boolean(settings.taxEnabled)}
                  onChange={(event) => setSettings({
                    ...settings,
                    taxEnabled: event.target.checked,
                  })}
                />
                Enable POS tax
              </label>
              <div className="max-w-xs">
                <label className="label" htmlFor="pos-tax-rate">Tax rate (%)</label>
                <input
                  id="pos-tax-rate"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={Number.isFinite(settings.taxRate) ? settings.taxRate * 100 : 0}
                  onChange={(event) => setSettings({
                    ...settings,
                    taxRate: Number(event.target.value) / 100,
                  })}
                  required
                />
              </div>
            </div>
          </section>

          <section id="payroll-settings" className="scroll-mt-32 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow xl:col-span-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payroll calculations</h2>
              <p className="mt-1 text-sm text-gray-600">
                These settings apply when an open payroll run is computed. Closed and paid runs are not recalculated.
                Review your payroll policy before changing rates.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="payroll-hours-per-day">Standard work hours per day</label>
                  <input
                    id="payroll-hours-per-day"
                    className="input"
                    type="number"
                    min={0.1}
                    max={24}
                    step="0.1"
                    value={settings.payrollHoursPerDay}
                    onChange={(event) => setSettings({
                      ...settings,
                      payrollHoursPerDay: Number(event.target.value),
                    })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="payroll-unpaid-break-hours">Unpaid break (hours)</label>
                  <input
                    id="payroll-unpaid-break-hours"
                    className="input"
                    type="number"
                    min={0}
                    max={4}
                    step="0.25"
                    value={settings.payrollUnpaidBreakHours}
                    onChange={(event) => setSettings({
                      ...settings,
                      payrollUnpaidBreakHours: Number(event.target.value),
                    })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/50 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={settings.payrollOvertimeEnabled}
                      onChange={(event) => setSettings({
                        ...settings,
                        payrollOvertimeEnabled: event.target.checked,
                      })}
                    />
                    Apply overtime premium
                  </label>
                  <div>
                    <label className="label" htmlFor="payroll-overtime-multiplier">Overtime multiplier</label>
                    <input
                      id="payroll-overtime-multiplier"
                      className="input"
                      type="number"
                      min={1}
                      max={10}
                      step="0.01"
                      value={settings.payrollOvertimeMultiplier}
                      onChange={(event) => setSettings({
                        ...settings,
                        payrollOvertimeMultiplier: Number(event.target.value),
                      })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/50 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={settings.payrollSssEnabled}
                      onChange={(event) => setSettings({
                        ...settings,
                        payrollSssEnabled: event.target.checked,
                      })}
                    />
                    Apply SSS deduction
                  </label>
                  <div>
                    <label className="label" htmlFor="payroll-sss-rate">Flat SSS percentage of gross pay</label>
                    <input
                      id="payroll-sss-rate"
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={settings.payrollSssRate * 100}
                      onChange={(event) => setSettings({
                        ...settings,
                        payrollSssRate: Number(event.target.value) / 100,
                      })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/50 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={settings.payrollThirteenthEnabled}
                      onChange={(event) => setSettings({
                        ...settings,
                        payrollThirteenthEnabled: event.target.checked,
                      })}
                    />
                    Accrue 13th-month pay separately
                  </label>
                  <div>
                    <label className="label" htmlFor="payroll-thirteenth-rate">Accrual percentage of regular pay</label>
                    <input
                      id="payroll-thirteenth-rate"
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={settings.payrollThirteenthRate * 100}
                      onChange={(event) => setSettings({
                        ...settings,
                        payrollThirteenthRate: Number(event.target.value) / 100,
                      })}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Standard work hours set both the overtime threshold and the divisor for hourly pay:
              hourly rate = employee daily rate ÷ standard hours. If the overtime premium is off, recorded hours still
              receive base pay. Gross = base pay + overtime premium. SSS is a configurable flat percentage of gross;
              a 13th-month accrual is a separate percentage of regular pay and is not deducted from net pay. The unpaid
              break is deducted only when elapsed time reaches standard hours plus the break duration. This flat SSS
              setting is not a statutory contribution bracket table.
            </p>
          </section>

          <div className="flex justify-end border-t border-gray-200 pt-4 xl:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
      {settings && (
        <div className="space-y-6">
          <div id="data-settings" className="scroll-mt-32 space-y-6">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Database backups</h2>
              <p className="mt-1 text-sm text-gray-600">
                Export a portable Extended JSON backup. Restore replaces application collections and saves a recovery copy first.
              </p>
            </div>
            <a className="btn-primary inline-flex" href="/api/admin/database/export">
              Download Backup
            </a>
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <h3 className="font-medium text-gray-900">Restore from backup</h3>
              <form onSubmit={importBackup} className="space-y-3">
                <label className="block">
                  <span className="sr-only">Choose backup file</span>
                  <input
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-Inpay-50 file:text-Inpay-700 hover:file:bg-Inpay-100 cursor-pointer"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
                    required
                  />
                </label>
                <div>
                  <label className="label" htmlFor="restore-confirmation">
                    Type REPLACE APPLICATION DATA
                  </label>
                  <input
                    id="restore-confirmation"
                    className="input"
                    value={restoreConfirmation}
                    onChange={(event) => setRestoreConfirmation(event.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={operation !== '' || restoreConfirmation !== 'REPLACE APPLICATION DATA'}
                >
                  {operation === 'restore' ? 'Restoring...' : 'Restore Backup'}
                </button>
              </form>
            </div>
            <div className="space-y-2 border-t border-gray-200 pt-4">
              <h3 className="font-medium text-gray-900">Automatic recovery backups</h3>
              {backupError && <p role="alert" className="text-sm text-red-600">{backupError}</p>}
              {backups.length === 0 ? (
                <p className="text-sm text-gray-500">No recovery backups have been created yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {backups.map((backup) => (
                    <li key={backup.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {backup.filename} · {new Date(backup.uploadDate).toLocaleString()}
                      </span>
                      <a
                        className="shrink-0 text-Inpay-600 hover:text-Inpay-700"
                        href={`/api/admin/database/backups/${backup.id}`}
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section id="danger-zone" className="scroll-mt-32 space-y-3 rounded-lg border border-red-300 bg-red-50 p-6 shadow">
              <h2 className="font-semibold text-red-800">Danger Zone</h2>
              <h3 className="font-medium text-red-700">Reset business data</h3>
              <p className="text-sm text-gray-600">
                This removes payroll, ledger, sales, and inventory records after saving a recovery backup. Settings and the database itself are preserved.
              </p>
              <form onSubmit={resetBusinessData} className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="input"
                  aria-label="Reset confirmation phrase"
                  placeholder="Type RESET ALL BUSINESS DATA"
                  value={resetConfirmation}
                  onChange={(event) => setResetConfirmation(event.target.value)}
                  required
                />
                <button
                  className="btn-ghost text-red-700"
                  type="submit"
                  disabled={operation !== '' || resetConfirmation !== 'RESET ALL BUSINESS DATA'}
                >
                  {operation === 'reset' ? 'Resetting...' : 'Reset Business Data'}
                </button>
              </form>
          </section>
          </div>
          <div id="access-settings" className="scroll-mt-32 grid items-start gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900">System account</h2>
              <p className="mt-1 text-sm text-gray-600">
                Signed in as <span className="font-medium">{adminUsername}</span>. Account credentials are stored in the database as a salted password hash.
              </p>
              {accountError && <p role="alert" className="mt-3 text-sm text-red-600">{accountError}</p>}
              {accountMessage && <p role="status" className="mt-3 text-sm text-green-700">{accountMessage}</p>}
              <form onSubmit={updateSystemAccount} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="account-current-password">Current password</label>
                  <input
                    id="account-current-password"
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={accountForm.currentPassword}
                    onChange={(event) => setAccountForm({ ...accountForm, currentPassword: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="account-username">New username</label>
                  <input
                    id="account-username"
                    className="input"
                    autoComplete="username"
                    minLength={3}
                    maxLength={64}
                    pattern="[A-Za-z0-9._-]{3,64}"
                    value={accountForm.username}
                    onChange={(event) => setAccountForm({ ...accountForm, username: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="account-new-password">New password</label>
                  <input
                    id="account-new-password"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    value={accountForm.newPassword}
                    onChange={(event) => setAccountForm({ ...accountForm, newPassword: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="account-confirm-password">Confirm new password</label>
                  <input
                    id="account-confirm-password"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    value={accountForm.confirmPassword}
                    onChange={(event) => setAccountForm({ ...accountForm, confirmPassword: event.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="btn-primary" disabled={accountSaving}>
                    {accountSaving ? 'Updating...' : 'Update System Account'}
                  </button>
                </div>
              </form>
            </section>
            <PosCashierSettings />
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
