import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxon3Plugin from '@fullcalendar/luxon3';
import type { CalendarOptions } from '@fullcalendar/core';
import { ApiEvent, EventInput } from '../api/types';
import * as api from '../api/client';
import { getDefaultEventColor, getScrollTime } from '../lib/preferences';
import EventDialog, { EventDraft } from './EventDialog';
import SelectionToolbar from './SelectionToolbar';
import { useToast } from './Toast';
import { persistEventChange } from '../lib/eventChange';

import { useSwipe } from '../hooks/useSwipe';
import MobileDateStrip from './MobileDateStrip';
import { useCalendarData } from '../hooks/useCalendarData';
import ConflictBadge from './ConflictBadge';
import ConflictPopover from './ConflictPopover';
import type { AnchorRect } from './popoverPosition';
import SettingsPanel from './SettingsPanel';
import { ConflictInfo, eventConflictState, indexConflicts } from '../lib/conflictIndex';
import { workHoursToBackground } from '../lib/workHoursBand';
import { zonesToBackground } from '../lib/zoneBand';
import { readableTextOn } from '../styles/contrast';
import { civilLocalDate, civilOf, dstNoteFor, dateOnlyString, formatTimeIn, nextHourIn, todayIn, zonedTimeToDate } from '../lib/timezone';

/** Month view shows at most this many events per day, then a "+N more" link that opens FullCalendar's popover. */
export const MONTH_MAX_EVENTS = 3;

