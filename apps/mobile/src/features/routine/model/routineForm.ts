export function parseExcludedDates(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(isValidDateOnly),
    ),
  ];
}

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function clampRoutineBufferMinutes(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Math.max(0, Math.min(120, Number.isFinite(numeric) ? numeric : 0));
}
