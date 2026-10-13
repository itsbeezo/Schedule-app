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

## Final decision (owner): coral badge, dark "!" and clock, "!" left where it is

The amber "!" experiment (accent token `--color-conflict-bang`, dark halo, optional pill) is reverted and removed. The badge
is coral (#FF8A5B); the clock and the "!" are both the same dark on-conflict color (#2A0D05, 7.8:1 on coral). No halo, no
pill, no extra token. `.conflict-icon__clock` and `.conflict-icon__bang` stay as class names, styled identically to
on-conflict, so the existing markup is valid. Ignored badges render the icon in the muted color. Red and amber remain
options via `data-conflict-color`. Shots: `conflict-{coral,red,amber}-{dark,light}.png` (regenerate with
`node design/screenshot-conflict.mjs`).

## Icon-only badge, top-left (owner-approved)

The badge is icon-only everywhere (timegrid, month chips, "+N more" popover). The word stays in the DOM and in the
aria-label; `font-size: 0` on `.conflict-badge` hides it. In time-grid blocks CSS anchors the badge top-left, before the
time (grid, with a flex row for blocks <= 40px and the title taking the time's place in narrow blocks), so a later
overlapping block, which covers the right side of an earlier one, can never hide it. The component's markup order
(badge first for <= 30 min, last otherwise) is unchanged. Size: 14px tall, 16px wide, 10px svg, so it fits inside a
15-minute (16px) block; the 24px+ hit area comes from `::after { inset: -6px }` (28x26). Month chips keep their placement.

Active vs ignored/allowed without colour: active is a FILLED coral pill; ignored/allowed is a HOLLOW pill with a 1px
muted outline and muted icon strokes on the surface color. The event itself also changes shape (dashed outline, calm fill),
and the aria-label says Conflict/Ignored/Allowed. Icon shape is the same in both, so the cue is filled vs hollow plus the
dashed block; the spoken label carries the exact state.

Evidence: mockups/conflict-colors.html (`node design/screenshot-conflict.mjs`); real app with mocked API
(`node design/screenshot-conflict-app.mjs`, serve ./build on :3301): screenshots/conflict-app-desktop-1280.png and
conflict-app-phone-390*.png (60, 30, 15 min pairs, narrow 3-way, ignored). Tests: styles/__tests__/conflictBadge.test.ts.
