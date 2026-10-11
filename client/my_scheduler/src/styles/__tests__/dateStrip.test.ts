import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '..', 'date-strip.css'), 'utf8');
const rule = (sel: string) => {
  const esc = sel.replace(/[.[\]()'=-]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)${esc}[^{]*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule for ${sel}`);
  return m[1];
};
const px = (decl: string, prop: string) => parseInt(decl.match(new RegExp(`(?:^|[\\s;])${prop}:\\s*(\\d+)px`))![1], 10);

test.each(['.date-strip__day', '.date-strip__title', '.date-strip__today'])('%s touch target is at least 44px', (sel) => {
  const r = rule(sel);
  expect(px(r, sel === '.date-strip__day' ? 'height' : 'min-height')).toBeGreaterThanOrEqual(44);
  expect(px(r, sel === '.date-strip__day' ? 'width' : 'min-width')).toBeGreaterThanOrEqual(44);
});

test('picker month buttons are 44px', () => {
  expect(px(rule('.date-strip__picker-nav .btn'), 'min-height')).toBeGreaterThanOrEqual(44);
});

test('selected is never colour alone: bold + underline; today has a ring and a dot', () => {
  expect(css).toMatch(/\.date-strip__day--selected[^{]*\{[^}]*font-weight:\s*700/);
  expect(css).toMatch(/\.date-strip__day--selected \.date-strip__num\s*\{[^}]*text-decoration:\s*underline/);
  expect(rule('.date-strip__day--today')).toMatch(/border-color/);
  expect(css).toMatch(/\.date-strip__day--today::after/);
});

test('the week row and picker rows are 7 shrinkable columns (no horizontal scroll at 360px)', () => {
  expect(rule('.date-strip__week')).toMatch(/repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  expect(css).toMatch(/\.date-strip__row\s*\{[^}]*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  // 7 x 44px = 308px fits a 360px screen minus 8px phone page padding each side (344px)
  expect(7 * 44).toBeLessThanOrEqual(360 - 2 * 8);
});

test('uses tokens only: no raw hex colors', () => {
  expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
});

test("the chevron rotates when aria-expanded and the focus ring is the token", () => {
  expect(css).toMatch(/\[aria-expanded='true'\] \.date-strip__chevron\s*\{[^}]*rotate/);
  expect(css).toMatch(/:focus-visible[^{]*\{[^}]*var\(--focus-ring\)/);
});

test('the day header is visually hidden on the phone day view, not display:none (screen readers keep it)', () => {
  const m = css.match(/\.fc-timeGridDay-view \.fc-col-header-cell-cushion\s*\{([^}]*)\}/)![1];
  expect(m).toMatch(/clip/);
  expect(m).not.toMatch(/display:\s*none/);
});
