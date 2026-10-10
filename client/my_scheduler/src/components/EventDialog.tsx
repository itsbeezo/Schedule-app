import React, { useEffect, useRef, useState } from 'react';
import { EventInput, EventKind } from '../api/types';
import { isReservedColor } from '../styles/reservedColors';
import ColorPicker from './ColorPicker';

export interface EventDraft {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  kind: EventKind;
  color: string | null;
  notes: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  initial: EventDraft;
  onSave(input: EventInput, id?: string): Promise<void>;
  onDelete?(id: string): Promise<void>;
  onClose(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function EventDialog({ mode, initial, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [start, setStart] = useState(toLocalInput(initial.start));
  const [end, setEnd] = useState(toLocalInput(initial.end));
  const [kind, setKind] = useState<EventKind>(initial.kind);
  const [color, setColor] = useState<string | null>(initial.color);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [errors, setErrors] = useState<{ title?: string; end?: string; form?: string }>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      mounted.current = false;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => titleRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busyRef.current) onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !(el as HTMLButtonElement).disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    const next: typeof errors = {};
    if (!trimmed) next.title = 'Enter a title.';
    else if (trimmed.length > 200) next.title = 'Titles can be at most 200 characters.';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      next.end = 'End must be after the start.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSave(
        {
          title: trimmed, start_at: startDate.toISOString(), end_at: endDate.toISOString(), kind, color,
          notes: notes.trim() ? notes : null,
        },
        initial.id
      );
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save the event.' });
    }
    if (mounted.current) setBusy(false);
  }

  async function confirmDelete() {
    if (busy || !initial.id || !onDelete) return;
    setBusy(true);
    try {
      await onDelete(initial.id);
    } catch (err) {
      if (mounted.current) setErrors({ form: err instanceof Error ? err.message : 'Could not delete the event.' });
    }
    if (mounted.current) setBusy(false);
  }

  return (
    <div className="dialog__backdrop">
      <form ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" onSubmit={submit}>
        <h2 className="dialog__title" id="event-dialog-title">
          {mode === 'create' ? 'New event' : 'Edit event'}
        </h2>

        <div className="field">
          <label className="field__label" htmlFor="ev-title">Title</label>
          <input id="ev-title" ref={titleRef} className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <span className="field__error">{errors.title}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ev-start">Start</label>
          <input id="ev-start" type="datetime-local" className="field__input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-end">End</label>
          <input id="ev-end" type="datetime-local" className="field__input" value={end} onChange={(e) => setEnd(e.target.value)} />
          {errors.end && <span className="field__error">{errors.end}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ev-kind">Type</label>
          <select id="ev-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            <option value="event">Event</option>
            <option value="time_block">Time block</option>
          </select>
        </div>

        <ColorPicker value={color} onChange={setColor} />

        <div className="field">
          <label className="field__label" htmlFor="ev-notes">Notes</label>
          <textarea id="ev-notes" className="field__input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {errors.form && <p className="field__error" role="alert">{errors.form}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {mode === 'edit' && initial.id && onDelete &&
            (confirmingDelete ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void confirmDelete()}>
                Confirm delete
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            ))}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || isReservedColor(color)}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
