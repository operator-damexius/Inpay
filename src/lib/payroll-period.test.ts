import { describe, expect, it } from 'vitest';
import { parsePayrollPeriod } from './payroll-period';

describe('parsePayrollPeriod', () => {
  it('accepts a valid inclusive date range', () => {
    expect(parsePayrollPeriod('2026-11-01', '2026-11-15')).toEqual({
      start: new Date('2026-11-01T00:00:00.000Z'),
      end: new Date('2026-11-15T00:00:00.000Z'),
    });
  });

  it('rejects impossible dates and reversed periods', () => {
    expect(() => parsePayrollPeriod('2026-02-31', '2026-03-15')).toThrow(RangeError);
    expect(() => parsePayrollPeriod('2026-11-15', '2026-11-01')).toThrow(RangeError);
  });
});
