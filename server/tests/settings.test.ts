import request from 'supertest';
import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A, USER_B } from './helpers/db';
import { createApp } from '../src/app';

const appA = createApp({ pool: appPool, userId: USER_A });
const appB = createApp({ pool: appPool, userId: USER_B });

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
beforeEach(async () => {
  await ownerPool.query('TRUNCATE events, conflict_zones CASCADE');
  await ownerPool.query(`UPDATE users SET timezone = 'UTC'`);
});
afterAll(closePools);

test('GET returns the saved timezone', async () => {
  const res = await request(appA).get('/api/settings');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ timezone: 'UTC' });
});

test('PUT saves and returns the timezone', async () => {
  const put = await request(appA).put('/api/settings').send({ timezone: 'America/New_York' });
  expect(put.status).toBe(200);
  expect(put.body).toEqual({ timezone: 'America/New_York' });
  expect((await request(appA).get('/api/settings')).body).toEqual({ timezone: 'America/New_York' });
});

test.each([['Mars/Base'], [''], ['   '], [42], [null], [undefined]])('rejects invalid timezone %p', async (tz) => {
  const res = await request(appA).put('/api/settings').send({ timezone: tz });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('validation_error');
  expect(res.body.error.message).toMatch(/timezone/);
  expect((await request(appA).get('/api/settings')).body).toEqual({ timezone: 'UTC' });
});

test("user A cannot change user B's timezone", async () => {
  await request(appA).put('/api/settings').send({ timezone: 'Asia/Tokyo' });
  expect((await request(appB).get('/api/settings')).body).toEqual({ timezone: 'UTC' });
  const { rows } = await ownerPool.query('SELECT id, timezone FROM users WHERE id = $1', [USER_B]);
  expect(rows[0].timezone).toBe('UTC');
});

test('changing the timezone changes weekly-zone conflict suppression', async () => {
  // Friday zone created in winter at 14:00-22:00Z (09:00-17:00 EST).
  await request(appA).post('/api/conflict-zones').send({
    start_at: '2026-02-06T14:00:00Z', end_at: '2026-02-06T22:00:00Z', repeats_weekly: true,
  });
  // In April (EDT) the New York zone is 13:00-21:00Z; the UTC zone stays 14:00-22:00Z.
  for (const [t, s, e] of [['A', '13:15', '14:00'], ['B', '13:00', '13:45']]) {
    await request(appA).post('/api/events').send({
      title: t, start_at: `2026-04-10T${s}:00Z`, end_at: `2026-04-10T${e}:00Z`,
    });
  }
  expect((await request(appA).get('/api/conflicts')).body.active).toHaveLength(1);
  await request(appA).put('/api/settings').send({ timezone: 'America/New_York' });
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
  await request(appA).put('/api/settings').send({ timezone: 'UTC' });
  expect((await request(appA).get('/api/conflicts')).body.active).toHaveLength(1);
});
