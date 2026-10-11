import React, { useEffect, useRef } from 'react';
import ConflictIcon from './ConflictIcon';

interface Props {
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  otherTitle: string;
  onOpen(rect: DOMRect): void;
}

export default function ConflictBadge({ state, mode, otherTitle, onOpen }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  // FullCalendar listens for Enter/Space natively on the event element and calls preventDefault, which would
  // swallow this button's click. A native listener (React's synthetic one runs too late) keeps them local.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    };
    el.addEventListener('keydown', stop);
    return () => el.removeEventListener('keydown', stop);
  }, []);
  const label = state === 'active' ? 'Conflict' : mode === 'allow' ? 'Allowed' : 'Ignored';
  return (
    <button
      ref={ref}
      type="button"
      className={`conflict-badge${state === 'ignored' ? ' conflict-badge--ignored' : ''}`}
      aria-label={`${label}: overlaps with ${otherTitle}. Open options`}
      onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
    >
      <ConflictIcon />
      {label}
    </button>
  );
}
