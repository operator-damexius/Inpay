import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import AdminGate from '@/components/AdminGate';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AdminGate>
  );
}
