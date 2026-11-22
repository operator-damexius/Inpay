import { NextResponse } from 'next/server';
import LedgerAccount from '@/models/LedgerAccount';
import JournalEntry from '@/models/JournalEntry';
import LedgerReconciliation from '@/models/LedgerReconciliation';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import { calculateAccountBalance, ensureDefaultLedgerAccounts, migrateLegacyLedgerEntries } from '@/lib/ledger-accounting';

export const GET = withErrorHandler(async (request: Request) => {
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  await connectToDatabase();
  await ensureDefaultLedgerAccounts();
  await migrateLegacyLedgerEntries();
  const [accounts, balances, reconciliations] = await Promise.all([
    LedgerAccount.find().sort({ code: 1 }).lean(),
    JournalEntry.aggregate([
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.account',
          debits: { $sum: '$lines.debit' },
          credits: { $sum: '$lines.credit' },
        },
      },
    ]),
    LedgerReconciliation.aggregate([
      { $sort: { statementDate: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$account',
          statementDate: { $first: '$statementDate' },
          difference: { $first: '$difference' },
          reference: { $first: '$reference' },
        },
      },
    ]),
  ]);
  const balanceByAccount = new Map(
    balances.map((balance) => [String(balance._id), balance])
  );
  const reconciliationByAccount = new Map(
    reconciliations.map((reconciliation) => [String(reconciliation._id), reconciliation])
  );
  return NextResponse.json(accounts.map((account) => {
    const balance = balanceByAccount.get(String(account._id));
    const reconciliation = reconciliationByAccount.get(String(account._id));
    return {
      ...account,
      balance: calculateAccountBalance(account.type, balance?.debits ?? 0, balance?.credits ?? 0),
      lastReconciliation: reconciliation ? {
        statementDate: reconciliation.statementDate,
        difference: reconciliation.difference,
        reference: reconciliation.reference,
      } : null,
    };
  }));
});

export const POST = withErrorHandler(async (request: Request) => {
  if (!isSameOriginRequest(request)) throw new ApiError('Invalid request origin.', 403);
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) throw new ApiError('Enter valid account details.', 400);
  const values = body as Record<string, unknown>;
  const code = typeof values.code === 'string' ? values.code.trim().toUpperCase() : '';
  const name = typeof values.name === 'string' ? values.name.trim() : '';
  const type = values.type;
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) throw new ApiError('Account code must be 2–20 letters, numbers, dashes, or underscores.', 400);
  if (!name || name.length > 100) throw new ApiError('Account name is required and must be 100 characters or fewer.', 400);
  if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(String(type))) {
    throw new ApiError('Choose a valid account type.', 400);
  }
  await connectToDatabase();
  if (await LedgerAccount.exists({ $or: [{ code }, { name }] })) {
    throw new ApiError('An account with this code or name already exists.', 409);
  }
  let account;
  try {
    account = await LedgerAccount.create({ code, name, type, isActive: true });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ApiError('An account with this code or name already exists.', 409);
    }
    throw error;
  }
  return NextResponse.json({ ...account.toObject(), balance: 0 }, { status: 201 });
});
