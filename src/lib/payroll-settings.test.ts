import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYROLL_SETTINGS, normalizePayrollSettings } from './payroll-settings';

describe('normalizePayrollSettings', () => {
  it('fills missing or invalid values from defaults for legacy settings records', () => {
    expect(normalizePayrollSettings({
      payrollSssRate: Number.NaN,
      payrollThirteenthRate: undefined,
    })).toEqual(DEFAULT_PAYROLL_SETTINGS);
  });

  it('preserves valid disabled flags and zero contribution rates', () => {
    expect(normalizePayrollSettings({
      payrollSssEnabled: false,
      payrollSssRate: 0,
      payrollThirteenthEnabled: false,
      payrollThirteenthRate: 0,
    })).toMatchObject({
      payrollSssEnabled: false,
      payrollSssRate: 0,
      payrollThirteenthEnabled: false,
      payrollThirteenthRate: 0,
    });
  });
});
