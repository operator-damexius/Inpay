import AppShell from '@/components/AppShell';

export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
