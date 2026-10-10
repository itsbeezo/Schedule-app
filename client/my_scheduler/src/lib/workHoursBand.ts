import { WorkHour } from '../api/types';

export interface BackgroundEvent {
  id: string;
  start: Date;
  end: Date;
  display: 'background';
  classNames: string[];
}

/** One background band per matching local weekday between rangeStart (inclusive) and rangeEnd (exclusive). */
export function workHoursToBackground(workHours: WorkHour[], rangeStart: Date, rangeEnd: Date): BackgroundEvent[] {
  const out: BackgroundEvent[] = [];
  const day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  while (day < rangeEnd) {
    for (const w of workHours) {
      if (w.weekday !== day.getDay()) continue;
      const [sh, sm] = w.start_time.split(':').map(Number);
      const [eh, em] = w.end_time.split(':').map(Number);
      out.push({
        id: `work-hours-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${w.start_time}`,
        start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm),
        end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em),
        display: 'background',
        classNames: ['cal-work-hours'],
      });
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}
