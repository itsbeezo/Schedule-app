import { ConflictZone } from '../api/types';
import { BackgroundEvent } from './workHoursBand';
import {
  addCivilDays, browserTimeZone, civilDayNumber, civilOf, civilWeekday, zonedParts, zonedTimeToDate,
} from './timezone';

const LABEL = 'Conflicts off';

/** Weekly zones repeat on the same weekday and wall-clock times in `timeZone` (default the browser's). */
export function zonesToBackground(
  zones: ConflictZone[], rangeStart: Date, rangeEnd: Date, timeZone: string = browserTimeZone()
): BackgroundEvent[] {
  const out: BackgroundEvent[] = [];
  for (const z of zones) {
    const start = new Date(z.start_at);
    const end = new Date(z.end_at);
    if (!z.repeats_weekly) {
      if (start < rangeEnd && end > rangeStart) {
        out.push({ id: `zone-${z.id}`, title: LABEL, start, end, display: 'background', classNames: ['cal-zone'] });
      }
      continue;
    }
    const startDay = civilOf(start, timeZone);
    const endDay = civilOf(end, timeZone);
    const sp = zonedParts(start, timeZone);
    const elapsedMs = end.getTime() - start.getTime();
    const dayOffset = civilDayNumber(endDay) - civilDayNumber(startDay);
    let day = addCivilDays(civilOf(rangeStart, timeZone), -dayOffset);
    while (zonedTimeToDate(day, 0, 0, timeZone) < rangeEnd) {
      if (civilWeekday(day) === civilWeekday(startDay) && civilDayNumber(day) >= civilDayNumber(startDay)) {
        const bandStart = zonedTimeToDate(day, sp.h, sp.min, timeZone);
        const bandEnd = new Date(bandStart.getTime() + elapsedMs);
        if (bandStart < rangeEnd && bandEnd > rangeStart) {
          out.push({
            id: `zone-${z.id}-${day.y}-${day.m}-${day.d}`,
            title: LABEL, start: bandStart, end: bandEnd, display: 'background', classNames: ['cal-zone'],
          });
        }
      }
      day = addCivilDays(day, 1);
    }
  }
  return out;
}
