import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="print:hidden border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>Legal and privacy information</span>
        <nav aria-label="Legal">
          <ul className="flex gap-4">
            <li><Link className="hover:text-Inpay-700 hover:underline" href="/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-Inpay-700 hover:underline" href="/terms">Terms of Service</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
