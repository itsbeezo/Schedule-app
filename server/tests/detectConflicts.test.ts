import { detectConflicts, EventLike, ZoneLike, IgnoreLike } from '../src/conflicts/detectConflicts';
import { DateTime } from 'luxon';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';
const ev = (id: string, start: string, end: string): EventLike => ({
  id,
  start_at: new Date(start),
  end_at: new Date(end),
});
const zone = (start: string, end: string, weekly = false): ZoneLike => ({
  start_at: new Date(start),
  end_at: new Date(end),
  repeats_weekly: weekly,
});

describe('overlap detection', () => {
  test('no events, no conflicts', () => {
    expect(detectConflicts([], [], [], 'UTC')).toEqual({ active: [], ignored: [] });
  });

  test('overlapping events conflict with the exact overlap interval', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'), ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z')],
      [], [], 'UTC'
    );
    expect(r.active).toEqual([
      { eventAId: A, eventBId: B, overlapStart: new Date('2026-01-05T11:00Z'), overlapEnd: new Date('2026-01-05T12:00Z') },
    ]);
  });

  test('touching end-to-start is not a conflict', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-05T10:00Z', '2026-01-05T11:00Z'), ev(B, '2026-01-05T11:00Z', '2026-01-05T12:00Z')],
      [], [], 'UTC'
    );
    expect(r.active).toEqual([]);
  });

  test('a contained event conflicts for its whole length', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-05T09:00Z', '2026-01-05T17:00Z'), ev(B, '2026-01-05T12:00Z', '2026-01-05T13:00Z')],
      [], [], 'UTC'
    );
    expect(r.active[0].overlapStart).toEqual(new Date('2026-01-05T12:00Z'));
    expect(r.active[0].overlapEnd).toEqual(new Date('2026-01-05T13:00Z'));
  });

  test('three mutually overlapping events produce three pairs', () => {
    const r = detectConflicts(
      [
        ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'),
        ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
        ev(C, '2026-01-05T11:30Z', '2026-01-05T12:30Z'),
      ],
      [], [], 'UTC'
    );
    expect(r.active.map((c) => `${c.eventAId[0]}${c.eventBId[0]}`).sort()).toEqual(['ab', 'ac', 'bc']);
  });

  test('input order does not matter and pair ids are canonical', () => {
    const r = detectConflicts(
      [ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'), ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z')],
      [], [], 'UTC'
    );
    expect(r.active).toHaveLength(1);
    expect(r.active[0].eventAId).toBe(A);
    expect(r.active[0].eventBId).toBe(B);
  });

  test('an event spanning midnight conflicts with one on the next day', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-01T23:00Z', '2026-01-02T01:00Z'), ev(B, '2026-01-02T00:00Z', '2026-01-02T02:00Z')],
      [], [], 'UTC'
    );
    expect(r.active[0].overlapStart).toEqual(new Date('2026-01-02T00:00Z'));
    expect(r.active[0].overlapEnd).toEqual(new Date('2026-01-02T01:00Z'));
  });
});

describe('unconflicted zones', () => {
  const pair = [
    ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'),
    ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
  ]; // overlap 11:00-12:00

  test('a one-off zone containing the whole overlap suppresses the conflict entirely', () => {
    const r = detectConflicts(pair, [zone('2026-01-05T09:00Z', '2026-01-05T17:00Z')], [], 'UTC');
    expect(r).toEqual({ active: [], ignored: [] });
  });

  test('a zone that covers only part of the overlap does not suppress it', () => {
    const r = detectConflicts(pair, [zone('2026-01-05T09:00Z', '2026-01-05T11:30Z')], [], 'UTC');
    expect(r.active).toHaveLength(1);
  });

  test('a weekly zone suppresses the same weekday and time in later weeks', () => {
    const weekly = zone('2026-01-05T09:00Z', '2026-01-05T17:00Z', true); // Monday
    const nextMonday = [
      ev(A, '2026-01-12T10:00Z', '2026-01-12T12:00Z'),
      ev(B, '2026-01-12T11:00Z', '2026-01-12T13:00Z'),
    ];
    expect(detectConflicts(nextMonday, [weekly], [], 'UTC').active).toEqual([]);
  });

  test('a weekly zone does not apply on other weekdays', () => {
    const weekly = zone('2026-01-05T09:00Z', '2026-01-05T17:00Z', true);
    const tuesday = [
      ev(A, '2026-01-13T10:00Z', '2026-01-13T12:00Z'),
      ev(B, '2026-01-13T11:00Z', '2026-01-13T13:00Z'),
    ];
    expect(detectConflicts(tuesday, [weekly], [], 'UTC').active).toHaveLength(1);
  });

  test('a weekly zone does not apply to weeks before it was created', () => {
    const weekly = zone('2026-01-05T09:00Z', '2026-01-05T17:00Z', true);
    const before = [
      ev(A, '2025-12-29T10:00Z', '2025-12-29T12:00Z'),
      ev(B, '2025-12-29T11:00Z', '2025-12-29T13:00Z'),
    ];
    expect(detectConflicts(before, [weekly], [], 'UTC').active).toHaveLength(1);
  });

  test('a weekly zone keeps its local clock time across a daylight-saving change', () => {
    // Mon 09:00-17:00 New York in winter (EST) = 14:00Z-22:00Z.
    const weekly = zone('2026-03-02T14:00Z', '2026-03-02T22:00Z', true);
    // DST began Sun 2026-03-08, so Mon 03-09 09:00 local = 13:00Z. An overlap at 13:15Z-13:45Z is inside the zone.
    const afterDst = [
      ev(A, '2026-03-09T13:15Z', '2026-03-09T14:00Z'),
      ev(B, '2026-03-09T13:00Z', '2026-03-09T13:45Z'),
    ];
    expect(detectConflicts(afterDst, [weekly], [], 'America/New_York').active).toEqual([]);
  });
});

