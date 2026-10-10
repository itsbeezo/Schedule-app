import fs from 'fs';
import path from 'path';
import { contrastRatio } from '../contrast';
import { RESERVED_COLORS } from '../reservedColors';

const dir = path.join(__dirname, '..');

function readTokens(): Record<string, string> {
  const css = fs.readFileSync(path.join(dir, 'tokens.css'), 'utf8');
  const tokens: Record<string, string> = {};
  for (const m of Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))) tokens[m[1]] = m[2].trim();
  return tokens;
}
const t = readTokens();

const REQUIRED = [
  'color-bg', 'color-surface', 'color-raised', 'color-purple', 'color-royal', 'color-light-blue', 'color-mint',
  'color-coral', 'color-text', 'color-muted', 'color-on-royal', 'color-on-purple', 'color-on-mint',
  'color-on-coral', 'color-border', 'color-hover', 'color-purple-soft', 'color-work-hours', 'color-zone-bg',
  'color-overlay', 'radius-card', 'radius-event', 'radius-input', 'radius-pill', 'space-half', 'space-1',
  'space-2', 'space-3', 'space-4', 'space-5', 'font-sans', 'text-sm', 'text-md', 'text-lg', 'text-xl',
  'motion-fast', 'motion-ease', 'focus-ring', 'shadow-pop',
];

test.each(REQUIRED)('defines --%s', (name) => {
  expect(t[`--${name}`]).toBeDefined();
});

test('palette matches the approved Violet dusk values', () => {
  expect(t['--color-bg']).toBe('#14102A');
  expect(t['--color-surface']).toBe('#1E1840');
  expect(t['--color-raised']).toBe('#2A2258');
  expect(t['--color-purple']).toBe('#9B6BFF');
  expect(t['--color-royal']).toBe('#4A63F0');
  expect(t['--color-light-blue']).toBe('#A8D4FF');
  expect(t['--color-mint']).toBe('#4DF5C0');
  expect(t['--color-coral']).toBe('#FF8A5B');
  expect(t['--color-text']).toBe('#EFEAFF');
  expect(t['--color-muted']).toBe('#9D95C9');
});

test('the reserved color list equals the coral, light-blue, and purple tokens', () => {
  const fromTokens = [t['--color-coral'], t['--color-light-blue'], t['--color-purple']].map((c) => c.toUpperCase());
  expect([...RESERVED_COLORS].sort()).toEqual(fromTokens.sort());
});

test.each([
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-raised'],
  ['--color-muted', '--color-bg'],
  ['--color-muted', '--color-surface'],
  ['--color-muted', '--color-raised'],
  ['--color-light-blue', '--color-surface'],
  ['--color-on-royal', '--color-royal'],
  ['--color-on-purple', '--color-purple'],
  ['--color-on-mint', '--color-mint'],
  ['--color-on-coral', '--color-coral'],
])('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
  expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
});

test('cards and events use 12-16px radii and buttons are pills', () => {
  for (const name of ['--radius-card', '--radius-event', '--radius-input']) {
    const px = parseInt(t[name], 10);
    expect(px).toBeGreaterThanOrEqual(12);
    expect(px).toBeLessThanOrEqual(16);
  }
  expect(parseInt(t['--radius-pill'], 10)).toBeGreaterThanOrEqual(999);
});

test('numbered spacing tokens sit on the 8px grid', () => {
  for (const n of [1, 2, 3, 4, 5]) expect(parseInt(t[`--space-${n}`], 10) % 8).toBe(0);
});

test('no stylesheet other than tokens.css hard-codes a color', () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'tokens.css');
  for (const f of files) {
    const css = fs.readFileSync(path.join(dir, f), 'utf8');
    expect({ file: f, hex: css.match(/#[0-9a-fA-F]{3,8}\b/g) }).toEqual({ file: f, hex: null });
    expect({ file: f, fn: css.match(/\brgba?\(/g) }).toEqual({ file: f, fn: null });
  }
});