/** Accessible name for the "+N more" link, e.g. "2 more events on Tuesday, October 6, 2026". */
export function moreLinkLabel(num: number, dateStr: string | null | undefined): string {
  const base = `${num} more event${num === 1 ? '' : 's'}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? '');
  if (!m) return base;
  const day = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${base} on ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
}

export const CALENDAR_OPTIONS: CalendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, luxon3Plugin],
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
  views: { dayGridMonth: { dayMaxEvents: MONTH_MAX_EVENTS } },
  moreLinkContent: (arg) => `+${arg.num} more`,
  moreLinkHint: (num) => moreLinkLabel(num, null),
  moreLinkDidMount: (arg) => {
    // FullCalendar only knows the count; add the day from the enclosing cell so the name says which day.
    const date = arg.el.closest('[data-date]')?.getAttribute('data-date');
    arg.el.setAttribute('aria-label', moreLinkLabel(arg.num, date));
  },
};

export const NARROW_QUERY = '(max-width: 600px)';
const WIDE_TOOLBAR_RIGHT = 'timeGridDay,timeGridWeek,dayGridMonth';
/** Phone: one day at a time; the MobileDateStrip replaces FullCalendar's toolbar. */
export const NARROW_INITIAL_VIEW = 'timeGridDay';
export const NARROW_HEIGHT = 'max(420px, calc(100vh - 15rem))';
/** Elements FullCalendar adds while the user is dragging, resizing or selecting; swipes must not fire then. */
const GESTURE_BUSY_SELECTOR = '.fc-event-dragging, .fc-event-resizing, .fc-event-mirror, .fc-highlight';

export function isNarrowViewport(
  mm: ((q: string) => { matches: boolean }) | undefined = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined
): boolean {
  try {
    return !!mm?.(NARROW_QUERY).matches;
  } catch {
    return false;
  }
}


const SHORT_EVENT_MS = 30 * 60 * 1000;
const TIME_FMT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** "Title, 9:00 AM\u201310:30 AM": the full text for event blocks too narrow to show it. */
export function describeEvent(title: string, start: Date | null, end: Date | null, timeZone?: string): string {
  if (!start) return title;
  const fmt = (d: Date) => (timeZone ? formatTimeIn(d, timeZone) : d.toLocaleTimeString([], TIME_FMT));
  const from = fmt(start);
  return end ? `${title}, ${from}\u2013${fmt(end)}` : `${title}, ${from}`;
}

/**
 * The instant range of a calendar selection. Timed selections: arg.start/end are already true
 * instants (the named-zone plugin subtracts the zone offset). All-day selections (month view):
 * the Dates are not usable and startStr/endStr are date-only ("2026-10-06", which would parse as UTC
 * midnight), so use the saved zone's local midnight of the start date and of the exclusive end date.
 */
export function selectionRange(
  arg: { start: Date; end: Date; startStr?: string; endStr?: string; allDay?: boolean },
  tz: string
): { start: Date; end: Date } {
  if (arg.allDay) {
    const civil = (str: string | undefined) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str ?? '');
      return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
    };
    const s = civil(arg.startStr);
    const e = civil(arg.endStr);
    if (s && e) return { start: zonedTimeToDate(s, 0, 0, tz), end: zonedTimeToDate(e, 0, 0, tz) };
  }
  return { start: arg.start, end: arg.end };
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
  const calendarRef = useRef<FullCalendar>(null);
  const [narrow, setNarrow] = useState(() => isNarrowViewport());
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  const lastWideView = useRef('timeGridWeek');
  const firstNarrowRun = useRef(true);
  // Follow the media query live (window resize, devtools device toggle, rotating a phone).
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia?.(NARROW_QUERY) : undefined;
    if (!mq) return;
    const onChange = (e: { matches: boolean }) => setNarrow(e.matches);
    setNarrow(!!mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener?.(onChange);
    return () => mq.removeListener?.(onChange);
  }, []);
  // When the layout flips, switch FullCalendar's view in place (no remount), keeping the current date.
  useEffect(() => {
    if (firstNarrowRun.current) {
      firstNarrowRun.current = false;
      return;
    }
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(narrow ? NARROW_INITIAL_VIEW : lastWideView.current, api.getDate());
  }, [narrow]);
  const { showError } = useToast();
  // Stable identity: a fresh object each render would make FullCalendar re-apply the option on every state change.
  const headerToolbar = useMemo(
    () => (narrow ? false : { ...(CALENDAR_OPTIONS.headerToolbar as object), right: WIDE_TOOLBAR_RIGHT }),
    [narrow]
  );
  const [currentDate, setCurrentDate] = useState(() => todayIn(data.timezone));
  const gridRef = useRef<HTMLDivElement>(null);
  const calApi = () => calendarRef.current?.getApi();
  useSwipe(gridRef, {
    enabled: narrow,
    onSwipe: (dir) => (dir === 'next' ? calApi()?.next() : calApi()?.prev()),
    ignoreStart: (t) => !!(t as Element | null)?.closest?.('.fc-event:not(.fc-bg-event)'),
    isBusy: () => !!gridRef.current?.querySelector(GESTURE_BUSY_SELECTOR),
  });
  const [showSettings, setShowSettings] = useState(false);
  const [scrollTime, setScrollTimeState] = useState(() => getScrollTime());
  const [draft, setDraft] = useState<{ mode: 'create' | 'edit'; value: EventDraft } | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date } | null>(null);

  const [popover, setPopover] = useState<{ anchor: AnchorRect; eventId: string; info: ConflictInfo } | null>(null);
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
      // Bands and the grid both use the saved time zone (FullCalendar's timeZone prop below).
      ...(data.range ? workHoursToBackground(data.workHours, data.range.from, data.range.to, data.timezone) : []),
      ...(data.range ? zonesToBackground(data.zones, data.range.from, data.range.to, data.timezone) : []),
    ],
    [data.events, data.workHours, data.zones, data.range, data.timezone, conflictIndex]
  );

  async function markZone(repeatsWeekly: boolean) {
    if (!selection) return;
    try {
      await api.createZone({
        start_at: selection.start.toISOString(),
        end_at: selection.end.toISOString(),
        repeats_weekly: repeatsWeekly,
      });
      setSelection(null);
      await data.reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not create the zone.');
    }
  }

  function newDraft(start: Date, end: Date): EventDraft {
    return { title: '', start, end, kind: 'event', color: getDefaultEventColor(), notes: null };
  }

  function openNewEvent() {
    const start = nextHourIn(data.timezone);
    setDraft({ mode: 'create', value: newDraft(start, new Date(start.getTime() + 30 * 60 * 1000)) });
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
        <button className="btn" type="button" onClick={() => setShowSettings(true)}>
          Settings
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
      {narrow && (
        <MobileDateStrip selected={currentDate} today={todayIn(data.timezone)} onSelect={(d) => calApi()?.gotoDate(dateOnlyString(d))} onToday={() => calApi()?.today()} />
      )}
      <div ref={gridRef} className={narrow ? 'calendar-grid calendar-grid--day' : 'calendar-grid'}>
      <FullCalendar
        ref={calendarRef}
        {...CALENDAR_OPTIONS}
        timeZone={data.timezone}
        {...(narrow ? { height: NARROW_HEIGHT } : {})}
        initialView={narrow ? NARROW_INITIAL_VIEW : 'timeGridWeek'}
        headerToolbar={headerToolbar}
        scrollTime={scrollTime}
        dayHeaderContent={(arg) => {
          if (arg.view?.type === 'dayGridMonth' || !arg.date) return arg.text;
          const note = dstNoteFor(civilOf(arg.date, data.timezone), data.timezone);
          if (!note) return arg.text;
          return (
            <>
              {arg.text}
              <span className="cal-dst-note" title={note.explanation} aria-label={note.explanation}>{note.text}</span>
            </>
          );
        }}
        events={calendarEvents}
        datesSet={(arg) => {
          if (!narrowRef.current && arg.view?.type) lastWideView.current = arg.view.type;
          data.setRange({ from: arg.start, to: arg.end });
          setCurrentDate(civilLocalDate(arg.view?.currentStart ?? arg.start, data.timezone));
        }}
        select={(arg) => setSelection(selectionRange(arg, data.timezone))}
        eventDrop={(info) => void persistEventChange(info, api.updateEvent, () => void data.reload(), showError)}
        eventResize={(info) => void persistEventChange(info, api.updateEvent, () => void data.reload(), showError)}
        eventDidMount={(arg) => {
          if (arg.event.display === 'background' || !arg.event.title) return;
          arg.el.title = describeEvent(arg.event.title, arg.event.start, arg.event.end, data.timezone);
        }}
        eventContent={(arg) => {
          const infos = conflictIndex.get(arg.event.id);
          const state = eventConflictState(infos);
          const info = infos?.find((i) => i.state === state);
          const { start, end } = arg.event;
          // In short blocks the badge leads the row so a later overlapping event cannot cover it.
          const isShort = !!start && !!end && end.getTime() - start.getTime() <= SHORT_EVENT_MS;
          const badge =
            state && info ? (
              <ConflictBadge
                state={state}
                mode={info.mode}
                otherTitle={titleOf(info.otherId)}
                onOpen={(rect) => setPopover({ anchor: { left: rect.left, top: rect.top, bottom: rect.bottom }, eventId: arg.event.id, info })}
              />
            ) : null;
          // Refreshed on every content render, so the tooltip follows a changed saved time zone.
          const syncTooltip = (node: HTMLDivElement | null) => {
            const host = node?.closest<HTMLElement>('.fc-event');
            if (host && arg.event.title) host.title = describeEvent(arg.event.title, start, end, data.timezone);
          };
          return (
            <div ref={syncTooltip}>
              {isShort && badge}
              {arg.timeText && <div className="fc-event-time">{arg.timeText}</div>}
              <div className="fc-event-title">{arg.event.title}</div>
              {!isShort && badge}
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
      </div>
      {selection && (
        <SelectionToolbar
          range={selection}
          onAddEvent={() => {
            setDraft({ mode: 'create', value: newDraft(selection.start, selection.end) });
            setSelection(null);
          }}
          onMarkZone={(weekly) => void markZone(weekly)}
          onCancel={() => setSelection(null)}
        />
      )}
      {popover && (
        <ConflictPopover
          anchor={popover.anchor}
          otherTitle={titleOf(popover.info.otherId)}
          state={popover.info.state}
          mode={popover.info.mode}
          onIgnoreOnce={() => void chooseIgnore(popover.info, 'once')}
          onAllow={() => void chooseIgnore(popover.info, 'allow')}
          onRestore={() => void restore(popover.info)}
          onClose={() => setPopover(null)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onChanged={() => void data.reload()}
          onScrollTimeChange={(t) => {
            setScrollTimeState(t);
            calendarRef.current?.getApi().scrollToTime(t);
          }}
        />
      )}
      {draft && (
        <EventDialog
          timeZone={data.timezone}
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