describe('ignores', () => {
  const pair = [
    ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'),
    ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
  ];
  const ignore = (over: Partial<IgnoreLike>): IgnoreLike => ({
    id: 'ign-1',
    event_a_id: A,
    event_b_id: B,
    mode: 'once',
    overlap_start: new Date('2026-01-05T11:00Z'),
    overlap_end: new Date('2026-01-05T12:00Z'),
    ...over,
  });

  test('"once" hides the conflict while the overlap is unchanged', () => {
    const r = detectConflicts(pair, [], [ignore({})], 'UTC');
    expect(r.active).toEqual([]);
    expect(r.ignored).toEqual([
      {
        eventAId: A, eventBId: B,
        overlapStart: new Date('2026-01-05T11:00Z'), overlapEnd: new Date('2026-01-05T12:00Z'),
        mode: 'once', ignoreId: 'ign-1',
      },
    ]);
  });

  test('"once" raises the conflict again when the overlap changes', () => {
    const moved = [
      ev(A, '2026-01-05T10:00Z', '2026-01-05T12:30Z'),
      ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
    ];
    const r = detectConflicts(moved, [], [ignore({})], 'UTC');
    expect(r.active).toHaveLength(1);
    expect(r.ignored).toEqual([]);
  });

  test('"allow" keeps hiding the conflict however the overlap changes', () => {
    const moved = [
      ev(A, '2026-01-05T10:00Z', '2026-01-05T12:30Z'),
      ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
    ];
    const r = detectConflicts(moved, [], [ignore({ mode: 'allow', overlap_start: null, overlap_end: null })], 'UTC');
    expect(r.active).toEqual([]);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0].mode).toBe('allow');
  });

  test('an ignore for events that no longer overlap does nothing', () => {
    const apart = [
      ev(A, '2026-01-05T10:00Z', '2026-01-05T11:00Z'),
      ev(B, '2026-01-05T12:00Z', '2026-01-05T13:00Z'),
    ];
    expect(detectConflicts(apart, [], [ignore({ mode: 'allow', overlap_start: null, overlap_end: null })], 'UTC'))
      .toEqual({ active: [], ignored: [] });
  });
});

