import mongoose, { type ClientSession } from 'mongoose';
import JournalEntry, { type IJournalLine } from '@/models/JournalEntry';
import LedgerAccount, { type LedgerAccountType } from '@/models/LedgerAccount';
import Ledger from '@/models/Ledger';
import { ApiError } from '@/lib/api-handler';
import { getPnlCategoryKind, type PnlCategory } from '@/lib/pnl-categories';
import { createBalancedLines } from '@/lib/ledger-calculations';

export { calculateAccountBalance, createBalancedLines } from '@/lib/ledger-calculations';

export const DEFAULT_LEDGER_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: LedgerAccountType;
}> = [
  { code: 'CASH', name: 'Cash', type: 'asset' },
  { code: 'GCASH', name: 'GCash / E-wallet', type: 'asset' },
  { code: 'BANK', name: 'Bank', type: 'asset' },
  { code: 'CARD_CLEARING', name: 'Card clearing', type: 'asset' },
  { code: 'INVENTORY', name: 'Inventory', type: 'asset' },
  { code: 'PAYABLES', name: 'Accounts payable', type: 'liability' },
  { code: 'SSS_PAYABLE', name: 'SSS payable', type: 'liability' },
  { code: 'SALES_TAX_PAYABLE', name: 'Sales tax payable', type: 'liability' },
  { code: 'OPENING_EQUITY', name: 'Opening balance equity', type: 'equity' },
  { code: 'SALES', name: 'Sales income', type: 'income' },
  { code: 'OTHER_INCOME', name: 'Other income', type: 'income' },
  { code: 'RECONCILIATION_GAIN', name: 'Reconciliation gain', type: 'income' },
  { code: 'PAYROLL', name: 'Payroll expense', type: 'expense' },
  { code: 'INVENTORY_PURCHASE', name: 'Inventory purchase expense', type: 'expense' },
  { code: 'COGS', name: 'Cost of goods sold', type: 'expense' },
  { code: 'OPERATING_EXPENSE', name: 'Operating expense', type: 'expense' },
  { code: 'RECONCILIATION', name: 'Reconciliation difference', type: 'expense' },
];

export async function initializeLedgerAccounting() {
  await Promise.all([LedgerAccount.init(), JournalEntry.init()]);
  return ensureDefaultLedgerAccounts();
}

