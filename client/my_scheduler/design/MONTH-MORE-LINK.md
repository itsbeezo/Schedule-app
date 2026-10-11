# Month "+N more" link and popover

The frontend caps month days with FullCalendar's `dayMaxEvents`; a packed day shows `+N more` and FullCalendar's built-in popover.
Styles are at the end of `src/styles/calendar.css`. Dark theme only.

- `.fc-daygrid-more-link`: pill, min-height 24px (measured 24px at 1280 and 390), 12px/600 text in `--color-text`, hover tint + light-blue ring + underline, keyboard focus is the mint ring used on events. `.fc-daygrid-day-bottom` is `overflow: visible` so it is not clipped.
- `.fc-more-popover`: raised card, `--shadow-pop`, radius-card, z-index 45 (same as `.popover`: above grid and date strip, below dialogs at 50), max-height min(60vh, 380px), body scrolls. Header with date title and a 32px (44px on phones) close button; event rows 14px with full-size conflict badges.
- Mockup: `design/mockups/month-more.html` (real FullCalendar global build + the real CSS; Oct 14 has 8 events, 2 in conflict; `dayMaxEvents: 3` in the mockup). Run `node design/screenshot-month-more.mjs`.
- Screenshots (design/screenshots, gitignored PNGs): `month-more-link-{1280,390}.png`, `month-more-focus-1280.png`, `month-more-popover-{1280,390}.png`.
- Test: `src/styles/__tests__/monthMore.test.ts`.

Note for frontend: FullCalendar's close control is a non-focusable `<span>` (mouse and Esc only); keyboard users reach events via Tab and close with Esc.
