export interface PayrollCalculationInput {
  totalHours: number;
  overtimeHours: number;
  ratePerDay: number;
  hoursPerDay: number;
  overtimeEnabled: boolean;
  overtimeMultiplier: number;
  sssEnabled: boolean;
  sssRate: number;
  thirteenthEnabled: boolean;
  thirteenthRate: number;
}

export interface PayrollCalculation {
  baseHoursPaid: number;
  overtimeHours: number;
  hourlyRate: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  sssDeduction: number;
  thirteenthAccrual: number;
  netPay: number;
}

export function sumAttendanceRecords(
  records: Array<{ employeeId: string; totalHours: number; overtimeHours: number; breakHours: number }>
) {
  const totalsByEmployee = new Map<string, { totalHours: number; overtimeHours: number; breakHours: number }>();
  for (const record of records) {
    const totals = totalsByEmployee.get(record.employeeId) ?? {
      totalHours: 0,
      overtimeHours: 0,
      breakHours: 0,
    };
    totals.totalHours += record.totalHours;
    totals.overtimeHours += record.overtimeHours;
    totals.breakHours += record.breakHours;
    totalsByEmployee.set(record.employeeId, totals);
  }
  return totalsByEmployee;
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculation {
  const values = [
    input.totalHours,
    input.overtimeHours,
    input.ratePerDay,
    input.hoursPerDay,
    input.overtimeMultiplier,
    input.sssRate,
    input.thirteenthRate,
  ];
  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    input.hoursPerDay === 0 ||
    input.overtimeMultiplier < 1 ||
    input.sssRate > 1 ||
    input.thirteenthRate > 1
  ) {
    throw new RangeError('Payroll calculation values are invalid.');
  }

  const overtimeHours = Math.min(input.overtimeHours, input.totalHours);
  const baseHoursPaid = input.overtimeEnabled
    ? input.totalHours - overtimeHours
    : input.totalHours;
  const hourlyRate = input.ratePerDay / input.hoursPerDay;
  const regularPay = roundMoney(baseHoursPaid * hourlyRate);
  const overtimePay = input.overtimeEnabled
    ? roundMoney(overtimeHours * hourlyRate * input.overtimeMultiplier)
    : 0;
  const grossPay = roundMoney(regularPay + overtimePay);
  const sssDeduction = input.sssEnabled
    ? roundMoney(grossPay * input.sssRate)
    : 0;
  const thirteenthAccrual = input.thirteenthEnabled
    ? roundMoney(regularPay * input.thirteenthRate)
    : 0;

  return {
    baseHoursPaid,
    overtimeHours,
    hourlyRate,
    regularPay,
    overtimePay,
    grossPay,
    sssDeduction,
    thirteenthAccrual,
    netPay: roundMoney(grossPay - sssDeduction),
  };
}