export async function ensureDefaultLedgerAccounts(session?: ClientSession) {
  const accounts = [];
  for (const { code, name, type } of DEFAULT_LEDGER_ACCOUNTS) {
    const query = LedgerAccount.findOneAndUpdate(
      { code },
      { $setOnInsert: { code, name, type, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (session) query.session(session);
    accounts.push(await query);
  }
  return new Map(accounts.map((account) => [account.code, account]));
}

export async function postJournalEntry(input: {
  sourceKey: string;
  sourceType?: string;
  reference: string;
  description: string;
  date: Date;
  lines: IJournalLine[];
  createdBy: string;
  reversalOf?: mongoose.Types.ObjectId;
}, session?: ClientSession) {
  let lines: IJournalLine[];
  try {
    lines = createBalancedLines(input.lines);
  } catch (error) {
    if (error instanceof RangeError) throw new ApiError(error.message, 400);
    throw error;
  }
  const existingQuery = JournalEntry.findOne({ sourceKey: input.sourceKey });
  if (session) existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) return existing;
  const [entry] = await JournalEntry.create([{
    ...input,
    lines,
  }], session ? { session } : undefined);
  return entry;
}

export async function migrateLegacyLedgerEntries() {
  await Promise.all([LedgerAccount.init(), JournalEntry.init(), Ledger.init()]);
  const accounts = await ensureDefaultLedgerAccounts();
  const legacyEntries = await Ledger.find({ migratedToJournal: { $ne: true } })
    .sort({ date: 1, createdAt: 1, _id: 1 });
  for (const legacy of legacyEntries) {
    const sourceKey = `legacy:${legacy._id.toString()}`;
    if (legacy.amount === 0) {
      legacy.migratedToJournal = true;
      await legacy.save();
      continue;
    }
    const existing = await JournalEntry.findOne({ sourceKey });
    if (!existing) {
      const category = legacy.pnlCategory || 'unclassified';
      const categoryKind = getPnlCategoryKind(category);
      const amount = Math.round((Math.abs(legacy.amount) + Number.EPSILON) * 100) / 100;
      const cash = accounts.get('CASH');
      if (!cash) throw new ApiError('Default cash account is not available.', 500);
      const categoryCode = getPnlAccountCode(category) ||
        (category === 'inventory_asset' ? 'INVENTORY' : 'OPENING_EQUITY');
      const categoryAccount = accounts.get(categoryCode);
      const bank = accounts.get('BANK');
      if (!categoryAccount || !bank) throw new ApiError('Default ledger accounts are not available.', 500);
      let lines: IJournalLine[];
      if (category === 'transfer') {
        lines = legacy.amount >= 0
          ? [
              { account: bank._id, debit: amount, credit: 0, pnlCategory: 'transfer' },
              { account: cash._id, debit: 0, credit: amount, pnlCategory: 'transfer' },
            ]
          : [
              { account: cash._id, debit: amount, credit: 0, pnlCategory: 'transfer' },
              { account: bank._id, debit: 0, credit: amount, pnlCategory: 'transfer' },
            ];
      } else if (categoryKind === 'income') {
        lines = legacy.amount >= 0
          ? [
              { account: cash._id, debit: amount, credit: 0 },
              { account: categoryAccount._id, debit: 0, credit: amount, pnlCategory: category },
            ]
          : [
              { account: categoryAccount._id, debit: amount, credit: 0, pnlCategory: category },
              { account: cash._id, debit: 0, credit: amount },
            ];
      } else if (category === 'cost_of_goods_sold') {
        const inventory = accounts.get('INVENTORY');
        if (!inventory) throw new ApiError('Default inventory account is not available.', 500);
        lines = legacy.amount <= 0
          ? [
              { account: categoryAccount._id, debit: amount, credit: 0, pnlCategory: category },
              { account: inventory._id, debit: 0, credit: amount },
            ]
          : [
              { account: inventory._id, debit: amount, credit: 0 },
              { account: categoryAccount._id, debit: 0, credit: amount, pnlCategory: category },
            ];
      } else if (categoryKind === 'expense') {
        lines = legacy.amount <= 0
          ? [
              { account: categoryAccount._id, debit: amount, credit: 0, pnlCategory: category },
              { account: cash._id, debit: 0, credit: amount },
            ]
          : [
              { account: cash._id, debit: amount, credit: 0 },
              { account: categoryAccount._id, debit: 0, credit: amount, pnlCategory: category },
            ];
      } else if (category === 'inventory_asset') {
        lines = legacy.amount <= 0
          ? [
              { account: categoryAccount._id, debit: amount, credit: 0, pnlCategory: category },
              { account: cash._id, debit: 0, credit: amount },
            ]
          : [
              { account: cash._id, debit: amount, credit: 0 },
              { account: categoryAccount._id, debit: 0, credit: amount, pnlCategory: category },
            ];
      } else {
        lines = legacy.amount >= 0
          ? [
              { account: cash._id, debit: amount, credit: 0 },
              { account: categoryAccount._id, debit: 0, credit: amount, pnlCategory: category },
            ]
          : [
              { account: categoryAccount._id, debit: amount, credit: 0, pnlCategory: category },
              { account: cash._id, debit: 0, credit: amount },
            ];
      }
      try {
        await postJournalEntry({
          sourceKey,
          sourceType: legacy.type,
          reference: legacy.reference,
          description: legacy.description,
          date: legacy.date,
          lines,
          createdBy: legacy.createdBy || 'legacy',
          ...(legacy.reversalOf ? {
            reversalOf: (await JournalEntry.findOne({ sourceKey: `legacy:${legacy.reversalOf.toString()}` }))?._id,
          } : {}),
        });
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) {
          throw error;
        }
      }
    }
    legacy.migratedToJournal = true;
    await legacy.save();
  }
}

export function getDefaultAccountCodeForPaymentMethod(paymentMethod: string) {
  switch (paymentMethod) {
    case 'cash': return 'CASH';
    case 'gcash': return 'GCASH';
    case 'bank_transfer': return 'BANK';
    case 'card': return 'CARD_CLEARING';
    default: throw new ApiError('No ledger account is configured for this payment method.', 400);
  }
}

export function getPnlAccountCode(category: PnlCategory) {
  switch (category) {
    case 'sales_income': return 'SALES';
    case 'other_income': return 'OTHER_INCOME';
    case 'payroll': return 'PAYROLL';
    case 'inventory_purchase': return 'INVENTORY_PURCHASE';
    case 'cost_of_goods_sold': return 'COGS';
    case 'operating_expense': return 'OPERATING_EXPENSE';
    case 'inventory_asset': return 'INVENTORY';
    default: return null;
  }
}

