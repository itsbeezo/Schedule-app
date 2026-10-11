// Pure date helpers for the phone date strip. All local time, weeks start on Sunday (FullCalendar's default).

export const DAY_MS = 86400000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The 7 days (Sun..Sat) of the week containing `d`. */
export function weekDays(d: Date): Date[] {
  const start = addDays(d, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Weeks (rows of 7 days) covering the month containing `d`, padded with neighbouring-month days. */
export function monthGrid(d: Date): Date[][] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const rows: Date[][] = [];
  for (let cur = addDays(first, -first.getDay()); cur <= last; cur = addDays(cur, 7)) rows.push(weekDays(cur));
  return rows;
}

/** First day of the month `delta` months from `d`'s month. */
export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export const monthTitle = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const fullDateLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export const weekdayShort = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
