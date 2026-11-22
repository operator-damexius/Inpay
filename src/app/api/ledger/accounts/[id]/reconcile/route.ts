import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import LedgerAccount from '@/models/LedgerAccount';
import JournalEntry from '@/models/JournalEntry';
import LedgerReconciliation from '@/models/LedgerReconciliation';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import {
  ensureDefaultLedgerAccounts,
  initializeLedgerAccounting,
  migrateLegacyLedgerEntries,
  postJournalEntry,
} from '@/lib/ledger-accounting';

export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  if (!isSameOriginRequest(request)) throw new ApiError('Invalid request origin.', 403);
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError('Invalid ledger account.', 400);

  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) throw new ApiError('Enter valid reconciliation details.', 400);
  const values = body as Record<string, unknown>;
  if (
    (typeof values.actualBalance !== 'number' && typeof values.actualBalance !== 'string') ||
    (typeof values.actualBalance === 'string' && !values.actualBalance.trim())
  ) {
    throw new ApiError('Enter a valid actual balance.', 400);
  }
  const actualBalance = Number(values.actualBalance);
  const statementDateText = typeof values.statementDate === 'string' ? values.statementDate : '';
  const reference = typeof values.reference === 'string' ? values.reference.trim() : '';
  const reason = typeof values.reason === 'string' ? values.reason.trim() : '';
  if (
    !Number.isFinite(actualBalance) ||
    actualBalance < 0 ||
    Math.abs(actualBalance * 100 - Math.round(actualBalance * 100)) > 1e-8
  ) {
    throw new ApiError('Enter an actual balance with no more than two decimal places.', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(statementDateText)) {
    throw new ApiError('Choose a valid statement date.', 400);
  }
  const statementDate = new Date(`${statementDateText}T23:59:59.999Z`);
  if (
    Number.isNaN(statementDate.getTime()) ||
    statementDate.toISOString().slice(0, 10) !== statementDateText
  ) {
    throw new ApiError('Choose a valid statement date.', 400);
  }
  if (!reference || reference.length > 100) throw new ApiError('Enter a reconciliation reference (100 characters or fewer).', 400);
  if (!reason || reason.length > 500) throw new ApiError('Enter a reason (500 characters or fewer).', 400);

  await connectToDatabase();
  await initializeLedgerAccounting();
  await LedgerReconciliation.init();
  await migrateLegacyLedgerEntries();
  const session = await mongoose.startSession();
  let result: {
    reconciled: true;
    difference: number;
    actualBalance: number;
    bookBalance: number;
    reference: string;
  } | null = null;
  try {
    await session.withTransaction(async () => {
      const account = await LedgerAccount.findById(id).session(session);
      if (!account || !account.isActive) throw new ApiError('Active ledger account not found.', 404);
      if (account.type !== 'asset') {
        throw new ApiError('Only asset accounts can be reconciled against a counted or statement balance.', 400);
      }
      const referenceKey = reference.toLowerCase();
      if (await LedgerReconciliation.exists({ account: account._id, referenceKey }).session(session)) {
        throw new ApiError('This reconciliation reference has already been recorded for the account.', 409);
      }

      const [balanceResult] = await JournalEntry.aggregate([
        { $match: { date: { $lte: statementDate } } },
        { $unwind: '$lines' },
        { $match: { 'lines.account': account._id } },
        {
          $group: {
            _id: null,
            debits: { $sum: '$lines.debit' },
            credits: { $sum: '$lines.credit' },
          },
        },
      ]).session(session);
      const bookBalance = Math.round(((balanceResult?.debits ?? 0) - (balanceResult?.credits ?? 0)) * 100) / 100;
      const difference = Math.round((actualBalance - bookBalance) * 100) / 100;
      let journalEntryId: mongoose.Types.ObjectId | undefined;
      if (difference !== 0) {
        const accounts = await ensureDefaultLedgerAccounts(session);
        const offset = accounts.get(difference > 0 ? 'RECONCILIATION_GAIN' : 'RECONCILIATION');
        if (!offset) throw new ApiError('Reconciliation offset account is not available.', 500);
        const entry = await postJournalEntry({
          sourceKey: `reconciliation:${id}:${reference.toLowerCase()}`,
          sourceType: 'reconciliation',
          reference,
          description: reason,
          date: statementDate,
          lines: difference > 0
            ? [
                { account: account._id, debit: difference, credit: 0 },
                { account: offset._id, debit: 0, credit: difference, pnlCategory: 'adjustment' },
              ]
            : [
                { account: offset._id, debit: Math.abs(difference), credit: 0, pnlCategory: 'adjustment' },
                { account: account._id, debit: 0, credit: Math.abs(difference) },
              ],
          createdBy: username,
        }, session);
        journalEntryId = entry._id;
      }
      await LedgerReconciliation.create([{
        account: account._id,
        journalEntry: journalEntryId,
        statementDate,
        actualBalance,
        bookBalance,
        difference,
        reference,
        referenceKey,
        reason,
        createdBy: username,
      }], { session });
      result = { reconciled: true, difference, actualBalance, bookBalance, reference };
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ApiError('This reconciliation reference has already been recorded for the account.', 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  if (!result) throw new ApiError('Reconciliation was not recorded.', 500);
  return NextResponse.json(result);
});
