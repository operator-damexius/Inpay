'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || 'Could not verify the system account session.');
        }
        if (!result?.authenticated) {
          router.replace('/admin/login');
          return;
        }
        if (active) setReady(true);
      })
      .catch((sessionError) => {
        if (active) {
          setError(sessionError instanceof Error
            ? sessionError.message
            : 'Could not verify the system account session.');
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
        <Link href="/admin/login" className="btn-primary mt-4 inline-flex">Go to Sign In</Link>
      </main>
    );
  }
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Checking sign-in...</div>;
  }
  return children;
}
