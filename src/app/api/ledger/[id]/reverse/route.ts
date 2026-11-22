import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import JournalEntry, { type IJournalEntry, type IJournalLine } from '@/models/JournalEntry';
import Ledger, { type ILedger } from '@/models/Ledger';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import { migrateLegacyLedgerEntries, postJournalEntry } from '@/lib/ledger-accounting';

export const POST = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  if (!isSameOriginRequest(request)) throw new ApiError('Invalid request origin.', 403);
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const { id } = await params;
  await connectToDatabase();

  let original: IJournalEntry | null = null;
  let legacyOriginal: ILedger | null = null;
  if (id.startsWith('journal:')) {
    const journalId = id.slice('journal:'.length);
    if (!mongoose.isValidObjectId(journalId)) throw new ApiError('Invalid journal entry.', 400);
    original = await JournalEntry.findById(journalId);
  } else {
    if (!mongoose.isValidObjectId(id)) throw new ApiError('Invalid ledger entry.', 400);
    legacyOriginal = await Ledger.findById(id);
    if (!legacyOriginal) throw new ApiError('Ledger entry not found.', 404);
    await migrateLegacyLedgerEntries();
    original = await JournalEntry.findOne({ sourceKey: `legacy:${legacyOriginal._id.toString()}` });
  }
  if (!original) throw new ApiError('Journal entry not found.', 404);
  if (await JournalEntry.exists({ reversalOf: original._id })) {
    throw new ApiError('This journal entry has already been reversed.', 409);
  }

  const entry = await postJournalEntry({
    sourceKey: `reversal:${original._id.toString()}`,
    sourceType: 'reversal',
    reference: `REV-${original.reference}`.slice(0, 100),
    description: `Reversal of ${original.reference}`,
    date: new Date(),
    lines: original.lines.map((line: IJournalLine) => ({
      account: line.account,
      debit: line.credit,
      credit: line.debit,
      pnlCategory: line.pnlCategory,
      memo: line.memo,
    })),
    createdBy: username,
    reversalOf: original._id,
  });
  if (legacyOriginal) {
    legacyOriginal.auditLog.push({
      action: 'reversed',
      oldValue: legacyOriginal.amount.toFixed(2),
      newValue: 'reversed',
      changedBy: username,
      changedAt: new Date(),
    });
    await legacyOriginal.save();
  }
  await entry.populate('lines.account', 'name code type');
  return NextResponse.json(entry);
});
