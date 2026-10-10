# CP2 live-app styling notes

Every non-variable override in calendar.css / components.css, and why.

- `.fc .fc-event.cal-event--time-block`: FullCalendar sets `.fc .fc-timegrid-event { box-shadow: 0 0 0 1px ... }`, which beat the single-class stripe rule. Selector raised so the 4px light-blue stripe (non-color cue) shows.
- `.fc .fc-event.cal-event--ignored` with `!important` on background/color: FullCalendar writes a custom event color as an inline style, so an ignored event with a custom color kept its bright fill. Inline non-important loses to `!important`. Verified live by injecting the class on an event with inline `#ff0000`. Dashed outline remains the non-color cue.
- `.fc .fc-bg-event.cal-work-hours` / `.cal-zone`: FullCalendar gives `.fc-bg-event` `opacity: .3`, which washed out the work-hours and zone tokens. `opacity: 1` restored. The `!important` on background/border stays (FullCalendar inline-styles bg events that carry a color); verified against real `.fc-bg-event` markup.
- `.fc .fc-event-title { font-weight: 600 }`: FC default is 400; mockup uses bold titles.
- `.fc .fc-event:hover`: brightness hover (spec 4.2).
- `@media (max-width: 600px)`: seven columns at 390px broke titles per letter. `.fc-scrollgrid` gets `min-width: 640px` and `.fc-view-harness` scrolls horizontally; toolbar wraps.
- Hover states added: `.swatch:hover`, `.conflict-badge:hover`, `.field__input:hover`. `.swatch--selected:hover` keeps the selected border.
- `.dialog { color-scheme: dark }` so native date/select/color controls render dark; `.dialog input[type='color']` restyled (the ColorPicker input has no class).

## Requests for the frontend agent
- None required. Optional: give the custom color `<input type="color">` in ColorPicker a class (for example `swatch-input`) so the dialog-scoped selector can be replaced. On narrow screens consider defaulting to day view (CSS only makes the week grid scroll).
- Zone, conflict-badge and ignored states are not in the demo seed, so they were verified by class injection, not by real data.

## Fix round 1 (reviewer findings)

Non-variable fixes added or previously unlisted:
- `.fc .fc-event.cal-event--conflict`: selector raised from `.cal-event--conflict` so the coral outline is not beaten by FullCalendar's event rules.
- `.fc .fc-event-time { font-weight: 500 }`: FC default 400; matches the mockup's lighter time over a bold title.
- `.fc .fc-event.cal-event--ignored .fc-event-main { color: var(--color-muted) }`: FC puts `color` on `.fc-event-main` (`color: var(--fc-event-text-color)`-style inheritance), so the `!important` on the event alone did not recolor the inner text for custom-color events.
- `.fc .fc-event-title, .fc .fc-event-time { overflow-wrap: normal; word-break: keep-all }` (removed the earlier `overflow-wrap: anywhere`): no mid-word breaks ("Sprin/t/dem/o").
- `.fc .fc-event { container-type: inline-size }` plus `@container (max-width: 120px)`: FullCalendar sizes side-by-side overlapping events by inline `left/right`, so media queries cannot see their width. In narrow blocks: 12px type, single-line ellipsis titles, and the time is hidden (a 30-minute block cannot hold time over title; the time is in the edit dialog). Trade-off: very narrow blocks (about 45px) show only 2 letters plus an ellipsis; that needs a component fix (popover on hover/focus, or lay conflicting events out differently), not CSS.
- `.fc .fc-timegrid-event-short`: zero vertical padding and 1.2 line-height so a 30-minute block fits a line.
- Hover: `.fc .fc-event:hover` now draws a 2px light-blue ring (box-shadow) instead of `filter: brightness(1.1)`, which could push white-on-royal under 4.5:1. The time-block variant keeps its inset stripe. Ring vs page is covered by a contrast pair (>= 3:1).
- `.fc .fc-button:disabled { opacity: 1; color: var(--color-muted) }`: FC fades the disabled 'today' button to .65 opacity. Muted on raised is 4.5:1 or better (tested pair). Selected view pill (on-purple on purple) is a tested pair too.
- 390px scroll affordance (CSS only): `.fc-view-harness` has a right-edge mask fade driven by a registered `--edge` property and a scroll-driven animation (`animation-timeline: scroll(self inline)`); the fade shrinks to zero when the grid reaches its right end. Browsers without scroll-driven animations keep a constant 40px fade.

Notes:
- Live conflict markers are intentionally not shown yet; conflict UI is CP3 work (frontend Tasks 13-14).
- Conflict, zone and ignored looks were verified by injected classes only (app-states-1280.png), not by real data.

Owner decision (not made by design): default to day view on narrow screens. It is a behavior change, so only the owner can choose it; CSS only makes the week grid scroll sideways.
- Container sizing: `.fc .fc-event { container-type: size }` (events have explicit height). `@container (max-height: 40px)` puts time and title on one row for half-hour blocks (FC otherwise stacks them and clips the title). All container rules are prefixed `.fc` because FC's `.fc-v-event .fc-event-main-frame` rules out-specify bare selectors.
- The scroll fade mask uses `var(--color-bg)` (alpha only matters), because the no-hard-coded-color test forbids `#000`.
