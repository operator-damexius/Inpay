// Runtime validation coverage for: COGS-eligible stock allocation.
import { describe, expect, it } from 'vitest';
import { getCogsEligibleQuantityRemoved } from './cogs-stock';

describe('getCogsEligibleQuantityRemoved', () => {
  it('removes pre-cutover stock before COGS-eligible stock', () => {
    expect(getCogsEligibleQuantityRemoved(10, 4, 6)).toBe(0);
  });

  it('returns only the eligible portion when a removal crosses the cutover boundary', () => {
    expect(getCogsEligibleQuantityRemoved(10, 4, 8)).toBe(2);
  });

  it('counts all removed quantity when the balance is fully eligible', () => {
    expect(getCogsEligibleQuantityRemoved(4, 4, 2.5)).toBe(2.5);
  });

  it('rejects removal beyond the available balance', () => {
    expect(() => getCogsEligibleQuantityRemoved(4, 2, 5)).toThrow(RangeError);
  });
});
