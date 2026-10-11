# Phone one-day view and date strip (<= 600px)

Stylesheet: `src/styles/date-strip.css` (imported from `index.css`). Markup: `MobileDateStrip.tsx`. Tokens only, no new colors.

- Sticky header: month title button (44px, chevron rotates 180deg on `aria-expanded="true"`) and a 44px Today button.
- Week strip: 7 `minmax(0,1fr)` columns; 44px round day buttons. 7 x 44 = 308px fits 360px minus 8px page padding each side.
- Selected: filled purple disc, bold, underlined number (not colour alone). Today: light-blue ring plus a dot. Both: text-colored ring on the disc. Outside-month days are muted.
- Picker: a card (surface, border, pop shadow) that pushes the grid down; 44px prev/next buttons; same day states.
- Hover = soft tint, active = scale 0.94 + purple tint, focus = mint `--focus-ring`.
- FullCalendar's per-day header is visually hidden (clip technique, still in the DOM for screen readers) only in `timeGridDay` on phones; the all-day and zone rows are untouched.
- Compact conflict badge (18x16 icon, 2px 4px padding) checked in 30-minute blocks at 360 and 390: not cramped, no change needed.
- Tests: `styles/__tests__/dateStrip.test.ts`, contrast pairs in `componentContrast.test.ts`, class list in `classContract.test.ts`.
- Screenshots (real build, mocked /api, 390 and 360, dark): `design/screenshots/phone-day-{collapsed,picker,selected-other,focus,badge}-{390,360}.png`. Script: `design/screenshot-phone.mjs`. Measured horizontal overflow: 0px at both widths, collapsed and expanded.
- The phone page padding is 8px (components.css), so the strip uses 8px side padding/-8px margin to line up with the grid.
