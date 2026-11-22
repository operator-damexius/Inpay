import { describe, expect, it } from 'vitest';
import { calculatePayroll, sumAttendanceRecords } from './payroll-calculations';

const defaultSettings = {
  ratePerDay: 800,
  hoursPerDay: 8,
  overtimeEnabled: true,
  overtimeMultiplier: 1.3,
  sssEnabled: true,
  sssRate: 0.045,
  thirteenthEnabled: true,
  thirteenthRate: 1 / 12,
};

describe('calculatePayroll', () => {
  it('sums all attendance records for each employee in the payroll period', () => {
    const totals = sumAttendanceRecords([
      { employeeId: 'employee-1', totalHours: 8, overtimeHours: 0, breakHours: 1 },
      { employeeId: 'employee-1', totalHours: 10, overtimeHours: 2, breakHours: 0 },
      { employeeId: 'employee-2', totalHours: 6, overtimeHours: 0, breakHours: 0 },
    ]);

    expect(totals.get('employee-1')).toEqual({ totalHours: 18, overtimeHours: 2, breakHours: 1 });
    expect(totals.get('employee-2')).toEqual({ totalHours: 6, overtimeHours: 0, breakHours: 0 });
  });

  it('calculates regular and overtime pay from all attendance hours without double counting', () => {
    expect(calculatePayroll({
      ...defaultSettings,
      totalHours: 10,
      overtimeHours: 2,
    })).toEqual({
      baseHoursPaid: 8,
      overtimeHours: 2,
      hourlyRate: 100,
      regularPay: 800,
      overtimePay: 260,
      grossPay: 1060,
      sssDeduction: 47.7,
      thirteenthAccrual: 66.67,
      netPay: 1012.3,
    });
  });

  it('pays overtime hours at the base rate when the overtime premium is disabled', () => {
    const result = calculatePayroll({
      ...defaultSettings,
      totalHours: 10,
      overtimeHours: 2,
      overtimeEnabled: false,
    });

    expect(result.baseHoursPaid).toBe(10);
    expect(result.regularPay).toBe(1000);
    expect(result.overtimePay).toBe(0);
  });

  it('keeps 13th-month accrual separate from net pay and honors disabled deductions', () => {
    const result = calculatePayroll({
      ...defaultSettings,
      totalHours: 8,
      overtimeHours: 0,
      sssEnabled: false,
      thirteenthEnabled: false,
    });

    expect(result.sssDeduction).toBe(0);
    expect(result.thirteenthAccrual).toBe(0);
    expect(result.netPay).toBe(result.grossPay);
  });

  it('rejects invalid calculation rates', () => {
    expect(() => calculatePayroll({
      ...defaultSettings,
      totalHours: 8,
      overtimeHours: 0,
      hoursPerDay: 0,
    })).toThrow(RangeError);
    expect(() => calculatePayroll({
      ...defaultSettings,
      totalHours: 8,
      overtimeHours: 0,
      overtimeMultiplier: 0.5,
    })).toThrow(RangeError);
  });
});
