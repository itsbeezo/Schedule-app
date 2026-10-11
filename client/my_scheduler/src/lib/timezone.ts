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

const FALLBACK_ZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage',
  'Pacific/Honolulu', 'America/Toronto', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

export function supportedTimeZones(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  try {
    const list = fn ? fn('timeZone') : [];
    if (list.length > 0) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    /* fall through */
  }
  return FALLBACK_ZONES;
}

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
