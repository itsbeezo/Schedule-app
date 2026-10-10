import request from 'supertest';
import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A, USER_B } from './helpers/db';
import { createApp } from '../src/app';

const appA = createApp({ pool: appPool, userId: USER_A });
const appB = createApp({ pool: appPool, userId: USER_B });

const mk = async (app: typeof appA, title: string, start: string, end: string) =>
  (await request(app).post('/api/events').send({ title, start_at: start, end_at: end })).body;

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
beforeEach(() => ownerPool.query('TRUNCATE events, work_hours, conflict_zones CASCADE'));
afterAll(closePools);

describe('work hours', () => {
  const body = { workHours: [
    { weekday: 1, start_time: '09:00', end_time: '17:00' },
    { weekday: 2, start_time: '09:30', end_time: '12:00' },
    { weekday: 2, start_time: '13:00', end_time: '17:30' },
  ] };

  test('PUT replaces the full set and GET returns it ordered', async () => {
    await request(appA).put('/api/work-hours').send({ workHours: [{ weekday: 5, start_time: '08:00', end_time: '10:00' }] });
    const put = await request(appA).put('/api/work-hours').send(body);
    expect(put.status).toBe(200);
    expect((await request(appA).get('/api/work-hours')).body).toEqual(body.workHours);
  });

  test('PUT with an empty list clears work hours', async () => {
    await request(appA).put('/api/work-hours').send(body);
    await request(appA).put('/api/work-hours').send({ workHours: [] });
    expect((await request(appA).get('/api/work-hours')).body).toEqual([]);
  });

  test.each([
    ['weekday 7', { weekday: 7, start_time: '09:00', end_time: '10:00' }],
    ['bad time', { weekday: 1, start_time: '9am', end_time: '10:00' }],
    ['end before start', { weekday: 1, start_time: '10:00', end_time: '09:00' }],
  ])('rejects %s', async (_n, entry) => {
    const res = await request(appA).put('/api/work-hours').send({ workHours: [entry] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  test('rejects overlapping ranges on the same weekday', async () => {
    const res = await request(appA).put('/api/work-hours').send({ workHours: [
      { weekday: 1, start_time: '09:00', end_time: '12:00' },
      { weekday: 1, start_time: '11:00', end_time: '13:00' },
    ] });
    expect(res.status).toBe(400);
  });

  test('rejects a body without workHours', async () => {
    expect((await request(appA).put('/api/work-hours').send({})).status).toBe(400);
  });

  test("a failed PUT keeps the previous set, and users do not see each other's", async () => {
    await request(appA).put('/api/work-hours').send(body);
    await request(appA).put('/api/work-hours').send({ workHours: [{ weekday: 9, start_time: '09:00', end_time: '10:00' }] });
    expect((await request(appA).get('/api/work-hours')).body).toEqual(body.workHours);
    expect((await request(appB).get('/api/work-hours')).body).toEqual([]);
  });
});

describe('conflict zones', () => {
  const zone = { start_at: '2026-01-05T09:00:00Z', end_at: '2026-01-05T17:00:00Z' };

  test('creates, lists, and deletes a zone', async () => {
    const created = await request(appA).post('/api/conflict-zones').send({ ...zone, repeats_weekly: true });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ repeats_weekly: true, user_id: USER_A });
    expect((await request(appA).get('/api/conflict-zones')).body).toHaveLength(1);
    expect((await request(appA).delete(`/api/conflict-zones/${created.body.id}`)).status).toBe(204);
    expect((await request(appA).get('/api/conflict-zones')).body).toEqual([]);
  });

  test('repeats_weekly defaults to false', async () => {
    expect((await request(appA).post('/api/conflict-zones').send(zone)).body.repeats_weekly).toBe(false);
  });

  test.each([
    ['end before start', { start_at: zone.end_at, end_at: zone.start_at }],
    ['bad date', { start_at: 'x', end_at: zone.end_at }],
    ['non-boolean repeats_weekly', { ...zone, repeats_weekly: 'yes' }],
  ])('rejects %s', async (_n, payload) => {
    expect((await request(appA).post('/api/conflict-zones').send(payload)).status).toBe(400);
  });

  test("404 when deleting another user's zone", async () => {
    const z = (await request(appB).post('/api/conflict-zones').send(zone)).body;
    expect((await request(appA).delete(`/api/conflict-zones/${z.id}`)).status).toBe(404);
  });
});

describe('conflict ignores', () => {
  test("'once' stores the current overlap interval", async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const res = await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
    expect(res.status).toBe(201);
    expect(res.body.overlap_start).toBe('2026-01-05T11:00:00.000Z');
    expect(res.body.overlap_end).toBe('2026-01-05T12:00:00.000Z');
  });

  test("'allow' stores no interval, and ids are stored in canonical order whichever way they are sent", async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const res = await request(appA).post('/api/conflict-ignores').send({ eventAId: hi, eventBId: lo, mode: 'allow' });
    expect(res.body).toMatchObject({ event_a_id: lo, event_b_id: hi, mode: 'allow', overlap_start: null, overlap_end: null });
  });

  test('posting the same pair again replaces the earlier choice', async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
    const list = (await request(appA).get('/api/conflict-ignores')).body;
    expect(list).toHaveLength(1);
    expect(list[0].mode).toBe('allow');
  });

  test('the list includes event titles', async () => {
    const a = await mk(appA, 'Alpha', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'Beta', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
    const [row] = (await request(appA).get('/api/conflict-ignores')).body;
    expect([row.event_a_title, row.event_b_title].sort()).toEqual(['Alpha', 'Beta']);
  });

  test('rejects events that do not overlap, the same id twice, and a bad mode', async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T12:00:00Z', '2026-01-05T13:00:00Z');
    const none = await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('no_overlap');
    expect((await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: a.id, mode: 'once' })).status).toBe(400);
    expect((await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'maybe' })).status).toBe(400);
  });

  test("404 when either event belongs to another user", async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const bOther = await mk(appB, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const res = await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: bOther.id, mode: 'allow' });
    expect(res.status).toBe(404);
  });

  test('delete removes the choice; deleting an event removes its ignores', async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const ig = (await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' })).body;
    expect((await request(appA).delete(`/api/conflict-ignores/${ig.id}`)).status).toBe(204);
    expect((await request(appA).get('/api/conflict-ignores')).body).toEqual([]);
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
    await request(appA).delete(`/api/events/${a.id}`);
    expect((await request(appA).get('/api/conflict-ignores')).body).toEqual([]);
  });
});
