import React, { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarOptions } from '@fullcalendar/core';
import { ApiEvent, EventInput } from '../api/types';
import * as api from '../api/client';
import { getDefaultEventColor, getScrollTime } from '../lib/preferences';
import EventDialog, { EventDraft } from './EventDialog';
import SelectionToolbar from './SelectionToolbar';
import { useToast } from './Toast';
import { persistEventChange } from '../lib/eventChange';

import { useCalendarData } from '../hooks/useCalendarData';
import ConflictBadge from './ConflictBadge';
import ConflictPopover from './ConflictPopover';
import { ConflictInfo, eventConflictState, indexConflicts } from '../lib/conflictIndex';
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
  eventInteractive: true,
  selectable: true,
  selectMirror: true,
  longPressDelay: 400,
  eventLongPressDelay: 400,
  selectLongPressDelay: 400,
  height: 'max(480px, calc(100vh - 12rem))',
  views: { timeGrid3Day: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 day' } },
};

export const NARROW_QUERY = '(max-width: 600px)';
const WIDE_TOOLBAR_RIGHT = 'timeGridDay,timeGridWeek,dayGridMonth';
const NARROW_TOOLBAR_RIGHT = 'timeGridDay,timeGrid3Day,timeGridWeek,dayGridMonth';

export function isNarrowViewport(
  mm: ((q: string) => { matches: boolean }) | undefined = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined
): boolean {
  try {
    return !!mm?.(NARROW_QUERY).matches;
  } catch {
    return false;
  }
}


const TIME_FMT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** "Title, 9:00 AM\u201310:30 AM": the full text for event blocks too narrow to show it. */
export function describeEvent(title: string, start: Date | null, end: Date | null): string {
  if (!start) return title;
  const from = start.toLocaleTimeString([], TIME_FMT);
  return end ? `${title}, ${from}\u2013${end.toLocaleTimeString([], TIME_FMT)}` : `${title}, ${from}`;
}

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
  const [narrow] = useState(() => isNarrowViewport());
  const { showError } = useToast();
  const [draft, setDraft] = useState<{ mode: 'create' | 'edit'; value: EventDraft } | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date } | null>(null);

  const [popover, setPopover] = useState<{ x: number; y: number; eventId: string; info: ConflictInfo } | null>(null);
  const conflictIndex = useMemo(() => indexConflicts(data.conflicts), [data.conflicts]);
  const titleOf = (id: string) => data.events.find((e) => e.id === id)?.title ?? 'another event';

  async function chooseIgnore(info: ConflictInfo, mode: 'once' | 'allow') {
    try {
      await api.createIgnore({ eventAId: info.eventAId, eventBId: info.eventBId, mode });
      setPopover(null);
      await data.reload();
    } catch (err) {
      setPopover(null);
      showError(err instanceof Error ? err.message : 'Could not save that choice.');
    }
  }

  async function restore(info: ConflictInfo) {
    try {
      if (info.ignoreId) await api.deleteIgnore(info.ignoreId);
      setPopover(null);
      await data.reload();
    } catch (err) {
      setPopover(null);
      showError(err instanceof Error ? err.message : 'Could not restore that conflict.');
    }
  }

  const calendarEvents = useMemo(
    () => [
      ...data.events.map((e) => {
        const fc = toFullCalendarEvent(e);
        const state = eventConflictState(conflictIndex.get(e.id));
        const extra = state === 'active' ? ['cal-event--conflict'] : state === 'ignored' ? ['cal-event--ignored'] : [];
        return { ...fc, classNames: [...fc.classNames, ...extra] };
      }),
      ...(data.range ? workHoursToBackground(data.workHours, data.range.from, data.range.to) : []),
    ],
    [data.events, data.workHours, data.range, conflictIndex]
  );

  function newDraft(start: Date, end: Date): EventDraft {
    return { title: '', start, end, kind: 'event', color: getDefaultEventColor(), notes: null };
  }

  function openNewEvent() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    setDraft({ mode: 'create', value: newDraft(start, new Date(start.getTime() + 3600000)) });
  }

  async function save(input: EventInput, id?: string) {
    if (id) await api.updateEvent(id, input);
    else await api.createEvent(input);
    setDraft(null);
    await data.reload();
  }

  async function remove(id: string) {
    try {
      await api.deleteEvent(id);
      setDraft(null);
      await data.reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not delete the event.');
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Schedule</h1>
        <button className="btn btn--primary" type="button" onClick={openNewEvent}>
          Add event
        </button>
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
        initialView={narrow ? 'timeGrid3Day' : 'timeGridWeek'}
        headerToolbar={{ ...(CALENDAR_OPTIONS.headerToolbar as object), right: narrow ? NARROW_TOOLBAR_RIGHT : WIDE_TOOLBAR_RIGHT }}
        scrollTime={getScrollTime()}
        events={calendarEvents}
        datesSet={(arg) => data.setRange({ from: arg.start, to: arg.end })}
        select={(arg) => setSelection({ start: arg.start, end: arg.end })}
        eventDrop={(info) => void persistEventChange(info, api.updateEvent, () => void data.reload(), showError)}
        eventResize={(info) => void persistEventChange(info, api.updateEvent, () => void data.reload(), showError)}
        eventDidMount={(arg) => {
          arg.el.title = describeEvent(arg.event.title, arg.event.start, arg.event.end);
        }}
        eventContent={(arg) => {
          const infos = conflictIndex.get(arg.event.id);
          const state = eventConflictState(infos);
          const info = infos?.find((i) => i.state === state);
          return (
            <div>
              {arg.timeText && <div className="fc-event-time">{arg.timeText}</div>}
              <div className="fc-event-title">{arg.event.title}</div>
              {state && info && (
                <ConflictBadge
                  state={state}
                  mode={info.mode}
                  otherTitle={titleOf(info.otherId)}
                  onOpen={(rect) => setPopover({ x: rect.left, y: rect.bottom, eventId: arg.event.id, info })}
                />
              )}
            </div>
          );
        }}
        eventClick={(arg) => {
          const target = arg.jsEvent?.target as HTMLElement | null | undefined;
          if (target?.closest?.('.conflict-badge')) return;
          const e = data.events.find((x) => x.id === arg.event.id);
          if (!e) return;
          setDraft({
            mode: 'edit',
            value: { id: e.id, title: e.title, start: new Date(e.start_at), end: new Date(e.end_at), kind: e.kind, color: e.color, notes: e.notes },
          });
        }}
      />
      {selection && (
        <SelectionToolbar
          range={selection}
          onAddEvent={() => {
            setDraft({ mode: 'create', value: newDraft(selection.start, selection.end) });
            setSelection(null);
          }}
          onCancel={() => setSelection(null)}
        />
      )}
      {popover && (
        <ConflictPopover
          x={popover.x}
          y={popover.y}
          otherTitle={titleOf(popover.info.otherId)}
          state={popover.info.state}
          mode={popover.info.mode}
          onIgnoreOnce={() => void chooseIgnore(popover.info, 'once')}
          onAllow={() => void chooseIgnore(popover.info, 'allow')}
          onRestore={() => void restore(popover.info)}
          onClose={() => setPopover(null)}
        />
      )}
      {draft && (
        <EventDialog
          mode={draft.mode}
          initial={draft.value}
          onSave={save}
          onDelete={remove}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
