# CP1 mockup notes (decisions the spec did not dictate)

- Ignored-conflict state is a dashed `--color-muted` outline on a `--color-raised` fill with `--color-text` text (see Fix round 1 for the numbers). The calm fill and dashed pattern, not a bright outline, make it "quiet".
- `.cal-event--ignored` no longer lowers opacity: 0.85 opacity pushes white-on-royal text below AA.
- `.conflict-badge--ignored` uses a `--color-surface` fill with muted text (AA on surface) so it stays readable on a royal event.
- Coral conflict outline vs royal fill is 2.1:1; the outline meets the grid at 3:1+ and conflicts also carry a badge with icon and text, so color is never the only signal. Not asserted in tests (commented there).
- Mockup uses an inline SVG clock-with-"!" symbol in place of the emoji; below 900px the badge shows icon only (aria-label keeps the name).
- At 390px the mockup labels were shortened to "Daily" and "Lab" (Fix round 1); the 390px screenshot now shows no clipping.
- The Tuesday "Lunch with Sam" inline `#7B5CD6` stands in for a user-chosen event color.
- Open item for the live app (Task 16): `.cal-event--ignored` sets `background-color` at the same specificity as `.cal-event`, so FullCalendar's inline user-chosen colors will override it; an ignored event with a custom color must be handled when the real calendar is wired up.

## Fix round 1
- Ignored conflict is now calmer than active: `.cal-event--ignored` uses `--color-raised` fill (#2A2258) with `--color-text` text (12.2:1, asserted AA) and a dashed `--color-muted` outline (5.2:1 on raised, 6.0:1 on surface; asserted >=3:1). No new tokens. It now reads as a dim, recessed card beside Monday's bright royal + coral-outlined events. Replaces the earlier bright dashed text-color outline.
- Time-block edge is now an inset 4px `--color-light-blue` box-shadow (no curved border sliver) with 10px left padding.
- 390px clipping fixed by shortening mockup labels (Standup -> Daily, Workshop -> Lab).
