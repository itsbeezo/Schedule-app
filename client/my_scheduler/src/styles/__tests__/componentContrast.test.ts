import fs from 'fs';
import path from 'path';
import { contrastRatio } from '../contrast';

const css = fs.readFileSync(path.join(__dirname, '..', 'tokens.css'), 'utf8');
const t: Record<string, string> = {};
for (const m of Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g))) t[m[1]] = m[2];

// [foreground token, background token, minimum ratio, where it is used]
const TEXT = 4.5; // WCAG AA, normal text
const UI = 3; // WCAG AA, non-text UI
const PAIRS: Array<[string, string, number, string]> = [
  ['--color-text', '--color-bg', TEXT, 'body text'],
  ['--color-text', '--color-raised', TEXT, 'dialog, popover, toast text'],
  ['--color-muted', '--color-bg', TEXT, 'muted text on page'],
  ['--color-muted', '--color-surface', TEXT, 'field labels, ignored badge text'],
  ['--color-muted', '--color-raised', TEXT, 'muted text in dialogs, disabled today button'],
  ['--color-on-purple', '--color-purple', TEXT, 'selected view pill (day/week/month)'],
  ['--color-light-blue', '--color-bg', UI, 'event hover ring against the page'],
  ['--color-light-blue', '--color-bg', TEXT, 'zone label text'],
  ['--color-light-blue', '--color-surface', TEXT, 'zone label text on grid'],
  ['--color-on-mint', '--color-mint', TEXT, '.btn--primary'],
  ['--color-on-coral', '--color-coral', TEXT, 'conflict badge text, coral option'],
  ['--color-on-purple', '--color-purple', TEXT, 'field error mark, active toolbar button'],
  ['--color-on-royal', '--color-royal', TEXT, '.cal-event'],
  ['--color-mint', '--color-bg', UI, 'focus ring, now indicator'],
  ['--color-mint', '--color-surface', UI, 'focus ring on surfaces'],
  ['--color-mint', '--color-raised', UI, 'focus ring in dialogs'],
  ['--color-mint', '--color-bg', UI, 'event keyboard-focus ring (outside the page-colored gap)'],
  ['--color-mint', '--color-royal', UI, 'focus ring even if it touched a default event'],
  ['--color-bg', '--color-purple', UI, 'page-colored focus gap and overlap separator against a purple event'],
  ['--color-bg', '--color-royal', UI, 'page-colored focus gap and overlap separator against a default event'],
  ['--color-coral', '--color-surface', UI, 'conflict outline against the grid, coral option'],
  // every selectable conflict color (design/CONFLICT-COLOR.md): label on badge, and badge/outline against the grid
  ['--color-on-conflict-red', '--color-conflict-red', TEXT, 'conflict badge text, red option'],
  ['--color-on-conflict-amber', '--color-conflict-amber', TEXT, 'conflict badge text, amber option'],
  ['--color-conflict-red', '--color-surface', UI, 'conflict outline against the grid, red option'],
  ['--color-conflict-amber', '--color-surface', UI, 'conflict outline against the grid, amber option'],
  ['--color-conflict-red', '--color-bg', UI, 'conflict badge against the page, red option'],
  ['--color-conflict-amber', '--color-bg', UI, 'conflict badge against the page, amber option'],
  ['--color-conflict-amber', '--color-royal', UI, 'amber badge against the default event fill'],
  // the amber option clears 3:1 against the default event fill, asserted above. Coral against the royal fill is only 2.1:1; the outline's outer edge meets the grid (checked above) and the
  // conflict is never signalled by color alone (badge with icon and text), so this pairing is intentionally not asserted.
  ['--color-purple', '--color-raised', UI, 'toast error stripe, input focus border'],
  ['--color-purple', '--color-surface', UI, 'input focus border on field'],
  ['--color-light-blue', '--color-surface', UI, 'zone dashed border, time-block edge'],
  ['--color-light-blue', '--color-royal', UI, 'time-block edge against its event'],
  ['--color-text', '--color-raised', TEXT, '.cal-event--ignored text on its calm fill'],
  ['--color-text', '--color-surface', TEXT, 'allowed/ignored event title on its actual surface fill'],
  ['--color-muted', '--color-surface', TEXT, 'allowed/ignored event time and badge text on the surface fill'],
  ['--color-muted', '--color-raised', UI, 'ignored dashed outline on its own fill'],
  ['--color-muted', '--color-surface', UI, 'ignored dashed outline against the grid'],
  ['--color-text', '--color-raised', UI, 'selected swatch ring'],
  // phone date strip (date-strip.css)
  ['--color-text', '--color-bg', TEXT, 'date-strip day numbers and month title on the page'],
  ['--color-muted', '--color-bg', TEXT, 'date-strip weekday letters and outside-month days'],
  ['--color-muted', '--color-surface', TEXT, 'outside-month days in the picker card'],
  ['--color-text', '--color-surface', TEXT, 'picker day numbers on the card'],
  ['--color-on-purple', '--color-purple', TEXT, 'selected day number'],
  ['--color-purple', '--color-bg', UI, 'selected day disc against the page'],
  ['--color-purple', '--color-surface', UI, 'selected day disc against the picker card'],
  ['--color-light-blue', '--color-bg', UI, 'today ring against the page'],
  ['--color-light-blue', '--color-surface', UI, 'today ring against the picker card'],
  ['--color-light-blue', '--color-bg', TEXT, 'ghost Today button text on the page'],
  ['--color-text', '--color-purple', UI, 'today+selected ring against the selected disc'],
];

