import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Inpay',
  description: 'Privacy policy for the Inpay business management system.',
};
export const revalidate = 3600;

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-medium text-Inpay-700 hover:underline">Back to Inpay</Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective date: 10/01/2026</p>
        </header>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">1. Who is responsible</h2>
          <p className="text-gray-700">
            [Legal business name] (&quot;we&quot;) operates Inpay for [business purpose]. Our business address is [business address]. For privacy questions, contact [privacy contact name or role] at [privacy contact email].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">2. Information handled</h2>
          <p className="text-gray-700">
            Depending on how the system is configured and used, it may contain business contact details, employee and cashier identifiers, payroll and attendance records, account credentials, inventory records, customer names, sales and payment-method records, and audit or backup data. Do not enter sensitive information that is not needed for the stated business purpose.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">3. How information is used</h2>
          <p className="text-gray-700">
            Information is used to operate payroll, attendance, inventory, point-of-sale, ledger, reporting, account security, support, and backup or recovery functions. Identify any additional analytics, communications, or third-party integrations here: [describe additional uses or state none].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">4. Legal grounds and disclosures</h2>
          <p className="text-gray-700">
            The business must identify the legal grounds that apply in each relevant jurisdiction. Information may be disclosed to authorized workforce members, hosting and database providers, professional advisers, or authorities where legally required. List the actual providers and any international data transfers here: [provider and transfer details].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">5. Retention and deletion</h2>
          <p className="text-gray-700">
            Set and follow a retention schedule that accounts for payroll, tax, employment, and accounting requirements: [retention periods by record type]. Database backups may retain deleted records until the backup expires or is securely removed under [backup retention schedule].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">6. Security and cookies</h2>
          <p className="text-gray-700">
            We use access controls and session credentials to protect the system. No method of storage or transmission is completely secure; document the actual safeguards, incident process, and service providers here: [security and incident-response details]. Inpay uses session cookies for administrator and cashier authentication; confirm the cookie behavior and list any other cookies or tracking technologies here: [cookie details].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">7. Privacy choices and contact</h2>
          <p className="text-gray-700">
            Applicable rights and complaint channels depend on the person&apos;s location and the business&apos;s role. Explain how people can request access, correction, deletion, or other applicable rights, and identify the relevant regulator: [rights request process and regulator]. Contact [privacy contact email] for privacy requests.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">8. Changes</h2>
          <p className="text-gray-700">
            We will update this notice when our practices or legal obligations change. The published version should include its effective date and a record of material changes.
          </p>
        </section>
      </article>
    </main>
  );
}
