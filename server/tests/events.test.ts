import request from 'supertest';
import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A, USER_B } from './helpers/db';
import { createApp } from '../src/app';

const appA = createApp({ pool: appPool, userId: USER_A });
const appB = createApp({ pool: appPool, userId: USER_B });
const valid = { title: 'Planning', start_at: '2026-01-05T10:00:00Z', end_at: '2026-01-05T11:00:00Z' };

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
beforeEach(() => ownerPool.query('TRUNCATE events CASCADE'));
afterAll(closePools);

describe('POST /api/events', () => {
  test('creates an event with defaults', async () => {
    const res = await request(appA).post('/api/events').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Planning', kind: 'event', color: null, source: 'local', user_id: USER_A });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.start_at).toBe('2026-01-05T10:00:00.000Z');
  });

  test('trims the title and accepts emoji and exactly 200 characters', async () => {
    const long = '🎉'.repeat(100); // 100 emoji = 200 UTF-16 code units
    const res = await request(appA).post('/api/events').send({ ...valid, title: `  ${long}  ` });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe(long);
  });

  test.each([
    ['empty title', { title: '   ' }],
    ['title over 200 characters', { title: 'x'.repeat(201) }],
    ['end before start', { end_at: '2026-01-05T09:00:00Z' }],
    ['end equal to start', { end_at: '2026-01-05T10:00:00Z' }],
    ['unparseable start', { start_at: 'not a date' }],
    ['bad color', { color: 'red' }],
    ['bad kind', { kind: 'meeting' }],
    ['non-string notes', { notes: 5 }],
  ])('rejects %s with the standard error shape', async (_name, patch) => {
    const res = await request(appA).post('/api/events').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(typeof res.body.error.message).toBe('string');
  });

  test.each(['title', 'start_at', 'end_at'])('rejects a missing %s', async (field) => {
    const body: Record<string, unknown> = { ...valid };
    delete body[field];
    const res = await request(appA).post('/api/events').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ field });
  });

  test.each(['#FF8A5B', '#ff8a5b', '#A8D4FF', '#9b6bff'])('rejects the reserved color %s', async (color) => {
    const res = await request(appA).post('/api/events').send({ ...valid, color });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('reserved_color');
  });

  test('accepts a non-reserved color, including one close to coral', async () => {
    const res = await request(appA).post('/api/events').send({ ...valid, color: '#FF8A5C' });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe('#FF8A5C');
  });

  test('rejects malformed JSON with the standard error shape', async () => {
    const res = await request(appA).post('/api/events').set('Content-Type', 'application/json').send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('GET /api/events', () => {
  test('returns events ordered by start time', async () => {
    await request(appA).post('/api/events').send({ ...valid, title: 'Later', start_at: '2026-01-05T14:00:00Z', end_at: '2026-01-05T15:00:00Z' });
    await request(appA).post('/api/events').send({ ...valid, title: 'Earlier' });
    const res = await request(appA).get('/api/events');
    expect(res.body.map((e: { title: string }) => e.title)).toEqual(['Earlier', 'Later']);
  });

  test('filters by from/to window using overlap', async () => {
    await request(appA).post('/api/events').send({ ...valid, title: 'Jan 5' });
    await request(appA).post('/api/events').send({ ...valid, title: 'Jan 20', start_at: '2026-01-20T10:00:00Z', end_at: '2026-01-20T11:00:00Z' });
    const res = await request(appA).get('/api/events?from=2026-01-05T10:30:00Z&to=2026-01-06T00:00:00Z');
    expect(res.body.map((e: { title: string }) => e.title)).toEqual(['Jan 5']);
  });

  test('rejects an invalid from', async () => {
    const res = await request(appA).get('/api/events?from=nope');
    expect(res.status).toBe(400);
  });

  test("never returns another user's events", async () => {
    await request(appB).post('/api/events').send({ ...valid, title: 'B only' });
    expect((await request(appA).get('/api/events')).body).toEqual([]);
  });
});

describe('PUT /api/events/:id', () => {
  test('updates fields and bumps updated_at', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ title: 'Renamed', color: '#4A63F0' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Renamed', color: '#4A63F0', start_at: created.start_at });
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(created.updated_at).getTime());
  });

  test('moves an event by changing both times', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    const res = await request(appA)
      .put(`/api/events/${created.id}`)
      .send({ start_at: '2026-01-06T10:00:00Z', end_at: '2026-01-06T11:15:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.end_at).toBe('2026-01-06T11:15:00.000Z');
  });

  test('rejects an update that makes the end earlier than the existing start', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ end_at: '2026-01-05T09:00:00Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  test('rejects the reserved color on update', async () => {
    const created = (await request(appA).post('/api/events').send({ ...valid, color: '#4A63F0' })).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ color: '#FF8A5B' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('reserved_color');
  });

  test('clears the color when null is sent', async () => {
    const created = (await request(appA).post('/api/events').send({ ...valid, color: '#4A63F0' })).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ color: null });
    expect(res.status).toBe(200);
    expect(res.body.color).toBeNull();
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(appA).put('/api/events/99999999-9999-4999-8999-999999999999').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  test("returns 404 for another user's event and leaves it unchanged", async () => {
    const created = (await request(appB).post('/api/events').send(valid)).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ title: 'hacked' });
    expect(res.status).toBe(404);
    const { rows } = await ownerPool.query('SELECT title FROM events WHERE id = $1', [created.id]);
    expect(rows[0].title).toBe('Planning');
  });

  test('returns 400 for an id that is not a UUID', async () => {
    const res = await request(appA).put('/api/events/abc').send({ title: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/events/:id', () => {
  test('deletes the event', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    expect((await request(appA).delete(`/api/events/${created.id}`)).status).toBe(204);
    expect((await request(appA).get('/api/events')).body).toEqual([]);
  });

  test('returns 404 for an unknown id', async () => {
    expect((await request(appA).delete('/api/events/99999999-9999-4999-8999-999999999999')).status).toBe(404);
  });

  test("returns 404 for another user's event and keeps it", async () => {
    const created = (await request(appB).post('/api/events').send(valid)).body;
    expect((await request(appA).delete(`/api/events/${created.id}`)).status).toBe(404);
    expect((await request(appB).get('/api/events')).body).toHaveLength(1);
  });
});

describe('database role', () => {
  test('the app pool is a non-owner role without BYPASSRLS', async () => {
    const { rows } = await appPool.query(
      `SELECT current_user AS u, r.rolbypassrls, r.rolsuper,
              (SELECT tableowner FROM pg_tables WHERE tablename = 'events') AS owner
       FROM pg_roles r WHERE r.rolname = current_user`
    );
    expect(rows[0].u).toBe('app_user');
    expect(rows[0].owner).not.toBe(rows[0].u);
    expect(rows[0].rolbypassrls).toBe(false);
    expect(rows[0].rolsuper).toBe(false);
  });
});
