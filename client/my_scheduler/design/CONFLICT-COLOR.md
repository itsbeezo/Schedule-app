# Conflict badge color: coral vs red vs amber

How to switch: the badge and the conflict outline read `--color-conflict` / `--color-on-conflict` (tokens.css).
Default is AMBER. Set `<html data-conflict-color="coral">` or `="red"` to preview the alternatives; no component
change is needed.

Screenshots (design/screenshots): `conflict-{coral,red,amber}-{dark,light}.png`. Rows: 60-minute block with the full
badge, 30-minute block with compact badge, narrow 30-minute icon-only badge, each on six event colors from the
picker palette. The app has no light theme; the "light" shots put the same components on a hypothetical light page.
Source: mockups/conflict-colors.html, run with `node design/screenshot-conflict.mjs`.

Contrast (WCAG ratios, computed):

| | label on badge (>=4.5) | badge vs royal event | vs violet #7B5CD6 | vs indigo #3B4FD6 | vs sky #2F8FD6 | vs grid surface |
|---|---|---|---|---|---|---|
| coral #FF8A5B | 7.8 | 2.09 | 2.08 | 2.76 | 1.50 | 7.2 |
| red #FF5A5F | 6.1 | 1.59 | 1.58 | 2.10 | 1.14 | 5.5 |
| amber #FFC83D | 10.6 | 3.13 | 3.13 | 4.15 | 2.26 | 10.8 |

Label contrast passes AA for all three. Badge-against-event is where they differ: red is worst (it vibrates against
blue and violet and is nearly the same hue family as coral), coral is under 3:1 on every event color, amber clears
3:1 on royal, violet and indigo and only falls short on the lightest picker color (sky). The badge is never the only
signal (icon + text label), so the sub-3:1 pairings are not hard failures, but amber leaves the most margin.

Fit with the visual style: the palette is violet, royal blue, mint and a warm accent. Red sits too close to coral to
read as a different message and clashes with the cool field. Amber stays in the warm family, is clearly different
from every event color and from the mint now-line and light-blue work hours, and reads as "attention" by convention.

Decision (owner, approved): amber (#FFC83D, label #2B1D00) is the default conflict color. It is a minor UI accent, not
a full feature color, so it is NOT added to the reserved event colors (`reservedColors.ts` and the server list are
unchanged: coral, light blue, purple). Coral and red remain selectable via `data-conflict-color`. The palette test
still guards the approved Violet dusk base colors; amber/red are covered by the conflict-option contrast tests.
Compact icon-only badge: the icon is now wider (clock with a "!" to the right), and the existing 4px side padding
keeps it uncramped (checked in the mockup shots).
