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

test.each(['.date-strip__day', '.date-strip__title', '.date-strip .btn.date-strip__today'])('%s touch target is at least 44px', (sel) => {
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

test('the header title is masked while open: visibility hidden (keeps layout space), never display:none', () => {
  const r = rule('.date-strip__title--masked');
  expect(r).toMatch(/visibility:\s*hidden/);
  expect(r).not.toMatch(/display:\s*none/);
});

test('the picker title is visible, centered between the arrows, 44px, header type, instant, with focus ring', () => {
  const r = rule('.date-strip__picker-title');
  expect(r).not.toMatch(/clip|position:\s*absolute|overflow:\s*hidden|width:\s*1px/);
  expect(r).toMatch(/flex:\s*1/);
  expect(r).toMatch(/justify-content:\s*center/);
  expect(px(r, 'min-height')).toBeGreaterThanOrEqual(44);
  const h = rule('.date-strip__title');
  for (const prop of ['font-size', 'font-weight', 'color']) {
    expect(r.match(new RegExp(`${prop}:\\s*([^;]+);`))![1]).toBe(h.match(new RegExp(`${prop}:\\s*([^;]+);`))![1]);
  }
  expect(r).toMatch(/border:\s*0/);
  expect(r).toMatch(/transition:\s*none/);
  expect(r).not.toMatch(/opacity/);
  expect(css).toMatch(/\.date-strip__picker-title:hover/);
  expect(css).toMatch(/\.date-strip__picker-title:focus-visible\s*\{[^}]*var\(--focus-ring\)/);
  expect(css).toMatch(/\.date-strip__picker-title\[aria-expanded='true'\] \.date-strip__chevron\s*\{[^}]*rotate\(180deg\)/);
});

test('the sr-only live span is visually hidden with the clip technique, not display:none', () => {
  const r = rule('.date-strip__sr-only');
  expect(r).toMatch(/clip/);
  expect(r).not.toMatch(/display:\s*none/);
});

test('the month title pill stays inside the page gutter: no negative left margin', () => {
  const r = rule('.date-strip__title');
  expect(r).not.toMatch(/margin-left:\s*calc\(.*\* -1\)/);
  expect(r).not.toMatch(/margin(-left)?:\s*-/);
  expect(r).not.toMatch(/margin:\s*[^;]*\s-\d+px\s+(-\d+px|\d)/);
});

test('Today is a quiet ghost: transparent fill and border, token text color, 44px target, token focus ring', () => {
  const r = rule('.date-strip .btn.date-strip__today');
  expect(r).toMatch(/background:\s*transparent/);
  expect(r).toMatch(/border-color:\s*transparent/);
  expect(r).toMatch(/color:\s*var\(--color-light-blue\)/); // contrast pair light-blue on bg is asserted in componentContrast
  expect(css).toMatch(/\.date-strip \.btn\.date-strip__today:focus-visible\s*\{[^}]*var\(--focus-ring\)/);
});

test('the strip is compact: no vertical padding above, 4px below, and title/Today tap areas overhang instead of adding height', () => {
  const r = rule('.date-strip');
  expect(r).toMatch(/padding:\s*0 var\(--space-1\) var\(--space-half\)/);
  expect(rule('.date-strip__title')).toMatch(/margin:\s*calc\(var\(--space-half\) \* -1\) 0/);
});
