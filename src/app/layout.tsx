import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import SiteFooter from '@/components/SiteFooter';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Inpay',
  description: 'Payroll and Inventory system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </Head>
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