test.each(PAIRS)('%s on %s is at least %f:1 (%s)', (fg, bg, min) => {
  expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
});

test('the conflict token defaults to coral and the badge and outline read only from it', () => {
  expect(css).toMatch(/--color-conflict:\s*var\(--color-coral\)/);
  expect(css).toMatch(/--color-on-conflict:\s*var\(--color-on-coral\)/);
  const dir = path.join(__dirname, '..');
  const comps = fs.readFileSync(path.join(dir, 'components.css'), 'utf8');
  const cal = fs.readFileSync(path.join(dir, 'calendar.css'), 'utf8');
  expect(comps).not.toMatch(/--color-coral|--color-on-coral/);
  expect(cal).not.toMatch(/--color-coral|--color-on-coral/);
});

test('the "!" and the clock use the same dark on-conflict color: no amber accent, halo or pill', () => {
  expect(t['--color-conflict-bang']).toBeUndefined();
  const comps = fs.readFileSync(path.join(__dirname, '..', 'components.css'), 'utf8');
  expect(comps).toMatch(/\.conflict-icon__clock\s*\{[^}]*stroke:\s*var\(--color-on-conflict\)/);
  expect(/^path\.conflict-icon__bang\s*\{([^}]*)\}/m.exec(comps)![1]).toMatch(/stroke:\s*var\(--color-on-conflict\)/);
  const dot = /^circle\.conflict-icon__bang\s*\{([^}]*)\}/m.exec(comps)![1];
  expect(dot).toMatch(/fill:\s*var\(--color-on-conflict\)/);
  expect(dot).toMatch(/stroke:\s*none/); // a stroke would inflate the dot past the bar width
  // no bare class rule may stroke the dot (it would override the stroke="none" attribute)
  expect(comps).not.toMatch(/^\.(conflict-badge--ignored )?\.?conflict-icon__bang\s*[,{][^}]*stroke:\s*(?!none)/m);
  expect(/\.conflict-badge--ignored circle\.conflict-icon__bang\s*\{([^}]*)\}/.exec(comps)![1]).toMatch(/stroke:\s*none/);
  expect(comps).not.toMatch(/drop-shadow|conflict-bang|conflict-icon__pill/);
  expect(contrastRatio(t['--color-on-coral'], t['--color-coral'])).toBeGreaterThanOrEqual(TEXT);
});
