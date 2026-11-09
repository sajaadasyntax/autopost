const OFFSET_MS = 2 * 60 * 60 * 1000;

export type KhartoumDate = { year: number; month: number; day: number };

export function khartoumDate(instant = new Date()): KhartoumDate {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function khartoumInstant(date: KhartoumDate, hour: number): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hour - 2, 0, 0));
}

export function addDays(date: KhartoumDate, days: number): KhartoumDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function weekdayIndex(date: KhartoumDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function nextMonday(instant = new Date()): KhartoumDate {
  const today = khartoumDate(instant);
  const index = weekdayIndex(today);
  const delta = index === 1 ? 0 : (8 - index) % 7;
  return addDays(today, delta);
}

export function formatDate(date: KhartoumDate): string {
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

export function parseDate(value: string): KhartoumDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayName(date: KhartoumDate): string {
  return WEEKDAYS[weekdayIndex(date)];
}
