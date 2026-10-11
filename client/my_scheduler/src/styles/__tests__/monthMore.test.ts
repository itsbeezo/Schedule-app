import fs from 'fs';
import path from 'path';
import { contrastRatio } from '../contrast';

const dir = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(dir, 'calendar.css'), 'utf8');
const tokens = fs.readFileSync(path.join(dir, 'tokens.css'), 'utf8');
const t: Record<string, string> = {};
for (const m of Array.from(tokens.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g))) t[m[1]] = m[2];
const rule = (sel: string) => {
  const esc = sel.replace(/[.[\]()'=-]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule for ${sel}`);
  return m[1];
};

test('the +N more link is a pill of at least 24px height with text (not color alone)', () => {
  const r = rule('.fc .fc-daygrid-more-link');
  expect(parseInt(r.match(/min-height:\s*(\d+)px/)![1], 10)).toBeGreaterThanOrEqual(24);
  expect(r).toMatch(/color:\s*var\(--color-text\)/);
  expect(r).toMatch(/border-radius:\s*var\(--radius-pill\)/);
  expect(css).toMatch(/\.fc \.fc-daygrid-more-link:hover\s*\{[^}]*text-decoration:\s*underline/);
});

test('the more link has a mint keyboard focus ring and is not clipped by its container', () => {
  expect(css).toMatch(/\.fc-daygrid-more-link:focus-visible\s*\{[^}]*var\(--color-mint\)/);
  expect(rule('.fc .fc-daygrid-day-bottom')).toMatch(/overflow:\s*visible/);
  expect(contrastRatio(t['--color-text'], t['--color-bg'])).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(t['--color-mint'], t['--color-bg'])).toBeGreaterThanOrEqual(3);
});

test('the more popover matches .popover, sits above the grid, and scrolls long lists', () => {
  const r = rule('.fc .fc-more-popover, .fc-more-popover');
  expect(r).toMatch(/background:\s*var\(--color-raised\)/);
  expect(r).toMatch(/box-shadow:\s*var\(--shadow-pop\)/);
  expect(r).toMatch(/border-radius:\s*var\(--radius-card\)/);
  expect(r).toMatch(/max-height:/);
  expect(parseInt(r.match(/z-index:\s*(\d+)/)![1], 10)).toBeGreaterThan(20); // date strip
  expect(parseInt(r.match(/z-index:\s*(\d+)/)![1], 10)).toBeLessThan(50); // dialogs
  expect(rule('.fc-more-popover .fc-popover-body')).toMatch(/overflow-y:\s*auto/);
});

test('popover title, close button and event rows are readable and reachable', () => {
  expect(css).toMatch(/\.fc-more-popover \.fc-popover-title[^{]*\{[^}]*color:\s*var\(--color-text\)/);
  expect(parseInt(rule('.fc-more-popover .fc-popover-close').match(/width:\s*(\d+)px/)![1], 10)).toBeGreaterThanOrEqual(32);
  expect(css).toMatch(/\.fc-more-popover \.fc-popover-close:focus-visible/);
  expect(css).toMatch(/\.fc-more-popover \.fc-daygrid-event \.conflict-badge\s*\{[^}]*font-size:\s*var\(--text-sm\)/);
  expect(contrastRatio(t['--color-text'], t['--color-raised'])).toBeGreaterThanOrEqual(4.5);
});
