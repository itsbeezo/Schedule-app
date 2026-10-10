import { RESERVED_COLORS, isReservedColor } from '../reservedColors';

test('the reserved colors are coral, work-hours light blue, and UI purple', () => {
  expect([...RESERVED_COLORS].sort()).toEqual(['#9B6BFF', '#A8D4FF', '#FF8A5B']);
});

test.each(['#FF8A5B', '#ff8a5b', ' #a8d4ff ', '#9B6BFF'])('%s is reserved (any case, trimmed)', (c) => {
  expect(isReservedColor(c)).toBe(true);
});

test.each(['#FF8A5C', '#4A63F0', '', null, undefined])('%s is not reserved', (c) => {
  expect(isReservedColor(c as string | null | undefined)).toBe(false);
});
