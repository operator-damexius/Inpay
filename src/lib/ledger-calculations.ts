export type JournalAmountLine = { debit: number; credit: number };
export type LedgerAccountNormalType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export function createBalancedLines<T extends JournalAmountLine>(lines: T[]) {
  if (lines.length < 2) throw new RangeError('A journal entry needs at least two lines.');
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    if (
      !Number.isFinite(line.debit) ||
      !Number.isFinite(line.credit) ||
      line.debit < 0 ||
      line.credit < 0 ||
      (line.debit > 0 && line.credit > 0) ||
      (line.debit === 0 && line.credit === 0) ||
      Math.abs(line.debit * 100 - Math.round(line.debit * 100)) > 1e-8 ||
      Math.abs(line.credit * 100 - Math.round(line.credit * 100)) > 1e-8
    ) {
      throw new RangeError('Each journal line must have either a positive debit or a positive credit.');
    }
    debits += line.debit;
    credits += line.credit;
  }
  if (Math.abs(debits - credits) > 0.005) {
    throw new RangeError('Journal entry debits and credits must balance.');
  }
  return lines;
}

export function calculateAccountBalance(
  type: LedgerAccountNormalType,
  debits: number,
  credits: number
) {
  const delta = debits - credits;
  const balance = type === 'asset' || type === 'expense' ? delta : -delta;
  return Math.round((balance + Number.EPSILON) * 100) / 100;
}
