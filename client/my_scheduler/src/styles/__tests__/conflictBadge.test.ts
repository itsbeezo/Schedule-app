import fs from 'fs';
import path from 'path';

const dir = path.join(__dirname, '..');
const cal = fs.readFileSync(path.join(dir, 'calendar.css'), 'utf8');
const comps = fs.readFileSync(path.join(dir, 'components.css'), 'utf8');
const rule = (src: string, sel: string) => {
  const i = src.indexOf(sel + ' {');
  expect(i).toBeGreaterThanOrEqual(0);
  return src.slice(i, src.indexOf('}', i));
};

test('the badge is icon-only everywhere: the word is hidden with font-size 0 at the base rule, never re-shown', () => {
  expect(rule(comps, '.conflict-badge')).toMatch(/font-size:\s*0/);
  const sizes = [...(cal + comps).matchAll(/\.conflict-badge\s*\{[^}]*font-size:\s*([^;}]+)/g)].map((m) => m[1].trim());
  for (const s of sizes) expect(s).toBe('0');
});

test('time-grid badge fits a 15-minute (16px) block: height <= 14px, svg <= 10px', () => {
  const r = rule(cal, '.fc .fc-timegrid-event .conflict-badge');
  expect(parseInt(/height:\s*(\d+)px/.exec(r)![1], 10)).toBeLessThanOrEqual(14);
  expect(r).toMatch(/order:\s*-1/);
  expect(parseInt(/height:\s*(\d+)px/.exec(rule(cal, '.fc .fc-timegrid-event .conflict-badge svg'))![1], 10)).toBeLessThanOrEqual(10);
});

test('the badge sits top-left before the time in grid, flex (compact) and narrow layouts', () => {
  expect(cal).toMatch(/:has\(> \.conflict-badge\)\s*\{[^}]*display:\s*grid/);
  expect(rule(cal, '.fc .fc-timegrid-event .fc-event-main > div > .conflict-badge')).toMatch(/grid-column:\s*1;\s*grid-row:\s*1/);
  expect(cal).toMatch(/> \.fc-event-time \{ grid-column: 2; grid-row: 1; \}/);
  expect(cal).toMatch(/@container \(max-height: 40px\) \{[^}]*:has\(> \.conflict-badge\) \{ display: flex; \}/);
  expect(cal).toMatch(/@container \(max-width: 120px\) \{[^}]*> \.fc-event-title \{ grid-column: 2; grid-row: 1; \}/);
});

test('hit area stays >= 24px via the ::after expansion (14px badge + 2 x 6px)', () => {
  expect(cal).toMatch(/\.fc \.conflict-badge::after \{[^}]*inset:\s*-6px/);
});

test('ignored badge is distinguishable without colour: hollow with an outline vs the filled active badge', () => {
  const r = rule(comps, '.conflict-badge--ignored');
  expect(r).toMatch(/background:\s*var\(--color-surface\)/);
  expect(r).toMatch(/border:\s*1px solid/);
  expect(rule(comps, '.conflict-badge')).toMatch(/border:\s*0/);
});
