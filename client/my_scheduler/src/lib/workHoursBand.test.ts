import { workHoursToBackground } from './workHoursBand';

const wh = [
  { weekday: 1, start_time: '09:00', end_time: '17:00' },
  { weekday: 2, start_time: '09:30', end_time: '12:00' },
  { weekday: 2, start_time: '13:00', end_time: '17:30' },
];

test('creates one band per matching weekday in the range', () => {
  // Mon 2026-10-05 through Sun 2026-10-11 (local time)
  const bands = workHoursToBackground(wh, new Date(2026, 9, 5), new Date(2026, 9, 12));
  expect(bands).toHaveLength(3);
  expect(bands[0].start).toEqual(new Date(2026, 9, 5, 9, 0));
  expect(bands[0].end).toEqual(new Date(2026, 9, 5, 17, 0));
  expect(bands[1].start).toEqual(new Date(2026, 9, 6, 9, 30));
  expect(bands.every((b) => b.display === 'background' && b.classNames.includes('cal-work-hours'))).toBe(true);
});

test('repeats across multiple weeks and gives each band a unique id', () => {
  const bands = workHoursToBackground(wh, new Date(2026, 9, 5), new Date(2026, 9, 19));
  expect(bands).toHaveLength(6);
  expect(new Set(bands.map((b) => b.id)).size).toBe(6);
});

test('returns nothing when there are no work hours or the range is empty', () => {
  expect(workHoursToBackground([], new Date(2026, 9, 5), new Date(2026, 9, 12))).toEqual([]);
  expect(workHoursToBackground(wh, new Date(2026, 9, 5), new Date(2026, 9, 5))).toEqual([]);
});

test('keeps the local clock time across a daylight-saving change', () => {
  // The browser's local zone decides DST; the band must still start at 09:00 local on every Monday.
  const bands = workHoursToBackground(
    [{ weekday: 1, start_time: '09:00', end_time: '10:00' }],
    new Date(2026, 2, 2), new Date(2026, 2, 16)
  );
  expect(bands.map((b) => b.start.getHours())).toEqual([9, 9]);
});

describe('saved time zone', () => {
  const fri = [{ weekday: 5, start_time: '09:00', end_time: '17:00' }];

  test('Friday 9-17 in New York lands at the right instants', () => {
    const bands = workHoursToBackground(fri, new Date('2026-10-04T00:00:00Z'), new Date('2026-10-11T00:00:00Z'), 'America/New_York');
    expect(bands).toHaveLength(1);
    expect(bands[0].start.toISOString()).toBe('2026-10-09T13:00:00.000Z');
    expect(bands[0].end.toISOString()).toBe('2026-10-09T21:00:00.000Z');
  });

  test('DST end week shifts the UTC instant but not the local hour', () => {
    const bands = workHoursToBackground(fri, new Date('2026-10-26T00:00:00Z'), new Date('2026-11-09T00:00:00Z'), 'America/New_York');
    expect(bands.map((b) => b.start.toISOString())).toEqual(['2026-10-30T13:00:00.000Z', '2026-11-06T14:00:00.000Z']);
  });

  test('a day that is Friday in Tokyo but Thursday in UTC is matched in the saved zone', () => {
    const bands = workHoursToBackground(fri, new Date('2026-10-08T12:00:00Z'), new Date('2026-10-09T12:00:00Z'), 'Asia/Tokyo');
    expect(bands.map((b) => b.start.toISOString())).toEqual(['2026-10-09T00:00:00.000Z']);
  });
});
