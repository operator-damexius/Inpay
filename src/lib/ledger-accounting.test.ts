import { describe, expect, it } from 'vitest';
import { calculateAccountBalance, createBalancedLines } from './ledger-calculations';

describe('ledger accounting', () => {
  it('accepts balanced journal lines and rejects unbalanced lines', () => {
    expect(createBalancedLines([
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 },
    ])).toHaveLength(2);
    expect(() => createBalancedLines([
      { debit: 100, credit: 0 },
      { debit: 0, credit: 99 },
    ])).toThrow(RangeError);
  });

  it('calculates balances using normal account sides', () => {
    expect(calculateAccountBalance('asset', 150, 40)).toBe(110);
    expect(calculateAccountBalance('liability', 40, 150)).toBe(110);
    expect(calculateAccountBalance('expense', 75, 0)).toBe(75);
    expect(calculateAccountBalance('income', 0, 75)).toBe(75);
  });
});
