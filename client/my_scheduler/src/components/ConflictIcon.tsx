import React from 'react';

// Clock face (circle + hands) on the left, exclamation mark standing clear of it on the right,
// vertically centered on the circle (bar top cap y=3 to dot bottom y=14, midpoint = circle cy 8.5).
// The dot has no stroke so its diameter (1.5) equals the bar width.
// viewBox is 18x16: circle spans x 1.5..12.5, the "!" bar (stroke 1.5) spans x 15.25..16.75; clock ring ends at 13.25.
export default function ConflictIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={(size * 18) / 16} height={size} viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle data-part="clock" className="conflict-icon__clock" cx="7" cy="8.5" r="5.5" />
      <path data-part="hands" className="conflict-icon__clock" d="M7 5.5v3l2 1.5" />
      <path data-part="bar" className="conflict-icon__bang" d="M16 3.75v6.5" />
      <circle data-part="dot" className="conflict-icon__bang" cx="16" cy="13.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
