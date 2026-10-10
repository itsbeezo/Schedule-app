import { ConflictZone } from '../api/types';
import { BackgroundEvent } from './workHoursBand';

const LABEL = 'Conflicts off';

export function zonesToBackground(zones: ConflictZone[], rangeStart: Date, rangeEnd: Date): BackgroundEvent[] {
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
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayOffset = Math.round(
      (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - startDay.getTime()) / 86400000
    );
    const day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() - dayOffset);
    while (day < rangeEnd) {
      if (day.getDay() === start.getDay() && day >= startDay) {
        const bandStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes());
        const bandEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset, end.getHours(), end.getMinutes());
        if (bandStart < rangeEnd && bandEnd > rangeStart) {
          out.push({
            id: `zone-${z.id}-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
            title: LABEL, start: bandStart, end: bandEnd, display: 'background', classNames: ['cal-zone'],
          });
        }
      }
      day.setDate(day.getDate() + 1);
    }
  }
  return out;
}
