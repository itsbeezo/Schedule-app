# DST header note (`.cal-dst-note`)

Small text under the day name/number in week, day and phone day headers on the two daylight-saving days a year ("Clocks forward 1h" / "Clocks back 1h").

- Color: `--color-muted` (already contrast-tested on bg and surface in componentContrast.test.ts, AA text). No new tokens.
- 11px (10px at max-width 600px), weight 400, centered, line-height 1.2. Wraps (`overflow-wrap: anywhere`) rather than ellipsizing, so the text is never lost; at 390px a week column wraps to two lines at most.
- Not color alone: the meaning is carried by the words.
- Rendered in the header cushion as a block element; the phone day view header is hidden by the date strip rules, so the note shows there only if the frontend places it outside the hidden header.
