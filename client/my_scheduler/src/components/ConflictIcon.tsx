import React from 'react';

export default function ConflictIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="8.5" r="5.5" />
      <path d="M7 5.5v3l2 1.5" />
      <path d="M13.5 1.5v3.2" />
      <circle cx="13.5" cy="6.6" r="0.5" fill="currentColor" />
    </svg>
  );
}
