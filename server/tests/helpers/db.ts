import { Pool } from 'pg';
import { migrate } from '../../src/migrate';

export const ownerPool = new Pool({ connectionString: process.env.TEST_MIGRATION_DATABASE_URL });
export const appPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

export const USER_A = '00000000-0000-4000-8000-0000000000a1';
export const USER_B = '00000000-0000-4000-8000-0000000000b2';

export async function resetDb(): Promise<void> {
  await ownerPool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ownerPool.query('CREATE SCHEMA public');
  await ownerPool.query('GRANT USAGE ON SCHEMA public TO PUBLIC');
  await migrate(ownerPool);
}

export async function seedUsers(): Promise<void> {
  await ownerPool.query(
    `INSERT INTO users(id, timezone) VALUES ($1, 'UTC'), ($2, 'UTC') ON CONFLICT DO NOTHING`,
    [USER_A, USER_B]
  );
}

export async function closePools(): Promise<void> {
  await ownerPool.end();
  await appPool.end();
}
