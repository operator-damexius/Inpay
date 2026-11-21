import Link from 'next/link';

export default function Navbar({ showSettingsSections = false }: { showSettingsSections?: boolean }) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-20 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="Inpay icon" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tight text-gray-900">Inpay</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/payroll" className="text-gray-600 hover:text-Inpay-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50">
              Payroll
            </Link>
            <Link href="/ledger" className="text-gray-600 hover:text-Inpay-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50">
              Ledger
            </Link>
            <Link href="/inventory" className="text-gray-600 hover:text-Inpay-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50">
              Inventory
            </Link>
            <Link href="/pos" className="text-gray-600 hover:text-Inpay-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50">
              POS
            </Link>
            <Link href="/settings" className="text-gray-600 hover:text-Inpay-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50">
              Settings
            </Link>
            <Link
              href="/"
              className="text-gray-600 hover:text-Inpay-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50"
            >
              Home
            </Link>
          </div>
          <details className="relative md:hidden">
            <summary className="cursor-pointer rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
              Menu
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              <Link href="/payroll" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Payroll</Link>
              <Link href="/ledger" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Ledger</Link>
              <Link href="/inventory" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Inventory</Link>
              <Link href="/pos" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">POS</Link>
              <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</Link>
              <Link href="/" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Home</Link>
            </div>
          </details>
        </div>
        {showSettingsSections && (
          <div className="-mx-4 flex gap-2 overflow-x-auto border-t border-gray-100 py-2 sm:mx-0">
            <Link className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" href="/settings#business-settings">Business &amp; fiscal</Link>
            <Link className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" href="/settings#pos-settings">POS</Link>
            <Link className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" href="/settings#access-settings">Access</Link>
            <Link className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" href="/settings#data-settings">Data &amp; backups</Link>
            <Link className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" href="/settings#danger-zone">Danger zone</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
