import React, { useEffect } from 'react';

type Info = Record<string, any>;

export interface MockCalendarProps {
  events?: Info[];
  datesSet?: (arg: { start: Date; end: Date }) => void;
  select?: (arg: { start: Date; end: Date }) => void;
  eventClick?: (arg: Info) => void;
  eventDrop?: (arg: Info) => void;
  eventResize?: (arg: Info) => void;
  eventDidMount?: (arg: Info) => void;
  eventContent?: (arg: Info) => React.ReactNode;
  [key: string]: unknown;
}

export const MOCK_RANGE = { start: new Date(2026, 9, 5), end: new Date(2026, 9, 12) };

export default function FullCalendarMock(props: MockCalendarProps) {
  const { datesSet } = props;
  useEffect(() => {
    datesSet?.(MOCK_RANGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const visible = (props.events ?? []).filter((e) => e.display !== 'background');
  return (
    <div data-testid="calendar" data-initial-view={props.initialView as string | undefined}
      data-toolbar-right={(props.headerToolbar as Info | undefined)?.right}
      data-scroll-time={props.scrollTime as string | undefined}
      data-slot-min-time={props.slotMinTime as string | undefined}
      data-slot-max-time={props.slotMaxTime as string | undefined}>
      <div data-testid="bands">{(props.events ?? []).filter((e) => e.display === 'background').length}</div>
      {visible.map((e) => {
        const info = { event: { id: e.id, title: e.title, display: e.display, start: new Date(e.start), end: new Date(e.end), extendedProps: e.extendedProps ?? {} } };
        return (
          <div key={e.id} ref={(el) => { if (el) props.eventDidMount?.({ event: info.event, el }); }} data-testid={`event-${e.id}`} tabIndex={0}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { props.eventClick?.({ ...info, jsEvent: ev.nativeEvent }); ev.preventDefault(); } }}
            className={(e.classNames ?? []).join(' ')}>
            {props.eventContent ? props.eventContent(info) : e.title}
            <button onClick={() => props.eventClick?.(info)}>open {e.title}</button>
            <button
              onClick={() => {
                const start = new Date(new Date(e.start).getTime() + 3600000);
                const end = new Date(new Date(e.end).getTime() + 3600000);
                props.eventDrop?.({ event: { ...info.event, start, end }, revert: (window as any).__revert ?? (() => {}) });
              }}
            >
              drag {e.title}
            </button>
          </div>
        );
      })}
      <button
        onClick={() => props.select?.({ start: new Date(2026, 9, 6, 9, 0), end: new Date(2026, 9, 6, 10, 0) })}
      >
        mock-select
      </button>
    </div>
  );
}
