import React from 'react';
import { isReservedColor } from '../styles/reservedColors';

export const EVENT_SWATCHES: readonly string[] = ['#4A63F0', '#3B4FD6', '#6C7DF5', '#7B5CD6', '#5B3FC4', '#2F8FD6'];

interface Props {
  value: string | null;
  onChange(color: string | null): void;
}

export default function ColorPicker({ value, onChange }: Props) {
  const reserved = isReservedColor(value);
  return (
    <div className="field">
      <span className="field__label">Color</span>
      <div role="group" aria-label="Event color" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className={`btn btn--ghost${value === null ? ' swatch--selected' : ''}`}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          Default
        </button>
        {EVENT_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={value === c}
            className={`swatch${value === c ? ' swatch--selected' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <input
          type="color"
          aria-label="Custom color"
          value={value ?? '#4a63f0'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </div>
      {reserved && (
        <span className="field__error" role="alert">
          That exact color is reserved for conflicts, work hours, or the app itself. Pick a slightly different shade.
        </span>
      )}
    </div>
  );
}
