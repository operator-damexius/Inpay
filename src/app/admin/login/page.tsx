'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Admin sign-in failed.');
      router.replace('/');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Admin sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Admin sign in</h1>
      <p className="mb-6 text-sm text-gray-600">
        Sign in to access settings and database tools.
      </p>
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={login} className="space-y-4">
        <div>
          <label className="label" htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            className="input"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
