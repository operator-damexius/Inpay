import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import PayrollRun from '@/models/PayrollRun';
import PayrollDetail from '@/models/PayrollDetail';
import LedgerAccount from '@/models/LedgerAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import { ensureDefaultLedgerAccounts, initializeLedgerAccounting, postJournalEntry } from '@/lib/ledger-accounting';
import type { IJournalLine } from '@/models/JournalEntry';

export const POST = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  if (!isSameOriginRequest(req)) throw new ApiError('Invalid request origin.', 403);
  const username = await getAdminUsername(req);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const body: unknown = await req.json().catch(() => ({}));
  const paymentAccountCode = typeof body === 'object' && body !== null && 'paymentAccountCode' in body &&
      typeof body.paymentAccountCode === 'string'
    ? body.paymentAccountCode.trim().toUpperCase()
    : 'BANK';
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid payroll run.', 400);
  }

  await connectToDatabase();
  await initializeLedgerAccounting();
  const session = await mongoose.startSession();
  let paidRun;
  try {
    await session.withTransaction(async () => {
      const run = await PayrollRun.findById(id).session(session);
      if (!run) throw new ApiError('Payroll run not found.', 404);
      if (run.status !== 'Closed') {
        throw new ApiError('Only a closed payroll run can be marked paid.', 409);
      }

      const details = await PayrollDetail.find({ run: run._id }).session(session).lean();
      const grossPay = Math.round(details.reduce((sum, detail) => sum + detail.grossPay, 0) * 100) / 100;
      const netPay = Math.round(details.reduce((sum, detail) => sum + detail.netPay, 0) * 100) / 100;
      const deductions = Math.round((grossPay - netPay) * 100) / 100;
      const accounts = await ensureDefaultLedgerAccounts(session);
      const payroll = accounts.get('PAYROLL');
      const sssPayable = accounts.get('SSS_PAYABLE');
      const paymentAccount = await LedgerAccount.findOne({
        code: paymentAccountCode,
        type: 'asset',
        isActive: true,
      }).session(session);
      if (!payroll || !sssPayable || !paymentAccount) {
        throw new ApiError('Choose an active asset account for the payroll payment.', 400);
      }
      if (grossPay > 0) {
        await postJournalEntry({
          sourceKey: `payroll-run:${run._id.toString()}`,
          sourceType: 'payroll-run',
          reference: `PAY-${run._id.toString().slice(-8).toUpperCase()}`,
          description: `Payroll payment for ${run.periodStart.toISOString().slice(0, 10)} to ${run.periodEnd.toISOString().slice(0, 10)}`,
          date: new Date(),
          lines: [
            { account: payroll._id, debit: grossPay, credit: 0, pnlCategory: 'payroll' },
            { account: paymentAccount._id, debit: 0, credit: netPay },
            ...(deductions > 0
              ? [{ account: sssPayable._id, debit: 0, credit: deductions }]
              : []),
          ] as IJournalLine[],
          createdBy: username,
        }, session);
      }

      run.status = 'Paid';
      run.datePaid = new Date();
      await run.save({ session });
      paidRun = run;
    });
  } finally {
    await session.endSession();
  }
  return NextResponse.json(paidRun);
});
