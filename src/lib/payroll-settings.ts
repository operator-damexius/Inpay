export interface PayrollSettings {
  payrollOvertimeEnabled: boolean;
  payrollOvertimeMultiplier: number;
  payrollHoursPerDay: number;
  payrollUnpaidBreakHours: number;
  payrollSssEnabled: boolean;
  payrollSssRate: number;
  payrollThirteenthEnabled: boolean;
  payrollThirteenthRate: number;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  payrollOvertimeEnabled: true,
  payrollOvertimeMultiplier: 1.3,
  payrollHoursPerDay: 8,
  payrollUnpaidBreakHours: 1,
  payrollSssEnabled: true,
  payrollSssRate: 0.045,
  payrollThirteenthEnabled: true,
  payrollThirteenthRate: 1 / 12,
};

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function normalizePayrollSettings(settings: Partial<PayrollSettings>): PayrollSettings {
  return {
    payrollOvertimeEnabled: typeof settings.payrollOvertimeEnabled === 'boolean'
      ? settings.payrollOvertimeEnabled
      : DEFAULT_PAYROLL_SETTINGS.payrollOvertimeEnabled,
    payrollOvertimeMultiplier: isNumberInRange(settings.payrollOvertimeMultiplier, 1, 10)
      ? settings.payrollOvertimeMultiplier
      : DEFAULT_PAYROLL_SETTINGS.payrollOvertimeMultiplier,
    payrollHoursPerDay: isNumberInRange(settings.payrollHoursPerDay, 0.1, 24)
      ? settings.payrollHoursPerDay
      : DEFAULT_PAYROLL_SETTINGS.payrollHoursPerDay,
    payrollUnpaidBreakHours: isNumberInRange(settings.payrollUnpaidBreakHours, 0, 4)
      ? settings.payrollUnpaidBreakHours
      : DEFAULT_PAYROLL_SETTINGS.payrollUnpaidBreakHours,
    payrollSssEnabled: typeof settings.payrollSssEnabled === 'boolean'
      ? settings.payrollSssEnabled
      : DEFAULT_PAYROLL_SETTINGS.payrollSssEnabled,
    payrollSssRate: isNumberInRange(settings.payrollSssRate, 0, 1)
      ? settings.payrollSssRate
      : DEFAULT_PAYROLL_SETTINGS.payrollSssRate,
    payrollThirteenthEnabled: typeof settings.payrollThirteenthEnabled === 'boolean'
      ? settings.payrollThirteenthEnabled
      : DEFAULT_PAYROLL_SETTINGS.payrollThirteenthEnabled,
    payrollThirteenthRate: isNumberInRange(settings.payrollThirteenthRate, 0, 1)
      ? settings.payrollThirteenthRate
      : DEFAULT_PAYROLL_SETTINGS.payrollThirteenthRate,
  };
}
