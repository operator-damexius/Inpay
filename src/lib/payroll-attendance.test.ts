import { describe, expect, it } from 'vitest';
import { calculateAttendanceHours, getPayrollWorkDate } from './payroll-attendance';

describe('payroll attendance calculations', () => {
  it('uses the configured timezone to assign a work date', () => {
    const timeIn = new Date('2026-11-22T16:30:00.000Z');

    expect(getPayrollWorkDate(timeIn, 'Asia/Manila').toISOString()).toBe('2026-11-23T00:00:00.000Z');
  });

  it('deducts the configured break on a full-length shift before calculating overtime', () => {
    const result = calculateAttendanceHours(
      new Date('2026-11-22T14:00:00.000Z'),
      new Date('2026-11-22T23:30:00.000Z'),
      8,
      1
    );

    expect(result).toEqual({ totalHours: 8.5, overtimeHours: 0.5, breakHours: 1 });
  });

  it('does not deduct the break from a shift shorter than standard hours plus break', () => {
    const result = calculateAttendanceHours(
      new Date('2026-11-22T14:00:00.000Z'),
      new Date('2026-11-22T22:00:00.000Z'),
      8,
      1
    );

    expect(result).toEqual({ totalHours: 8, overtimeHours: 0, breakHours: 0 });
  });

  it('rejects invalid and stale clock-out durations', () => {
    expect(() => calculateAttendanceHours(
      new Date('2026-11-22T23:00:00.000Z'),
      new Date('2026-11-22T22:00:00.000Z'),
      8,
      1
    )).toThrow(RangeError);
    expect(() => calculateAttendanceHours(
      new Date('2026-11-20T00:00:00.000Z'),
      new Date('2026-11-21T01:00:00.000Z'),
      8,
      1
    )).toThrow(RangeError);
  });
});
