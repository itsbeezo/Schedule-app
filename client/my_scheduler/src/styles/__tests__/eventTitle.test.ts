import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '..', 'calendar.css'), 'utf8');
// body of the half-hour-row container query (max-height: 40px), the first one that sets the row layout
const block = css.match(/@container \(max-height: 40px\) \{([\s\S]*?)\n\}/)![1];

test('in half-hour rows the title stays on one line and ellipsizes (no wrapped second line)', () => {
  const rule = block.match(/\.fc \.fc-event-title \{([^}]*)\}/)![1];
  expect(rule).toMatch(/white-space:\s*nowrap/);
  expect(rule).toMatch(/overflow:\s*hidden/);
  expect(rule).toMatch(/text-overflow:\s*ellipsis/);
  // a flex item will not shrink below its longest word unless min-width is 0
  expect(rule).toMatch(/min-width:\s*0/);
});

test('in half-hour rows the time never shrinks or wraps', () => {
  expect(block).toMatch(/\.fc-event-time \{[^}]*white-space:\s*nowrap[^}]*flex:\s*none/);
});
