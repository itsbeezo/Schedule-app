# Conflict badge color: coral vs red vs amber

How to switch: the badge and the conflict outline read `--color-conflict` / `--color-on-conflict` (tokens.css).
Default is CORAL (restored, see the clarified decision at the end). Set `<html data-conflict-color="red">` or `="amber"` to preview the alternatives; no component
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

## Clarified decision (owner, latest): coral badge, amber "!" only

The earlier amber decision was meant for the "!" glyph only, not the badge. So: `--color-conflict` / `--color-on-conflict`
default back to coral (#FF8A5B / #2A0D05), the conflict block outline is coral again, red and amber remain options via
`data-conflict-color`. New approved accent token `--color-conflict-bang: #FFC83D` colors the "!" (bar + dot, class
`conflict-icon__bang`); the clock (`conflict-icon__clock`) stays on-coral dark. The token is not a reserved event color
(`RESERVED_COLORS` and the server list are untouched).

Measured contrast: amber #FFC83D on coral #FF8A5B = 1.44:1 (computed), so the amber "!" ALONE FAILS (needs 3:1 as a UI
glyph) and is nearly invisible at 11px (shot `conflict-coral-dark-bang-plain.png`). Amber against the dark on-coral
#2A0D05 = 11.1:1. Options rendered on six event colors in dark theme (full, compact 30-min, icon-only):
- plain amber: `conflict-coral-dark-bang-plain.png` (illegible)
- dark halo (drop-shadow of on-conflict around the glyph): `conflict-coral-dark.png` (legible, slightly soft; CSS only)
- dark pill behind the "!" : `conflict-coral-dark-bang-pill.png` (crispest; needs a `<rect class="conflict-icon__pill">`
  in ConflictIcon.tsx, CSS for it already exists and is optional)
Shipped default: the halo (no markup dependency). Recommendation: halo now; add the pill rect when convenient for the
crispest result. Ignored badges render the icon in the muted color with no halo.
