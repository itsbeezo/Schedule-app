import React, { useState } from 'react';
import { WorkHour } from '../api/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Row extends WorkHour {
  key: number;
}

interface Props {
  value: WorkHour[];
  onSave(next: WorkHour[]): Promise<void>;
}

const hhmm = (t: string) => t.slice(0, 5);

export default function WorkHoursEditor({ value, onSave }: Props) {
  const [nextKey, setNextKey] = useState(value.length);
  const [rows, setRows] = useState<Row[]>(
    value.map((w, i) => ({ ...w, start_time: hhmm(w.start_time), end_time: hhmm(w.end_time), key: i }))
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forDay = (d: number) => rows.filter((r) => r.weekday === d);
  const update = (key: number, patch: Partial<WorkHour>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addRange(weekday: number) {
    setRows((rs) => [...rs, { key: nextKey, weekday, start_time: '09:00', end_time: '17:00' }]);
    setNextKey((k) => k + 1);
  }

  async function save() {
    for (let d = 0; d < 7; d++) {
      const day = forDay(d).sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (const r of day) {
        if (!r.start_time || !r.end_time || r.end_time <= r.start_time) {
          setError(`${DAYS[d]}: end must be after the start.`);
          return;
        }
      }
      for (let i = 1; i < day.length; i++) {
        if (day[i].start_time < day[i - 1].end_time) {
          setError(`${DAYS[d]}: ranges overlap.`);
          return;
        }
      }
    }
    setError(null);
    setBusy(true);
    try {
      const next = rows
        .map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time }))
        .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save work hours.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {DAYS.map((name, d) => (
        <fieldset key={name} style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend className="field__label">{name}</legend>
          {forDay(d).map((r, i) => (
            <div key={r.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <input type="time" className="field__input" aria-label={`${name} range ${i + 1} start`} value={r.start_time} onChange={(e) => update(r.key, { start_time: e.target.value })} />
              <span aria-hidden="true">to</span>
              <input type="time" className="field__input" aria-label={`${name} range ${i + 1} end`} value={r.end_time} onChange={(e) => update(r.key, { end_time: e.target.value })} />
              <button type="button" className="btn btn--ghost" aria-label={`Remove ${name} range ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn btn--ghost" aria-label={`Add range to ${name}`} onClick={() => addRange(d)}>
            + Add range
          </button>
        </fieldset>
      ))}
      {error && <p className="field__error" role="alert">{error}</p>}
      <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
        Save work hours
      </button>
    </div>
  );
}
