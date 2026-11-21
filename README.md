# Inpay

Payroll and Inventory system rebuilt for **Vercel + MongoDB**.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** MongoDB (MongoDB Atlas recommended)
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Deploy:** Vercel

## Features

**Payroll**
- Employees (add, edit, delete)
- Time-in / time-out attendance
- Payroll runs (compute regular pay, overtime, SSS, 13th month, net pay)
- Payslips & reports (print-friendly)

**Ledger & Reporting**
- Ledger entries with explicit P&L categories
- Date-ranged Profit & Loss summary with expense breakdown
- Unclassified legacy entries and non-P&L transfers/adjustments are excluded until reviewed
- Payroll and inventory purchases are not automatically imported into the P&L
- Record new inventory acquisitions in the Ledger as **Inventory acquisition (non-P&L)**; using the **Inventory purchase** expense category as well as COGS would double-count the cost

**Inventory**
- Item master (SKU, name, price, stock, reorder level)
- Categories, units of measure, locations
- Stock status inquiry with low-stock alerts
- Stock adjustments (add / subtract / set)
- Stock balances by location and received stock transfers between locations
- Purchasing / purchase orders (receive to add stock)
- Inventory dashboard activity includes manual adjustments, received purchases and transfers, and POS sales

**Point of Sale**
- Cashier sign-in with individual employee PINs (admin-assigned)
- Location-aware checkout with oversell prevention and configurable fractional quantities
- Separate POS selling prices, payment method settings, receipt history, and stock deduction
- Completed POS sales are recorded as sales income in the ledger and Profit & Loss report
- COGS is recorded for stock received through Purchasing after the cutover, using the item's current inventory price
- Existing stock is excluded from COGS; eligible stock keeps its status through transfers and is consumed after older stock
- Initial stock and stock added through adjustments are excluded; receive purchases through Purchasing to make new quantities COGS-eligible
- Tax is disabled

**Legal notices**
- Draft Privacy Policy and Terms of Service are available at `/privacy` and `/terms`
- Replace all placeholders and obtain legal review before publishing or relying on either draft
- Public legal pages are revalidated hourly; authenticated business data is not cached by these pages

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` in the project root and set:
   ```bash
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/Inpay?retryWrites=true&w=majority
   MONGODB_DB=Inpay
   ADMIN_USERNAME=
   ADMIN_PASSWORD=
   ADMIN_SESSION_SECRET=
   ```
   Use a private bootstrap username and password for the first admin sign-in. Generate the session secret with the command below and keep it at least 32 characters long.

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

### Admin settings and database tools

The dashboard, payroll, inventory, ledger, and Settings pages and APIs require the system admin sign-in. POS uses separate employee cashier PINs. MongoDB must be reachable for either sign-in flow.

For the first admin sign-in, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` as one-time bootstrap credentials, and keep `ADMIN_SESSION_SECRET` configured in `.env.local` or the deployment environment. The first successful login saves a salted password hash in the `systemaccounts` collection. After changing the system account password in Settings, `ADMIN_USERNAME` and `ADMIN_PASSWORD` can be removed; `ADMIN_SESSION_SECRET` must remain set for signed sessions. Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep credentials private and do not commit them. Admin settings, account changes, backup, restore, and reset APIs require an authenticated admin session. Database exports contain sensitive payroll, business, and hashed account records; store backup files securely.

To enable POS cashier access, sign in as an admin and assign each active cashier a unique 6-digit PIN from Payroll → Employees. PINs are stored as salted hashes; after five incorrect attempts, that cashier is temporarily locked out. Cashier sessions expire after 8 hours and use `ADMIN_SESSION_SECRET`.

### Initialize existing location stock

Before using transfers or location-specific stock adjustments, initialize existing item balances:

```bash
npm run migrate:stock-balances
```

The migration preserves existing location balances and adds only the remaining quantity needed to match each item's aggregate on-hand stock at its assigned location. It reports items with stock but no assigned location and items whose location totals exceed their aggregate stock; those require manual review. Assign a location to unassigned items, then run the migration again. The migration is safe to rerun.

Stock transfer receipt and other multi-document stock updates use MongoDB transactions, so use MongoDB Atlas or another replica-set deployment.

### Include existing POS sales in the ledger

New POS sales are recorded automatically. To add sales completed before this change to the ledger, run this idempotent migration once:

```bash
npm run migrate:pos-sales-to-ledger
```

The migration skips sales that already have a matching POS ledger entry and recalculates ledger running balances.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Go to [Vercel](https://vercel.com) → Add New Project → Import your repo.
3. Use Node.js **22.12+, 24.x, or 26+** and add these environment variables in the Vercel project settings:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `MONGODB_DB` — database name (default: `Inpay`)
   - `ADMIN_SESSION_SECRET` — a private random secret of at least 32 characters; keep it configured
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD` — temporary bootstrap credentials for the first admin sign-in; remove them after changing the account password in Settings
4. Click Deploy. Never upload `.env` files; the repository ignores them.

## Project Structure

```
Inpay/
├── src/
│   ├── app/              # Next.js App Router (pages + API routes)
│   │   ├── payroll/      # Payroll pages & API
│   │   ├── inventory/    # Inventory pages & API
│   │   └── page.tsx      # Home
│   ├── components/       # Shared React components
│   ├── lib/              # MongoDB connection helpers
│   └── models/           # Mongoose schemas
├── vercel.json           # Vercel config
├── package.json
├── tailwind.config.js
└── next.config.js
```

## Notes

- The original PHP/MySQL Bitpos source was ionCube-encrypted and could not be read. This Inpay version was rebuilt from scratch as a modern Next.js + MongoDB application.
- MongoDB Atlas is recommended for production (free tier available).
