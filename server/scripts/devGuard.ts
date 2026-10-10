import { Pool } from 'pg';

// Inverse of resetDb's guard: destructive demo seeding is allowed only on schedule_dev.
export async function assertDevDatabase(pool: Pool, databaseUrl: string): Promise<void> {
  if (!databaseUrl) throw new Error('Refusing to seed: DATABASE_URL is empty.');
  const { rows } = await pool.query('SELECT current_database() AS name');
  if (rows[0].name !== 'schedule_dev') {
    throw new Error(`Refusing to seed database "${rows[0].name}"; only schedule_dev is allowed (schedule_dev required).`);
  }
}
