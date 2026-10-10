import { zonesToBackground } from './zoneBand';

const oneOff = { id: 'z1', start_at: new Date(2026, 9, 9, 9, 0).toISOString(), end_at: new Date(2026, 9, 9, 17, 0).toISOString(), repeats_weekly: false };
const weekly = { id: 'z2', start_at: new Date(2026, 9, 5, 9, 0).toISOString(), end_at: new Date(2026, 9, 5, 17, 0).toISOString(), repeats_weekly: true }; // Monday

test('a one-off zone inside the range becomes one labelled band', () => {
  const bands = zonesToBackground([oneOff], new Date(2026, 9, 5), new Date(2026, 9, 12));
  expect(bands).toHaveLength(1);
  expect(bands[0]).toMatchObject({ display: 'background', classNames: ['cal-zone'], title: 'Conflicts off' });
  expect(bands[0].start).toEqual(new Date(2026, 9, 9, 9, 0));
  expect(bands[0].end).toEqual(new Date(2026, 9, 9, 17, 0));
});

test('a one-off zone outside the range is not shown', () => {
  expect(zonesToBackground([oneOff], new Date(2026, 9, 12), new Date(2026, 9, 19))).toEqual([]);
});

test('a weekly zone repeats on the same weekday with the same clock times', () => {
  const bands = zonesToBackground([weekly], new Date(2026, 9, 5), new Date(2026, 9, 19));
  expect(bands.map((b) => b.start)).toEqual([new Date(2026, 9, 5, 9, 0), new Date(2026, 9, 12, 9, 0)]);
  expect(bands.map((b) => b.end)).toEqual([new Date(2026, 9, 5, 17, 0), new Date(2026, 9, 12, 17, 0)]);
});

test('a weekly zone does not appear in weeks before it was created', () => {
  expect(zonesToBackground([weekly], new Date(2026, 8, 21), new Date(2026, 9, 5))).toEqual([]);
});

test('a weekly zone that runs past midnight ends on the next day', () => {
  const night = { id: 'z3', start_at: new Date(2026, 9, 5, 22, 0).toISOString(), end_at: new Date(2026, 9, 6, 2, 0).toISOString(), repeats_weekly: true };
  const [band] = zonesToBackground([night], new Date(2026, 9, 12), new Date(2026, 9, 19));
  expect(band.start).toEqual(new Date(2026, 9, 12, 22, 0));
  expect(band.end).toEqual(new Date(2026, 9, 13, 2, 0));
});

test('every band has a unique id', () => {
  const ids = zonesToBackground([weekly, oneOff], new Date(2026, 9, 5), new Date(2026, 9, 19)).map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
});
