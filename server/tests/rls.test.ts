import { appPool, ownerPool, resetDb, closePools, USER_A, USER_B } from './helpers/db';
import { withUser, ensureUser } from '../src/db';

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '33333333-3333-4333-8333-333333333333';
const B1 = '22222222-2222-4222-8222-222222222222';
const B2 = '44444444-4444-4444-8444-444444444444';

beforeAll(async () => {
  await resetDb();
  await ownerPool.query(`INSERT INTO users(id, timezone) VALUES ($1, 'UTC'), ($2, 'UTC')`, [USER_A, USER_B]);
  for (const [id, user] of [[A1, USER_A], [A2, USER_A], [B1, USER_B], [B2, USER_B]]) {
    await ownerPool.query(
      `INSERT INTO events(id, user_id, title, start_at, end_at)
       VALUES ($1, $2, 'e', '2026-01-01T10:00Z', '2026-01-01T11:00Z')`,
      [id, user]
    );
  }
  await ownerPool.query(
    `INSERT INTO work_hours(user_id, weekday, start_time, end_time) VALUES ($1, 1, '09:00', '17:00'), ($2, 1, '10:00', '18:00')`,
    [USER_A, USER_B]
  );
  await ownerPool.query(
    `INSERT INTO conflict_zones(user_id, start_at, end_at) VALUES ($1, '2026-01-01T09:00Z', '2026-01-01T17:00Z'), ($2, '2026-01-01T09:00Z', '2026-01-01T17:00Z')`,
    [USER_A, USER_B]
  );
  await ownerPool.query(
    `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode) VALUES ($1, $2, $3, 'allow'), ($4, $5, $6, 'allow')`,
    [USER_A, A1, A2, USER_B, B1, B2]
  );
});
afterAll(closePools);

test('the app connects as a role that cannot bypass RLS', async () => {
  const { rows } = await appPool.query(
    `SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`
  );
  expect(rows[0]).toEqual({ name: 'app_user', rolsuper: false, rolbypassrls: false });
});

test('RLS is enabled and forced on every user-data table', async () => {
  const { rows } = await ownerPool.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
     WHERE relname IN ('users', 'events', 'work_hours', 'conflict_zones', 'conflict_ignores')`
  );
  expect(rows).toHaveLength(5);
  for (const r of rows) {
    expect([r.relname, r.relrowsecurity, r.relforcerowsecurity]).toEqual([r.relname, true, true]);
  }
});

test.each(['events', 'work_hours', 'conflict_zones', 'conflict_ignores'])(
  'user A sees only their own rows in %s',
  async (table) => {
    const rows = await withUser(appPool, USER_A, async (c) => (await c.query(`SELECT user_id FROM ${table}`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.user_id).toBe(USER_A);
  }
);

test('user A sees only their own users row', async () => {
  const rows = await withUser(appPool, USER_A, async (c) => (await c.query('SELECT id FROM users')).rows);
  expect(rows).toEqual([{ id: USER_A }]);
});

test('with no user set, nothing is visible', async () => {
  expect((await appPool.query('SELECT * FROM events')).rows).toHaveLength(0);
});

test('user A cannot update or delete user B rows', async () => {
  const result = await withUser(appPool, USER_A, async (c) => {
    const u = await c.query(`UPDATE events SET title = 'hacked' WHERE id = $1`, [B1]);
    const d = await c.query(`DELETE FROM events WHERE id = $1`, [B1]);
    return [u.rowCount, d.rowCount];
  });
  expect(result).toEqual([0, 0]);
  const { rows } = await ownerPool.query(`SELECT title FROM events WHERE id = $1`, [B1]);
  expect(rows[0].title).toBe('e');
});

test('user A cannot insert a row owned by user B', async () => {
  await expect(
    withUser(appPool, USER_A, (c) =>
      c.query(
        `INSERT INTO events(user_id, title, start_at, end_at) VALUES ($1, 'x', '2026-01-02T10:00Z', '2026-01-02T11:00Z')`,
        [USER_B]
      )
    )
  ).rejects.toThrow(/row-level security/);
});

test('joins do not leak other users rows', async () => {
  const rows = await withUser(appPool, USER_A, async (c) =>
    (await c.query(
      `SELECT i.id, e.id AS event_id FROM conflict_ignores i JOIN events e ON e.id = i.event_a_id`
    )).rows
  );
  expect(rows.map((r) => r.event_id)).toEqual([A1]);
});

test('the pool keeps working after a failed transaction', async () => {
  await expect(withUser(appPool, USER_A, (c) => c.query('SELECT * FROM no_such_table'))).rejects.toThrow();
  const rows = await withUser(appPool, USER_A, async (c) => (await c.query('SELECT id FROM users')).rows);
  expect(rows).toHaveLength(1);
});

test('ensureUser creates a user once and never overwrites a saved timezone', async () => {
  const NEW = '55555555-5555-4555-8555-555555555555';
  await ownerPool.query(`INSERT INTO users(id, timezone) VALUES ($1, 'UTC') ON CONFLICT DO NOTHING`, [NEW]);
  await ownerPool.query(`UPDATE users SET timezone = 'Asia/Tokyo' WHERE id = $1`, [NEW]);
  await ensureUser(appPool, NEW, 'America/New_York');
  await ensureUser(appPool, NEW, 'Europe/Paris');
  const { rows } = await ownerPool.query('SELECT timezone FROM users WHERE id = $1', [NEW]);
  expect(rows).toEqual([{ timezone: 'Asia/Tokyo' }]);
});

test('ensureUser works for an id that does not exist yet', async () => {
  const FRESH = '66666666-6666-4666-8666-666666666666';
  await ensureUser(appPool, FRESH, 'UTC');
  const { rows } = await ownerPool.query('SELECT id FROM users WHERE id = $1', [FRESH]);
  expect(rows).toHaveLength(1);
});
