import { dayLengthHours, dstNoteFor } from './timezone';

const NY = 'America/New_York';

test('day length is 23h at spring-forward, 25h at fall-back, else 24h', () => {
  expect(dayLengthHours({ y: 2026, m: 2, d: 8 }, NY)).toBe(23);
  expect(dayLengthHours({ y: 2026, m: 10, d: 1 }, NY)).toBe(25);
  expect(dayLengthHours({ y: 2026, m: 5, d: 10 }, NY)).toBe(24);
});

test('notes appear only on the clock-change days', () => {
  expect(dstNoteFor({ y: 2026, m: 2, d: 8 }, NY)?.text).toBe('Clocks forward 1h');
  expect(dstNoteFor({ y: 2026, m: 2, d: 8 }, NY)?.explanation).toMatch(/forward 1 hour.*starts/);
  expect(dstNoteFor({ y: 2026, m: 10, d: 1 }, NY)?.text).toBe('Clocks back 1h');
  expect(dstNoteFor({ y: 2026, m: 10, d: 1 }, NY)?.explanation).toMatch(/back 1 hour.*ends/);
  expect(dstNoteFor({ y: 2026, m: 2, d: 9 }, NY)).toBeNull();
});

test('UTC and Tokyo never have a note', () => {
  for (const tz of ['UTC', 'Asia/Tokyo']) {
    for (const c of [{ y: 2026, m: 2, d: 8 }, { y: 2026, m: 10, d: 1 }, { y: 2026, m: 2, d: 29 }]) {
      expect(dstNoteFor(c, tz)).toBeNull();
    }
  }
});
