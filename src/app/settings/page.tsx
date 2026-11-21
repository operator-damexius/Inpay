'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PosCashierSettings from '@/components/PosCashierSettings';

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
        if (active) setSettings(result);
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
      setSettings(result);
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
      setSettings(restoredSettings);
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
            <h2 className="text-lg font-semibold text-gray-900">POS defaults</h2>
            <div>
              <span className="label">Payment methods</span>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <div className="max-w-xs">
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
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Tax is disabled until you provide a verified tax rate and calculation policy.
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
                <input
                  className="input"
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
                  required
                />
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
                  className="btn-ghost"
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
