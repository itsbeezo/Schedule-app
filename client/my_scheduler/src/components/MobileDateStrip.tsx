import React, { useEffect, useRef, useState } from 'react';
import { addDays, addMonths, fullDateLabel, isSameDay, monthGrid, monthTitle, weekdayShort, weekDays } from '../lib/dateStrip';
import { useSwipe } from '../hooks/useSwipe';

interface Props {
  /** The day currently shown in the calendar. */
  selected: Date;
  /** Injected for tests; defaults to now. */
  today?: Date;
  onSelect: (d: Date) => void;
  onToday: () => void;
}

/** Phone header: month title (toggles a month picker), Today, and a one-week strip. */
export default function MobileDateStrip({ selected, today = new Date(), onSelect, onToday }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(selected); // month shown in the picker
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pickerTitleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const refocusHeader = useRef(false);
  const weekRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!open) setCursor(selected); }, [open, selected]);

  // Focus handoff: into the picker title on open; back to the header title when the picker closes
  // by its title, Escape, or picking a date (not when Today is pressed).
  useEffect(() => {
    if (open && !wasOpen.current) pickerTitleRef.current?.focus();
    if (!open && wasOpen.current && refocusHeader.current) toggleRef.current?.focus();
    wasOpen.current = open;
    if (!open) refocusHeader.current = false;
  }, [open]);

  function closePicker(refocus: boolean) {
    refocusHeader.current = refocus;
    setOpen(false);
  }

  useSwipe(weekRef, { onSwipe: (dir) => onSelect(addDays(selected, dir === 'next' ? 7 : -7)) });

  const shown = open ? cursor : selected; // header month follows the picker while open
  const days = weekDays(selected);
  const weekLabel = days.some((d) => isSameDay(d, today)) ? 'This week' : `Week of ${fullDateLabel(days[0])}`;

  function pick(d: Date) {
    onSelect(d);
    closePicker(true);
  }

  function dayButton(d: Date, extraClass = '') {
    const isSel = isSameDay(d, selected);
    const isToday = isSameDay(d, today);
    const cls = ['date-strip__day', isSel && 'date-strip__day--selected', isToday && 'date-strip__day--today', extraClass].filter(Boolean).join(' ');
    return (
      <button key={d.getTime()} type="button" className={cls} aria-label={fullDateLabel(d)} aria-pressed={isSel}
        aria-current={isToday ? 'date' : undefined} onClick={() => pick(d)}>
        <span className="date-strip__num">{d.getDate()}</span>
      </button>
    );
  }

  return (
    <div className="date-strip" onKeyDown={(e) => { if (e.key === 'Escape' && open) closePicker(true); }}>
      <div className="date-strip__header">
        <button ref={toggleRef} type="button" className={open ? 'date-strip__title date-strip__title--masked' : 'date-strip__title'}
          aria-expanded={open} aria-controls="date-strip-picker" aria-hidden={open ? true : undefined} tabIndex={open ? -1 : undefined}
          aria-label={`${monthTitle(shown)}, ${open ? 'close' : 'choose'} date picker`} onClick={() => setOpen(true)}>
          {monthTitle(shown)}
          <span className="date-strip__chevron" aria-hidden="true">▾</span>
        </button>
        <button type="button" className="btn date-strip__today" onClick={() => { closePicker(false); onToday(); }}>Today</button>
      </div>
      {open ? (
        <div id="date-strip-picker" className="date-strip__picker" role="group" aria-label="Choose a date">
          <div className="date-strip__picker-nav">
            <button type="button" className="btn" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}>{'‹'}</button>
            <button ref={pickerTitleRef} type="button" className="date-strip__picker-title" aria-expanded="true" aria-controls="date-strip-picker"
              aria-label={`Close month picker, ${monthTitle(cursor)}`} onClick={() => closePicker(true)}>
              {monthTitle(cursor)}
              <span className="date-strip__chevron" aria-hidden="true">▾</span>
            </button>
            <span className="date-strip__sr-only" aria-live="polite">{monthTitle(cursor)}</span>
            <button type="button" className="btn" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>{'›'}</button>
          </div>
          <div className="date-strip__dow-row" aria-hidden="true">
            {weekDays(cursor).map((d) => <span key={d.getDay()} className="date-strip__dow">{weekdayShort(d)}</span>)}
          </div>
          <div className="date-strip__month">
            {monthGrid(cursor).map((row) => (
              <div key={row[0].getTime()} className="date-strip__row">
                {row.map((d) => dayButton(d, d.getMonth() !== cursor.getMonth() ? 'date-strip__day--outside' : ''))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div ref={weekRef} className="date-strip__week" role="group" aria-label={weekLabel}>
          {days.map((d) => (
            <div key={d.getTime()} className="date-strip__cell">
              <span className="date-strip__dow" aria-hidden="true">{weekdayShort(d)}</span>
              {dayButton(d)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
