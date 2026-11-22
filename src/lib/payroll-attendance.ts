export function getPayrollWorkDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  if (!year || !month || !day) {
    throw new RangeError('Could not determine the payroll work date.');
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function calculateAttendanceHours(
  timeIn: Date,
  timeOut: Date,
  standardHours: number,
  unpaidBreakHours: number
) {
  const elapsedMilliseconds = timeOut.getTime() - timeIn.getTime();
  if (
    !Number.isFinite(elapsedMilliseconds) ||
    elapsedMilliseconds < 0 ||
    !Number.isFinite(standardHours) ||
    standardHours <= 0 ||
    !Number.isFinite(unpaidBreakHours) ||
    unpaidBreakHours < 0 ||
    unpaidBreakHours > 4
  ) {
    throw new RangeError('Attendance times or standard hours are invalid.');
  }

  const elapsedHours = elapsedMilliseconds / 3_600_000;
  if (elapsedHours > 24) {
    throw new RangeError('Attendance duration exceeds 24 hours. Review the open shift before clocking out.');
  }

  const breakHours = elapsedHours >= standardHours + unpaidBreakHours ? unpaidBreakHours : 0;
  const totalHours = Math.max(0, elapsedHours - breakHours);
  return {
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(Math.max(0, totalHours - standardHours) * 100) / 100,
    breakHours,
  };
}
