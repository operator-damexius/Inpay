import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Inpay',
  description: 'Terms of service for the Inpay business management system.',
};
export const revalidate = 3600;

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-medium text-Inpay-700 hover:underline">Back to Inpay</Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective date: 10/01/2026</p>
        </header>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">1. Provider and scope</h2>
          <p className="text-gray-700">
            These terms apply to the Inpay payroll, inventory, ledger, and point-of-sale system operated by [legal business name] at [business address] (&quot;Provider&quot;). They take effect on 10/01/2026 for [eligible business users or customers].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">2. Authorized use and accounts</h2>
          <p className="text-gray-700">
            Users may use the system only for an authorized business purpose and must protect their administrator credentials and cashier PINs. The business is responsible for assigning appropriate access, reviewing account activity, and removing access when it is no longer needed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">3. Customer data and responsibilities</h2>
          <p className="text-gray-700">
            The business remains responsible for the accuracy and lawfulness of data it enters, notices and permissions required for that data, and compliance with employment, payroll, tax, privacy, and recordkeeping obligations. Specify data ownership, permitted processing, and any processor agreement here: [data and processing terms].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">4. Service availability and backups</h2>
          <p className="text-gray-700">
            Service availability, maintenance, support hours, backup frequency, recovery objectives, and any service-level commitment must be stated here: [availability and support terms]. Administrators should maintain secure backups and verify recovery procedures.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">5. Fees and renewal</h2>
          <p className="text-gray-700">
            If the service is offered commercially, specify its plans, fees, taxes, payment terms, renewal, cancellation, refunds, and any trial period here: [commercial terms]. Do not publish this draft until these terms match the actual service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">6. Limits and termination</h2>
          <p className="text-gray-700">
            Define prohibited use, suspension and termination grounds, data export and deletion after termination, warranty disclaimers, liability limits, and exceptions required by law here: [acceptable use and liability terms].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">7. Governing law and changes</h2>
          <p className="text-gray-700">
            These terms are governed by [jurisdiction], with disputes handled in [venue], subject to non-waivable local rights. Identify how users will be notified of material changes and when updated terms take effect: [change notice process].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">8. Contact</h2>
          <p className="text-gray-700">
            Questions about these terms may be sent to [legal or support contact email].
          </p>
        </section>
      </article>
    </main>
  );
}
