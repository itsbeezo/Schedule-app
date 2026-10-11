import React from 'react';

// Clock-face outline with an exclamation mark inside (no hands, nothing overlapping the ring).
export default function ConflictIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" />
      <path data-part="bar" d="M8 4.5v4" />
      <circle data-part="dot" cx="8" cy="11.3" r="0.5" fill="currentColor" />
    </svg>
  );
}