describe('weekly zones across daylight saving (America/New_York)', () => {
  const NY = 'America/New_York';
  const HOUR = 60 * 60 * 1000;
  const MIN = 60 * 1000;
  // Wall-clock time in New York as an exact instant (luxon resolves the offset for that day).
  const ny = (iso: string) => DateTime.fromISO(iso, { zone: NY }).toJSDate();
  // Weekly Sat 22:00 -> Sun 06:00 zone, created on `createdSat` (a Saturday in a non-DST week).
  // Its elapsed length is 8h, so the end is start + 8h in absolute time, not 06:00 on the wall clock.
  const overnightWeekly = (createdSatIso: string): ZoneLike => {
    const start = ny(`${createdSatIso}T22:00`);
    return { start_at: start, end_at: new Date(start.getTime() + 8 * HOUR), repeats_weekly: true };
  };
  // Two events whose overlap is exactly [from, to]: A starts 30 min early, B ends 30 min late.
  const overlapOf = (from: Date, to: Date): EventLike[] => [
    { id: A, start_at: new Date(from.getTime() - 30 * MIN), end_at: to },
    { id: B, start_at: from, end_at: new Date(to.getTime() + 30 * MIN) },
  ];

  test('precondition: the zone is created on a Saturday and is still 8h long', () => {
    const z = overnightWeekly('2026-02-21');
    expect(DateTime.fromJSDate(z.start_at, { zone: NY }).weekday).toBe(6);
    expect(z.end_at.getTime() - z.start_at.getTime()).toBe(8 * HOUR);
  });

  test('spring forward: the zone ends at 07:00 EDT (elapsed 8h), so 06:30-07:00 is inside and 07:00-07:30 is outside', () => {
    const z = overnightWeekly('2026-02-21');
    // The 03-07 22:00 EST occurrence plus 8h of elapsed time is 07:00 EDT (the zone's record stays on its creation week).
    expect(ny('2026-03-08T07:00').getTime() - ny('2026-03-07T22:00').getTime()).toBe(8 * HOUR);

    const insideFrom = ny('2026-03-08T06:30');
    const boundary = ny('2026-03-08T07:00');
    const outsideTo = ny('2026-03-08T07:30');

    // The overlap 06:30-07:00 EDT is wholly inside the zone, so no conflict is raised.
    expect(detectConflicts(overlapOf(insideFrom, boundary), [z], [], NY)).toEqual({ active: [], ignored: [] });

    // The overlap 07:00-07:30 EDT starts exactly where the zone ends, so it is a conflict for its whole length.
    const r = detectConflicts(overlapOf(boundary, outsideTo), [z], [], NY);
    expect(r.active).toEqual([
      { eventAId: A, eventBId: B, overlapStart: boundary, overlapEnd: outsideTo },
    ]);
  });

  test('spring forward: an overlap straddling the 07:00 EDT end is not suppressed', () => {
    const z = overnightWeekly('2026-02-21');
    const r = detectConflicts(
      overlapOf(ny('2026-03-08T06:59'), ny('2026-03-08T07:01')),
      [z],
      [],
      NY
    );
    expect(r.active).toHaveLength(1);
    expect(r.active[0].overlapStart).toEqual(ny('2026-03-08T06:59'));
    expect(r.active[0].overlapEnd).toEqual(ny('2026-03-08T07:01'));
  });

  test('fall back: the zone ends at 05:00 EST (elapsed 8h), so 04:30-05:00 is inside and 05:00-05:30 is outside', () => {
    // Created Sat 2026-09-26 (EDT, no transition that week).
    const z = overnightWeekly('2026-09-26');
    // The 10-31 22:00 EDT occurrence plus 8h of elapsed time is 05:00 EST, after the repeated 01:00-02:00 hour.
    expect(ny('2026-11-01T05:00').getTime() - ny('2026-10-31T22:00').getTime()).toBe(8 * HOUR);
    expect(DateTime.fromJSDate(ny('2026-11-01T05:00'), { zone: NY }).offset).toBe(-5 * 60);

    const insideFrom = ny('2026-11-01T04:30');
    const boundary = ny('2026-11-01T05:00');
    const outsideTo = ny('2026-11-01T05:30');

    expect(detectConflicts(overlapOf(insideFrom, boundary), [z], [], NY)).toEqual({ active: [], ignored: [] });

    const r = detectConflicts(overlapOf(boundary, outsideTo), [z], [], NY);
    expect(r.active).toEqual([
      { eventAId: A, eventBId: B, overlapStart: boundary, overlapEnd: outsideTo },
    ]);
  });

  test('an ordinary week (no DST change) keeps the same wall-clock behavior: 05:30-06:00 inside, 06:00-06:30 outside', () => {
    // Created Sat 2026-06-06 (EDT all week).
    const z = overnightWeekly('2026-06-06');
    expect(z.end_at).toEqual(ny('2026-06-07T06:00'));

    expect(detectConflicts(overlapOf(ny('2026-06-07T05:30'), ny('2026-06-07T06:00')), [z], [], NY))
      .toEqual({ active: [], ignored: [] });

    const r = detectConflicts(overlapOf(ny('2026-06-07T06:00'), ny('2026-06-07T06:30')), [z], [], NY);
    expect(r.active).toHaveLength(1);
    expect(r.active[0].overlapStart).toEqual(ny('2026-06-07T06:00'));
  });
});
