import { WorkHour } from '../api/types';
import { addCivilDays, browserTimeZone, civilOf, civilWeekday, zonedTimeToDate } from './timezone';

export interface BackgroundEvent {
  id: string;
  title?: string;
  start: Date;
  end: Date;
  display: 'background';
  classNames: string[];
}

/**
 * One background band per matching weekday (in `timeZone`, default the browser's) between rangeStart
 * (inclusive) and rangeEnd (exclusive).
 */
export function workHoursToBackground(
  workHours: WorkHour[], rangeStart: Date, rangeEnd: Date, timeZone: string = browserTimeZone()
): BackgroundEvent[] {
  const out: BackgroundEvent[] = [];
  let day = civilOf(rangeStart, timeZone);
  while (zonedTimeToDate(day, 0, 0, timeZone) < rangeEnd) {
    for (const w of workHours) {
      if (w.weekday !== civilWeekday(day)) continue;
      const [sh, sm] = w.start_time.split(':').map(Number);
      const [eh, em] = w.end_time.split(':').map(Number);
      out.push({
        id: `work-hours-${day.y}-${day.m}-${day.d}-${w.start_time}`,
        start: zonedTimeToDate(day, sh, sm, timeZone),
        end: zonedTimeToDate(day, eh, em, timeZone),
        display: 'background',
        classNames: ['cal-work-hours'],
      });
    }
    day = addCivilDays(day, 1);
  }
  return out;
}
