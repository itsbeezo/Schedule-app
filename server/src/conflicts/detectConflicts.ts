import { DateTime } from 'luxon';

export interface EventLike {
  id: string;
  start_at: Date;
  end_at: Date;
}

export interface ZoneLike {
  start_at: Date;
  end_at: Date;
  repeats_weekly: boolean;
}

export interface IgnoreLike {
  id: string;
  event_a_id: string;
  event_b_id: string;
  mode: 'once' | 'allow';
  overlap_start: Date | null;
  overlap_end: Date | null;
}

export interface Conflict {
  eventAId: string;
  eventBId: string;
  overlapStart: Date;
  overlapEnd: Date;
}

export interface IgnoredConflict extends Conflict {
  mode: 'once' | 'allow';
  ignoreId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function insideZone(zone: ZoneLike, overlapStart: Date, overlapEnd: Date, timezone: string): boolean {
  const os = overlapStart.getTime();
  const oe = overlapEnd.getTime();
  if (!zone.repeats_weekly) {
    return zone.start_at.getTime() <= os && zone.end_at.getTime() >= oe;
  }
  const zoneStart = DateTime.fromJSDate(zone.start_at, { zone: timezone });
  const durationMs = zone.end_at.getTime() - zone.start_at.getTime();
  const overlapDay = DateTime.fromJSDate(overlapStart, { zone: timezone }).startOf('day');
  const daysBack = Math.ceil(durationMs / DAY_MS);
  for (let offset = -daysBack; offset <= 0; offset++) {
    const day = overlapDay.plus({ days: offset });
    if (day.weekday !== zoneStart.weekday) continue;
    const occurrenceStart = day.set({
      hour: zoneStart.hour,
      minute: zoneStart.minute,
      second: zoneStart.second,
      millisecond: zoneStart.millisecond,
    });
    if (occurrenceStart.toMillis() < zone.start_at.getTime()) continue;
    const occurrenceEnd = occurrenceStart.toMillis() + durationMs;
    if (occurrenceStart.toMillis() <= os && occurrenceEnd >= oe) return true;
  }
  return false;
}

function byOverlap(a: Conflict, b: Conflict): number {
  return (
    a.overlapStart.getTime() - b.overlapStart.getTime() ||
    (a.eventAId < b.eventAId ? -1 : a.eventAId > b.eventAId ? 1 : 0) ||
    (a.eventBId < b.eventBId ? -1 : a.eventBId > b.eventBId ? 1 : 0)
  );
}

export function detectConflicts(
  events: EventLike[],
  zones: ZoneLike[],
  ignores: IgnoreLike[],
  timezone: string
): { active: Conflict[]; ignored: IgnoredConflict[] } {
  const sorted = [...events].sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
  const ignoreByPair = new Map<string, IgnoreLike>();
  for (const ig of ignores) ignoreByPair.set(`${ig.event_a_id}|${ig.event_b_id}`, ig);

  const active: Conflict[] = [];
  const ignored: IgnoredConflict[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.start_at.getTime() >= a.end_at.getTime()) break; // sorted by start: nothing later can overlap a
      const overlapStart = b.start_at;
      const overlapEnd = new Date(Math.min(a.end_at.getTime(), b.end_at.getTime()));
      const [first, second] = a.id < b.id ? [a, b] : [b, a];
      const conflict: Conflict = { eventAId: first.id, eventBId: second.id, overlapStart, overlapEnd };

      if (zones.some((z) => insideZone(z, overlapStart, overlapEnd, timezone))) continue;

      const ig = ignoreByPair.get(`${first.id}|${second.id}`);
      if (ig) {
        const stillSame =
          ig.mode === 'allow' ||
          (ig.overlap_start?.getTime() === overlapStart.getTime() &&
            ig.overlap_end?.getTime() === overlapEnd.getTime());
        if (stillSame) {
          ignored.push({ ...conflict, mode: ig.mode, ignoreId: ig.id });
          continue;
        }
      }
      active.push(conflict);
    }
  }
  active.sort(byOverlap);
  ignored.sort(byOverlap);
  return { active, ignored };
}
