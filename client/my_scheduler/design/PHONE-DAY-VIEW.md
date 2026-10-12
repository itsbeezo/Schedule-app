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

## UX review round: compact strip, quiet Today, one month title

Changes (CSS only; `styles/date-strip.css`, `styles/components.css`):

- Vertical space. The first hour row of the grid now starts 156 CSS px from the top at 390 and 360 wide (was 191; measured with `design/measure-phone.mjs`, a 35px gain, so roughly 1.5 more rows). Note the earlier "~360" figure was the 2x screenshot's device pixels. How: the strip has no top padding and 4px below, its margin below is 4px, the phone app header sits 4px (was 16px) above it, weekday labels lost their padding, and the title and Today tap areas are still 44px but overhang by 4px instead of adding row height (the overhang lands in empty space above and on the non-interactive weekday labels below). Day circles stay 44px.
- Month name in the open picker: the header title gets `.date-strip__title--masked` (`visibility:hidden`, layout space kept, so no jump) and `button.date-strip__picker-title` shows the same name (same size/weight/colour as the header title) centered between the arrows, 44px tall, instant (no fades), mint focus ring, chevron rotated 180deg via `[aria-expanded='true']` (points up). `.date-strip__sr-only` is the clip-hidden `aria-live` span. Grid top: 154px closed, 400px open at 390 and 360 (open picker pushes the grid exactly as before); overflow 0. Shots: `design/screenshots/picker-{closed,open,open-paged}-{390,360}.png`, script `design/screenshot-picker.mjs`.
- Conflict icon: the dot is `circle.conflict-icon__bang { stroke:none; fill }` and the bar `path.conflict-icon__bang { stroke }`, so a class stroke no longer inflates the dot (dot diameter equals bar width, 1.5 units). Shot: `design/screenshots/conflict-badge-4x.png`.
- The month title pill no longer has a negative left margin, so its hover wash stays inside the 8px page gutter.
- Today is a ghost text button: no fill, no border, light-blue text (4.5:1 on the page, asserted in `componentContrast.test.ts`), 44px target, hover wash, the token focus ring. The mint Add event button is the only filled action in the top area.
