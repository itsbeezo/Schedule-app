import { fromZonedInput, nextHourIn, todayIn, toZonedInput, formatTimeIn, dateOnlyString } from './timezone';

const ZONES = ['Asia/Tokyo', 'America/New_York', 'UTC'];

test.each(ZONES)('wall clock -> UTC -> wall clock round-trips in %s', (tz) => {
  for (const v of ['2026-10-06T09:00', '2026-01-15T23:45', '2026-07-01T00:00']) {
    expect(toZonedInput(fromZonedInput(v, tz)!, tz)).toBe(v);
  }
});

test('the same wall clock is a different instant per zone', () => {
  expect(fromZonedInput('2026-10-06T09:00', 'Asia/Tokyo')!.toISOString()).toBe('2026-10-06T00:00:00.000Z');
  expect(fromZonedInput('2026-10-06T09:00', 'America/New_York')!.toISOString()).toBe('2026-10-06T13:00:00.000Z');
  expect(toZonedInput(new Date('2026-10-06T00:00:00Z'), 'Asia/Tokyo')).toBe('2026-10-06T09:00');
});

test('spring-forward day in New York keeps real elapsed time', () => {
  // 2026-03-08: clocks jump 02:00 -> 03:00 EDT.
  expect(fromZonedInput('2026-03-07T09:00', 'America/New_York')!.toISOString()).toBe('2026-03-07T14:00:00.000Z');
  expect(fromZonedInput('2026-03-08T09:00', 'America/New_York')!.toISOString()).toBe('2026-03-08T13:00:00.000Z');
  const start = fromZonedInput('2026-03-08T01:00', 'America/New_York')!;
  const end = fromZonedInput('2026-03-08T03:00', 'America/New_York')!;
  expect(end.getTime() - start.getTime()).toBe(3600000);
  expect(toZonedInput(end, 'America/New_York')).toBe('2026-03-08T03:00');
});

test('fall-back day in New York: 01:30 EDT and 01:30 EST are an hour apart in UTC', () => {
  expect(toZonedInput(new Date('2026-11-01T05:30:00Z'), 'America/New_York')).toBe('2026-11-01T01:30');
  expect(toZonedInput(new Date('2026-11-01T06:30:00Z'), 'America/New_York')).toBe('2026-11-01T01:30');
  expect(fromZonedInput('2026-11-01T12:00', 'America/New_York')!.toISOString()).toBe('2026-11-01T17:00:00.000Z');
});

test('fromZonedInput rejects junk', () => {
  expect(fromZonedInput('', 'UTC')).toBeNull();
  expect(fromZonedInput('nope', 'UTC')).toBeNull();
});

test('today and the next hour are read in the given zone, not the device zone', () => {
  const now = new Date('2026-10-06T20:30:00Z'); // 05:30 on the 7th in Tokyo, 16:30 on the 6th in New York
  expect(dateOnlyString(todayIn('Asia/Tokyo', now))).toBe('2026-10-07');
  expect(dateOnlyString(todayIn('America/New_York', now))).toBe('2026-10-06');
  expect(nextHourIn('Asia/Tokyo', now).toISOString()).toBe('2026-10-06T21:00:00.000Z');
  expect(nextHourIn('America/New_York', new Date('2026-10-06T03:59:00Z')).toISOString()).toBe('2026-10-06T04:00:00.000Z');
});

test('formatTimeIn formats in the zone', () => {
  expect(formatTimeIn(new Date('2026-10-06T00:00:00Z'), 'Asia/Tokyo')).toMatch(/9:00\s?AM/);
});
