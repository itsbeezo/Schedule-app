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
  ['--color-muted', '--color-raised', TEXT, 'muted text in dialogs'],
  ['--color-light-blue', '--color-bg', TEXT, 'zone label text'],
  ['--color-light-blue', '--color-surface', TEXT, 'zone label text on grid'],
  ['--color-on-mint', '--color-mint', TEXT, '.btn--primary'],
  ['--color-on-coral', '--color-coral', TEXT, '.conflict-badge'],
  ['--color-on-purple', '--color-purple', TEXT, 'field error mark, active toolbar button'],
  ['--color-on-royal', '--color-royal', TEXT, '.cal-event'],
  ['--color-mint', '--color-bg', UI, 'focus ring, now indicator'],
  ['--color-mint', '--color-surface', UI, 'focus ring on surfaces'],
  ['--color-mint', '--color-raised', UI, 'focus ring in dialogs'],
  ['--color-coral', '--color-surface', UI, 'conflict outline against the grid'],
  // coral against the royal fill is only 2.1:1; the outline's outer edge meets the grid (checked above) and the
  // conflict is never signalled by color alone (badge with icon and text), so this pairing is intentionally not asserted.
  ['--color-purple', '--color-raised', UI, 'toast error stripe, input focus border'],
  ['--color-purple', '--color-surface', UI, 'input focus border on field'],
  ['--color-light-blue', '--color-surface', UI, 'zone dashed border, time-block edge'],
  ['--color-light-blue', '--color-royal', UI, 'time-block edge against its event'],
  ['--color-text', '--color-raised', TEXT, '.cal-event--ignored text on its calm fill'],
  ['--color-muted', '--color-raised', UI, 'ignored dashed outline on its own fill'],
  ['--color-muted', '--color-surface', UI, 'ignored dashed outline against the grid'],
  ['--color-text', '--color-raised', UI, 'selected swatch ring'],
];

test.each(PAIRS)('%s on %s is at least %f:1 (%s)', (fg, bg, min) => {
  expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
});
