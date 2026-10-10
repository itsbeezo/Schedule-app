import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A } from './helpers/db';
import { assertDevDatabase } from '../scripts/devGuard';
import { seedDemo } from '../scripts/seed-demo';

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
afterAll(closePools);

test('refuses an empty DATABASE_URL', async () => {
  await expect(assertDevDatabase(appPool, '')).rejects.toThrow(/DATABASE_URL/);
});

test('refuses a database that is not schedule_dev', async () => {
  await expect(assertDevDatabase(appPool, 'postgresql://x/schedule_test')).rejects.toThrow(/schedule_test/);
});

test('seedDemo against schedule_test refuses and writes nothing', async () => {
  await expect(seedDemo(appPool, 'postgresql://x/schedule_test', USER_A, 'UTC')).rejects.toThrow(/schedule_dev/);
  const { rows } = await ownerPool.query('SELECT (SELECT count(*) FROM events) e, (SELECT count(*) FROM work_hours) w, (SELECT count(*) FROM conflict_zones) z');
  expect(rows[0]).toEqual({ e: '0', w: '0', z: '0' });
});
