import { addDays, addMonths, isSameDay, monthGrid, weekDays } from './dateStrip';

test('weekDays returns Sunday..Saturday around the date, across a month boundary', () => {
  const w = weekDays(new Date(2026, 9, 31)); // Saturday
  expect(w).toHaveLength(7);
  expect(w[0]).toEqual(new Date(2026, 9, 25));
  expect(w[6]).toEqual(new Date(2026, 9, 31));
  expect(weekDays(new Date(2026, 10, 1))[0]).toEqual(new Date(2026, 10, 1)); // Sunday starts its own week
});

test('monthGrid covers the whole month in whole weeks', () => {
  const g = monthGrid(new Date(2026, 9, 11));
  expect(g.every((r) => r.length === 7)).toBe(true);
  expect(g[0][0]).toEqual(new Date(2026, 8, 27));
  expect(g[g.length - 1][6]).toEqual(new Date(2026, 9, 31));
  expect(g.flat().filter((d) => d.getMonth() === 9)).toHaveLength(31);
});

test('addDays / addMonths / isSameDay handle month and year rollover', () => {
  expect(addDays(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 1));
  expect(addMonths(new Date(2026, 0, 31), -1)).toEqual(new Date(2025, 11, 1));
  expect(isSameDay(new Date(2026, 9, 1, 3), new Date(2026, 9, 1, 23))).toBe(true);
  expect(isSameDay(new Date(2026, 9, 1), new Date(2026, 9, 2))).toBe(false);
});
