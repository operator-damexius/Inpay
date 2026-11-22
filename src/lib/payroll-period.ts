export function parsePayrollPeriod(periodStart: unknown, periodEnd: unknown) {
  const parseDate = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
      ? date
      : null;
  };

  const start = parseDate(periodStart);
  const end = parseDate(periodEnd);
  if (!start || !end || start > end) {
    throw new RangeError('Choose a valid payroll period with an end date on or after the start date.');
  }
  return { start, end };
}
