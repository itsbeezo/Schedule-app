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
beforeEach(() => ownerPool.query('TRUNCATE events, conflict_zones CASCADE'));
afterAll(closePools);

const overlappingPair = async (app = appA) => ({
  a: await mk(app, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z'),
  b: await mk(app, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z'),
});

test('returns empty lists when there are no events', async () => {
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
});

test('reports an active conflict with ISO dates', async () => {
  const { a, b } = await overlappingPair();
  const res = await request(appA).get('/api/conflicts');
  expect(res.status).toBe(200);
  expect(res.body.active).toEqual([
    {
      eventAId: [a.id, b.id].sort()[0],
      eventBId: [a.id, b.id].sort()[1],
      overlapStart: '2026-01-05T11:00:00.000Z',
      overlapEnd: '2026-01-05T12:00:00.000Z',
    },
  ]);
});

test('a zone containing the overlap removes the conflict from both lists', async () => {
  await overlappingPair();
  await request(appA).post('/api/conflict-zones').send({ start_at: '2026-01-05T09:00:00Z', end_at: '2026-01-05T17:00:00Z' });
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
});

test("'once' moves the conflict to ignored until the overlap changes", async () => {
  const { a, b } = await overlappingPair();
  await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
  let body = (await request(appA).get('/api/conflicts')).body;
  expect(body.active).toEqual([]);
  expect(body.ignored[0].mode).toBe('once');
  await request(appA).put(`/api/events/${a.id}`).send({ end_at: '2026-01-05T12:30:00Z' });
  body = (await request(appA).get('/api/conflicts')).body;
  expect(body.active).toHaveLength(1);
  expect(body.ignored).toEqual([]);
});

test("'allow' stays ignored after the overlap changes", async () => {
  const { a, b } = await overlappingPair();
  await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
  await request(appA).put(`/api/events/${a.id}`).send({ end_at: '2026-01-05T12:30:00Z' });
  const body = (await request(appA).get('/api/conflicts')).body;
  expect(body.active).toEqual([]);
  expect(body.ignored[0].mode).toBe('allow');
  expect(typeof body.ignored[0].ignoreId).toBe('string');
});

test('a weekly zone uses the stored user timezone', async () => {
  await ownerPool.query(`UPDATE users SET timezone = 'America/New_York' WHERE id = $1`, [USER_A]);
  try {
    // Zone: Mondays 09:00-17:00 New York, created in winter (EST).
    await request(appA).post('/api/conflict-zones').send({
      start_at: '2026-03-02T14:00:00Z', end_at: '2026-03-02T22:00:00Z', repeats_weekly: true,
    });
    await mk(appA, 'A', '2026-03-09T13:15:00Z', '2026-03-09T14:00:00Z');
    await mk(appA, 'B', '2026-03-09T13:00:00Z', '2026-03-09T13:45:00Z');
    expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
  } finally {
    await ownerPool.query(`UPDATE users SET timezone = 'UTC' WHERE id = $1`, [USER_A]);
  }
});

test('the from/to window limits which events are considered', async () => {
  await overlappingPair();
  const out = await request(appA).get('/api/conflicts?from=2026-02-01T00:00:00Z&to=2026-02-08T00:00:00Z');
  expect(out.body).toEqual({ active: [], ignored: [] });
  const inside = await request(appA).get('/api/conflicts?from=2026-01-05T00:00:00Z&to=2026-01-06T00:00:00Z');
  expect(inside.body.active).toHaveLength(1);
});

test("never includes another user's events", async () => {
  await overlappingPair(appB);
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
});

test('rejects an invalid window', async () => {
  expect((await request(appA).get('/api/conflicts?from=garbage')).status).toBe(400);
});
