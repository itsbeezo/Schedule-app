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
