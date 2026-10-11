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

describe('saved time zone', () => {
  const NY = 'America/New_York';
  // A Friday 9-17 New York weekly zone, first created Fri 2026-10-02 (EDT, UTC-4).
  const fri = { id: 'z9', start_at: '2026-10-02T13:00:00.000Z', end_at: '2026-10-02T21:00:00.000Z', repeats_weekly: true };

  test('lands at the right instants in a zone different from the browser zone', () => {
    const bands = zonesToBackground([fri], new Date('2026-10-04T00:00:00Z'), new Date('2026-10-18T00:00:00Z'), NY);
    expect(bands.map((b) => b.start.toISOString())).toEqual(['2026-10-09T13:00:00.000Z', '2026-10-16T13:00:00.000Z']);
    expect(bands.map((b) => b.end.toISOString())).toEqual(['2026-10-09T21:00:00.000Z', '2026-10-16T21:00:00.000Z']);
  });

  test('keeps 9:00 local across the DST end (Nov 1 2026): Oct 30 is EDT, Nov 6 is EST', () => {
    const bands = zonesToBackground([fri], new Date('2026-10-26T00:00:00Z'), new Date('2026-11-09T00:00:00Z'), NY);
    expect(bands.map((b) => b.start.toISOString())).toEqual(['2026-10-30T13:00:00.000Z', '2026-11-06T14:00:00.000Z']);
    expect(bands.map((b) => b.end.toISOString())).toEqual(['2026-10-30T21:00:00.000Z', '2026-11-06T22:00:00.000Z']);
  });

  test('a band running past midnight in the saved zone ends on the next local day', () => {
    const night = { id: 'z8', start_at: '2026-10-03T02:00:00.000Z', end_at: '2026-10-03T06:00:00.000Z', repeats_weekly: true }; // Fri 22:00 - Sat 02:00 EDT
    const [band] = zonesToBackground([night], new Date('2026-10-30T00:00:00Z'), new Date('2026-11-03T00:00:00Z'), NY);
    expect(band.start.toISOString()).toBe('2026-10-31T02:00:00.000Z'); // Fri Oct 30 22:00 EDT is Sat 02:00Z
    expect(band.end.toISOString()).toBe('2026-10-31T06:00:00.000Z');
  });

  test('uses the saved zone weekday, not the browser weekday (Tokyo Monday 09:00 is Sunday in UTC)', () => {
    const mon = { id: 'z7', start_at: '2026-10-05T00:00:00.000Z', end_at: '2026-10-05T08:00:00.000Z', repeats_weekly: true }; // Mon 09-17 JST
    const bands = zonesToBackground([mon], new Date('2026-10-11T00:00:00Z'), new Date('2026-10-14T00:00:00Z'), 'Asia/Tokyo');
    expect(bands.map((b) => b.start.toISOString())).toEqual(['2026-10-12T00:00:00.000Z']);
  });
});
