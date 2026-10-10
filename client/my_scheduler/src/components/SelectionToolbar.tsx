import React, { useState } from 'react';

interface Props {
  range: { start: Date; end: Date };
  onAddEvent(): void;
  onMarkZone?(repeatsWeekly: boolean): void;
  onCancel(): void;
}

export default function SelectionToolbar({ onAddEvent, onMarkZone, onCancel }: Props) {
  const [weekly, setWeekly] = useState(false);
  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selected time range">
      <button className="btn btn--primary" type="button" onClick={onAddEvent}>
        Add event
      </button>
      {onMarkZone && (
        <>
          <button className="btn" type="button" onClick={() => onMarkZone(weekly)}>
            Mark as unconflicted zone
          </button>
          <label className="field__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            Repeat weekly
          </label>
        </>
      )}
      <button className="btn btn--ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
