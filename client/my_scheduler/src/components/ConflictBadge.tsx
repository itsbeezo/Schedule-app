import React from 'react';
import ConflictIcon from './ConflictIcon';

interface Props {
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  otherTitle: string;
  onOpen(rect: DOMRect): void;
}

export default function ConflictBadge({ state, mode, otherTitle, onOpen }: Props) {
  const label = state === 'active' ? 'Conflict' : mode === 'allow' ? 'Allowed' : 'Ignored';
  return (
    <button
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
