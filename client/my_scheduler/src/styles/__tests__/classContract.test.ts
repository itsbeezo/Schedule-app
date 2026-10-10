import fs from 'fs';
import path from 'path';

const dir = path.join(__dirname, '..');
const css = ['components.css', 'calendar.css']
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const CONTRACT = [
  'app-shell', 'app-header', 'app-title', 'btn', 'btn--primary', 'btn--ghost', 'card', 'dialog',
  'dialog__backdrop', 'dialog__title', 'field', 'field__label', 'field__input', 'field__error', 'swatch',
  'swatch--selected', 'toast', 'toast--error', 'load-error', 'selection-toolbar', 'cal-event',
  'cal-event--time-block', 'cal-event--conflict', 'cal-event--ignored', 'cal-work-hours', 'cal-zone',
  'conflict-badge', 'conflict-badge--ignored', 'popover', 'popover__title', 'popover__actions', 'settings',
  'settings__section',
];

test.each(CONTRACT)('defines .%s', (name) => {
  expect(css).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
});

test('index.css imports the font, tokens, and every stylesheet', () => {
  const index = fs.readFileSync(path.join(dir, 'index.css'), 'utf8');
  for (const f of ['tokens.css', 'base.css', 'components.css', 'calendar.css']) expect(index).toContain(f);
  expect(index).toContain('@fontsource/inter');
});

test('interactive controls have a visible keyboard focus style', () => {
  const base = fs.readFileSync(path.join(dir, 'base.css'), 'utf8');
  expect(base).toMatch(/:focus-visible/);
  expect(base).toMatch(/prefers-reduced-motion/);
});
