import { ownerPool, resetDb, closePools, seedUsers, USER_A } from './helpers/db';
import { migrate } from '../src/migrate';

beforeAll(resetDb);
afterAll(closePools);

test('creates all tables', async () => {
  const { rows } = await ownerPool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const names = rows.map((r) => r.table_name);
  for (const t of ['conflict_ignores', 'conflict_zones', 'events', 'schema_migrations', 'users', 'work_hours']) {
    expect(names).toContain(t);
  }
});

test('running migrations again applies nothing', async () => {
  expect(await migrate(ownerPool)).toEqual([]);
});

test('rejects an event that ends before it starts', async () => {
  await seedUsers();
  await expect(
    ownerPool.query(
      `INSERT INTO events(user_id, title, start_at, end_at)
       VALUES ($1, 'x', '2026-01-01T10:00Z', '2026-01-01T09:00Z')`,
      [USER_A]
    )
  ).rejects.toThrow(/check constraint/);
});

test('rejects an ignore row whose event ids are not in canonical order', async () => {
  await seedUsers();
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  for (const id of ids) {
    await ownerPool.query(
      `INSERT INTO events(id, user_id, title, start_at, end_at)
       VALUES ($1, $2, 'e', '2026-01-01T10:00Z', '2026-01-01T11:00Z')`,
      [id, USER_A]
    );
  }
  await expect(
    ownerPool.query(
      `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode) VALUES ($1, $2, $3, 'allow')`,
      [USER_A, ids[1], ids[0]]
    )
  ).rejects.toThrow(/check constraint/);
});
