import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/client';
import { ConflictIgnore, ConflictZone, WorkHour } from '../api/types';
import { DEFAULT_SCROLL_TIME, getDefaultEventColor, getScrollTime, setDefaultEventColor, setScrollTime } from '../lib/preferences';
import { browserTimeZone, isValidTimeZone, supportedTimeZones } from '../lib/timezone';
import { isReservedColor } from '../styles/reservedColors';
import ColorPicker from './ColorPicker';
import { useToast } from './Toast';
import WorkHoursEditor from './WorkHoursEditor';

interface Props {
  onClose(): void;
  /** Called after any server-side change so the calendar can reload. */
  onChanged(): void;
  /** Called with the new time (HH:MM or HH:MM:SS) after the "Calendar starts at" preference changes. */
  onScrollTimeChange?(time: string): void;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select, textarea, [href], [tabindex]:not([tabindex="-1"])';

export default function SettingsPanel({ onClose, onChanged, onScrollTimeChange }: Props) {
  const { showError } = useToast();
  const ref = useRef<HTMLElement>(null);
  const [workHours, setWorkHours] = useState<WorkHour[] | null>(null);
  const [zones, setZones] = useState<ConflictZone[]>([]);
  const [ignores, setIgnores] = useState<ConflictIgnore[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(getDefaultEventColor());
  const [scrollTime, setScrollTimeState] = useState(() => getScrollTime().slice(0, 5));
  const deviceZone = browserTimeZone();
  const zoneOptions = useMemo(() => supportedTimeZones(), []);
  const [savedZone, setSavedZone] = useState<string | null>(null);
  const [zoneDraft, setZoneDraft] = useState('');
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [zoneSaving, setZoneSaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    try {
      const [w, z, i] = await Promise.all([api.listWorkHours(), api.listZones(), api.listIgnores()]);
      setWorkHours(w);
      setZones(z);
      setIgnores(i);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load settings.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getSettings();
        if (cancelled) return;
        const tz = s?.timezone || deviceZone;
        setSavedZone(tz);
        setZoneDraft(tz);
      } catch {
        if (cancelled) return;
        setSavedZone(deviceZone);
        setZoneDraft(deviceZone);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCloseRef.current();
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!ref.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function run(action: () => Promise<unknown>, failure: string) {
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      showError(err instanceof Error ? err.message : failure);
    }
  }

  async function saveZone() {
    const tz = zoneDraft.trim();
    if (!isValidTimeZone(tz)) {
      setZoneError('Choose a valid time zone, such as America/New_York.');
      return;
    }
    setZoneError(null);
    setZoneSaving(true);
    try {
      const saved = await api.updateSettings({ timezone: tz });
      const next = saved?.timezone || tz;
      setSavedZone(next);
      setZoneDraft(next);
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the time zone.';
      setZoneError(message);
      showError(message);
    } finally {
      setZoneSaving(false);
    }
  }

  function changeScrollTime(value: string) {
    setScrollTimeState(value);
    if (!value) return; // a cleared time input is not a valid time; keep the stored preference
    setScrollTime(value);
    if (getScrollTime().slice(0, 5) === value.slice(0, 5)) onScrollTimeChange?.(value);
  }

  function resetScrollTime() {
    setScrollTime(null);
    setScrollTimeState(DEFAULT_SCROLL_TIME.slice(0, 5));
    onScrollTimeChange?.(DEFAULT_SCROLL_TIME);
  }

  return (
    <aside ref={ref} className="settings" role="dialog" aria-label="Settings">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="dialog__title">Settings</h2>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
      </div>

      {loadError && <p className="field__error" role="alert">{loadError}</p>}

      <section className="settings__section">
        <h3>Calendar view</h3>
        <div className="field">
          <label className="field__label" htmlFor="settings-scroll-time">Calendar starts at</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              id="settings-scroll-time"
              type="time"
              className="field__input"
              value={scrollTime}
              onChange={(e) => changeScrollTime(e.target.value)}
            />
            <button type="button" className="btn btn--ghost" onClick={resetScrollTime}>
              Reset to {DEFAULT_SCROLL_TIME.slice(0, 5)}
            </button>
          </div>
        </div>
      </section>

      <section className="settings__section">
        <h3>Time zone</h3>
        <div className="field">
          <label className="field__label" htmlFor="settings-time-zone">Time zone</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              id="settings-time-zone"
              className="field__input"
              list="settings-time-zone-options"
              value={zoneDraft}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={zoneError ? true : undefined}
              aria-describedby="settings-time-zone-hint"
              onChange={(e) => {
                setZoneDraft(e.target.value);
                setZoneError(null);
              }}
            />
            <datalist id="settings-time-zone-options">
              {zoneOptions.map((z) => <option key={z} value={z} />)}
            </datalist>
            <button
              type="button"
              className="btn btn--primary"
              disabled={zoneSaving || savedZone === null || zoneDraft.trim() === savedZone}
              onClick={() => void saveZone()}
            >
              Save time zone
            </button>
          </div>
          <p id="settings-time-zone-hint" className="field__label">
            This device's time zone is {deviceZone}.{' '}
            <button
              type="button"
              className="btn btn--ghost"
              disabled={zoneDraft === deviceZone}
              onClick={() => {
                setZoneDraft(deviceZone);
                setZoneError(null);
              }}
            >
              Use this device's time zone
            </button>
          </p>
          {zoneError && <p className="field__error" role="alert">{zoneError}</p>}
          {savedZone && savedZone !== deviceZone && (
            <p className="field__label">Calendar grid still shows times in this device's time zone.</p>
          )}
        </div>
      </section>

      <section className="settings__section">
        <h3>Work hours</h3>
        {workHours && (
          <WorkHoursEditor
            value={workHours}
            onSave={async (next) => {
              await api.putWorkHours(next);
              await load();
              onChanged();
            }}
          />
        )}
      </section>

      <section className="settings__section">
        <h3>Unconflicted zones</h3>
        {zones.length === 0 && <p className="field__label">None. Drag across the calendar and choose "Mark as unconflicted zone".</p>}
        {zones.map((z) => (
          <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>
              {fmt(z.start_at)} to {fmt(z.end_at)}
              {z.repeats_weekly ? ' (repeats weekly)' : ''}
            </span>
            <button type="button" className="btn btn--ghost" aria-label={`Remove zone ${fmt(z.start_at)}`} onClick={() => void run(() => api.deleteZone(z.id), 'Could not remove the zone.')}>
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="settings__section">
        <h3>Allowed overlaps</h3>
        {ignores.length === 0 && <p className="field__label">None.</p>}
        {ignores.map((ig) => (
          <div key={ig.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>
              {ig.event_a_title} and {ig.event_b_title} ({ig.mode === 'allow' ? 'always allowed' : 'ignored once'})
            </span>
            <button type="button" className="btn btn--ghost" onClick={() => void run(() => api.deleteIgnore(ig.id), 'Could not restore the conflict.')}>
              Restore conflict
            </button>
          </div>
        ))}
      </section>

      <section className="settings__section">
        <h3>Default event color</h3>
        <ColorPicker
          value={color}
          onChange={(c) => {
            setColor(c);
            if (!isReservedColor(c)) setDefaultEventColor(c);
          }}
        />
      </section>
    </aside>
  );
}
