import React, { forwardRef, useEffect, useImperativeHandle } from 'react';

type Info = Record<string, any>;

export interface MockCalendarProps {
  events?: Info[];
  datesSet?: (arg: { start: Date; end: Date; view?: { currentStart: Date; type?: string } }) => void;
  select?: (arg: { start: Date; end: Date; startStr?: string; endStr?: string; allDay?: boolean }) => void;
  eventClick?: (arg: Info) => void;
  eventDrop?: (arg: Info) => void;
  eventResize?: (arg: Info) => void;
  eventDidMount?: (arg: Info) => void;
  eventContent?: (arg: Info) => React.ReactNode;
  [key: string]: unknown;
}

export const MOCK_RANGE = { start: new Date(2026, 9, 5), end: new Date(2026, 9, 12) };

export const scrollToTimeCalls: string[] = [];
/** Navigation calls the mock API received, e.g. 'next', 'prev', 'today', 'gotoDate:2026-10-20'. */
export const navCalls: string[] = [];
/** Distinct option-object identities FullCalendar was handed across renders (a fresh object per render makes it re-apply options). */
export const optionIdentities = { headerToolbar: new Set<unknown>(), views: new Set<unknown>() };

const FullCalendarMock = forwardRef<unknown, any>(function FullCalendarMock(rawProps, ref) {
  const props: MockCalendarProps = rawProps;
  const dayRef = React.useRef<Date | null>(null);
  const [view, setView] = React.useState<string | undefined>(props.initialView as string | undefined);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const emitDay = (d: Date, type: string | undefined = viewRef.current) => {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    dayRef.current = start;
    props.datesSet?.({ start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1), view: { currentStart: start, type } });
  };
  const step = (n: number) => { const c = dayRef.current ?? MOCK_RANGE.start; emitDay(new Date(c.getFullYear(), c.getMonth(), c.getDate() + n)); };
  useImperativeHandle(ref, () => ({
    getApi: () => ({
      scrollToTime: (t: string) => { scrollToTimeCalls.push(t); },
      next: () => { navCalls.push('next'); step(1); },
      prev: () => { navCalls.push('prev'); step(-1); },
      today: () => { navCalls.push('today'); emitDay(new Date()); },
      gotoDate: (d: Date | string) => {
        const date = typeof d === 'string' ? new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) : d;
        navCalls.push(`gotoDate:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
        emitDay(date);
      },
      getDate: () => dayRef.current ?? MOCK_RANGE.start,
      changeView: (type: string, d?: Date) => { navCalls.push(`changeView:${type}`); setView(type); emitDay(d ?? dayRef.current ?? MOCK_RANGE.start, type); },
    }),
  }));
  optionIdentities.headerToolbar.add(props.headerToolbar);
  optionIdentities.views.add(props.views);
  const { datesSet } = props;
  useEffect(() => {
    datesSet?.(MOCK_RANGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const visible = (props.events ?? []).filter((e) => e.display !== 'background');
  return (
    <div data-testid="calendar" data-initial-view={props.initialView as string | undefined} data-view={view} data-time-zone={props.timeZone as string | undefined} data-height={String(props.height)}
      data-toolbar-right={props.headerToolbar ? (props.headerToolbar as Info).right : undefined}
      data-toolbar={props.headerToolbar === false ? 'off' : 'on'}
      data-scroll-time={props.scrollTime as string | undefined}
      data-slot-min-time={props.slotMinTime as string | undefined}
      data-slot-max-time={props.slotMaxTime as string | undefined}>
      <div data-testid="bands">{(props.events ?? []).filter((e) => e.display === 'background').length}</div>
      {visible.map((e) => {
        const info = { event: { id: e.id, title: e.title, display: e.display, start: new Date(e.start), end: new Date(e.end), extendedProps: e.extendedProps ?? {} } };
        return (
          <div key={e.id} ref={(el) => { if (el) props.eventDidMount?.({ event: info.event, el }); }} data-testid={`event-${e.id}`} tabIndex={0}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { props.eventClick?.({ ...info, jsEvent: ev.nativeEvent }); ev.preventDefault(); } }}
            className={["fc-event", ...(e.classNames ?? [])].join(" ")}>
            {props.eventContent ? props.eventContent(info) : e.title}
            <button onClick={() => props.eventClick?.(info)}>open {e.title}</button>
            <button
              onClick={() => {
                const start = new Date(new Date(e.start).getTime() + 3600000);
                const end = new Date(new Date(e.end).getTime() + 3600000);
                props.eventDrop?.({ event: { ...info.event, start, end, ...((window as any).__drop ?? {}) }, revert: (window as any).__revert ?? (() => {}) });
              }}
            >
              drag {e.title}
            </button>
          </div>
        );
      })}
      <button
        onClick={() => props.select?.({
          start: new Date(2026, 9, 6, 9, 0), end: new Date(2026, 9, 6, 10, 0),
          ...((window as any).__selectStr ?? {}),
        })}
      >
        mock-select
      </button>
    </div>
  );
});

export default FullCalendarMock;
