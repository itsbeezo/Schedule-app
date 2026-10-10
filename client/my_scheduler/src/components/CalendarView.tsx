import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarOptions } from '@fullcalendar/core';
import { ApiEvent } from '../api/types';
import { useCalendarData } from '../hooks/useCalendarData';
import { workHoursToBackground } from '../lib/workHoursBand';
import { readableTextOn } from '../styles/contrast';

export const CALENDAR_OPTIONS: CalendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' },
  allDaySlot: false,
  slotDuration: '00:30:00',
  snapDuration: '00:15:00',
  nowIndicator: true,
  editable: true,
  selectable: true,
  selectMirror: true,
  longPressDelay: 400,
  eventLongPressDelay: 400,
  selectLongPressDelay: 400,
  height: 'auto',
};

export function toFullCalendarEvent(e: ApiEvent) {
  return {
    id: e.id,
    title: e.title,
    start: e.start_at,
    end: e.end_at,
    ...(e.color ? { backgroundColor: e.color, textColor: readableTextOn(e.color) } : {}),
    classNames: ['cal-event', ...(e.kind === 'time_block' ? ['cal-event--time-block'] : [])],
    extendedProps: { kind: e.kind, notes: e.notes, color: e.color },
  };
}

export default function CalendarView() {
  const data = useCalendarData();

  const calendarEvents = useMemo(
    () => [
      ...data.events.map(toFullCalendarEvent),
      ...(data.range ? workHoursToBackground(data.workHours, data.range.from, data.range.to) : []),
    ],
    [data.events, data.workHours, data.range]
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Schedule</h1>
      </header>
      {data.loadError && (
        <div className="load-error" role="alert">
          <span>{data.loadError}</span>
          <button className="btn" type="button" onClick={() => void data.reload()}>
            Retry
          </button>
        </div>
      )}
      <FullCalendar
        {...CALENDAR_OPTIONS}
        events={calendarEvents}
        datesSet={(arg) => data.setRange({ from: arg.start, to: arg.end })}
      />
    </div>
  );
}
