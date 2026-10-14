/**
 * Time zone helpers built on Intl.
 *
 * The saved time zone drives the whole calendar: FullCalendar runs with `timeZone` set to it (luxon3 plugin),
 * the dialogs show wall-clock times in it, and the work-hour / zone bands are computed in it. Always convert
 * instants with these helpers (or from ISO strings carrying an offset), never with local Date getters.
 */

export interface CivilDate {
  y: number;
  m: number; // 0-based month
  d: number;
}

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface TimeZoneOption {
  value: string;
  label: string;
}

/** Short curated list for the settings select: one entry per commonly used zone. */
export const TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Arizona Time (Phoenix)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Halifax', label: 'Atlantic Time (Halifax)' },
  { value: 'America/St_Johns', label: 'Newfoundland Time (St. John\'s)' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Sao_Paulo', label: 'Brasilia Time (Sao Paulo)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'Europe/London', label: 'United Kingdom (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Europe/Athens', label: 'Eastern European Time (Athens)' },
  { value: 'Europe/Moscow', label: 'Moscow Time' },
  { value: 'Africa/Cairo', label: 'Egypt (Cairo)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)' },
  { value: 'Africa/Nairobi', label: 'East Africa (Nairobi)' },
  { value: 'Asia/Dubai', label: 'Gulf Time (Dubai)' },
  { value: 'Asia/Karachi', label: 'Pakistan (Karachi)' },
  { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (Dhaka)' },
  { value: 'Asia/Bangkok', label: 'Indochina Time (Bangkok)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Shanghai', label: 'China (Shanghai)' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
  { value: 'Australia/Sydney', label: 'Eastern Australia (Sydney)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
];

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant in `tz`. */
export function zonedParts(date: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month - 1, d: p.day, h: p.hour % 24, min: p.minute, s: p.second };
}

function offsetMs(ms: number, tz: string): number {
  const t = Math.floor(ms / 1000) * 1000;
  const p = zonedParts(new Date(t), tz);
  return Date.UTC(p.y, p.m, p.d, p.h, p.min, p.s) - t;
}

/** The instant at which the wall clock in `tz` reads the given date and time. */
export function zonedTimeToDate(c: CivilDate, hour: number, minute: number, tz: string): Date {
  const wall = Date.UTC(c.y, c.m, c.d, hour, minute);
  let t = wall - offsetMs(wall, tz);
  t = wall - offsetMs(t, tz);
  return new Date(t);
}

export const civilOf = (date: Date, tz: string): CivilDate => {
  const { y, m, d } = zonedParts(date, tz);
  return { y, m, d };
};

export const addCivilDays = (c: CivilDate, n: number): CivilDate => {
  const u = new Date(Date.UTC(c.y, c.m, c.d + n));
  return { y: u.getUTCFullYear(), m: u.getUTCMonth(), d: u.getUTCDate() };
};

export const civilWeekday = (c: CivilDate): number => new Date(Date.UTC(c.y, c.m, c.d)).getUTCDay();
export const civilDayNumber = (c: CivilDate): number => Date.UTC(c.y, c.m, c.d) / 86400000;

const p2 = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DDTHH:mm": the wall clock of an instant in `tz`, for datetime-local inputs. */
export function toZonedInput(date: Date, tz: string): string {
  const { y, m, d, h, min } = zonedParts(date, tz);
  return `${String(y).padStart(4, '0')}-${p2(m + 1)}-${p2(d)}T${p2(h)}:${p2(min)}`;
}

/** The instant for a datetime-local value read as wall-clock in `tz`; null if it does not parse. */
export function fromZonedInput(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return zonedTimeToDate({ y: +m[1], m: +m[2] - 1, d: +m[3] }, +m[4], +m[5], tz);
}

/** "9:00 AM" for an instant, in `tz`. */
export const formatTimeIn = (date: Date, tz: string): string =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });

/** Today's date in `tz` as a local-midnight Date (a plain calendar date for the date strip). */
export function todayIn(tz: string, now: Date = new Date()): Date {
  const c = civilOf(now, tz);
  return new Date(c.y, c.m, c.d);
}

/** A local-midnight Date carrying the calendar date that `date` has in `tz`. */
export const civilLocalDate = (date: Date, tz: string): Date => todayIn(tz, date);

/** "YYYY-MM-DD" of a local-midnight calendar Date; FullCalendar reads date strings in its own time zone. */
export const dateOnlyString = (d: Date): string => `${String(d.getFullYear()).padStart(4, '0')}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** The next top-of-hour after `now`, as seen in `tz`. */
export function nextHourIn(tz: string, now: Date = new Date()): Date {
  const p = zonedParts(now, tz);
  return zonedTimeToDate({ y: p.y, m: p.m, d: p.d }, p.h + 1, 0, tz);
}

/** Length in hours of the civil day in `tz` (24 except on the two daylight-saving change days). */
export function dayLengthHours(c: CivilDate, tz: string): number {
  const start = zonedTimeToDate(c, 0, 0, tz).getTime();
  const end = zonedTimeToDate(addCivilDays(c, 1), 0, 0, tz).getTime();
  return (end - start) / 3600000;
}

export interface DstNote {
  text: string;
  explanation: string;
}

/** A short note for the day the clocks change by one hour in `tz`; null on every other day. */
export function dstNoteFor(c: CivilDate, tz: string): DstNote | null {
  const hours = dayLengthHours(c, tz);
  if (hours === 23) {
    return { text: 'Clocks forward 1h', explanation: 'Clocks go forward 1 hour on this day (daylight saving time starts)' };
  }
  if (hours === 25) {
    return { text: 'Clocks back 1h', explanation: 'Clocks go back 1 hour on this day (daylight saving time ends)' };
  }
  return null;
}
