/**
 * Time zone helpers built on Intl (no extra dependencies).
 *
 * NOTE: only the weekly work-hours bands and weekly conflict-zone bands use the saved time zone.
 * The FullCalendar event grid itself still renders in the browser's time zone until a FullCalendar
 * time zone plugin is chosen.
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
