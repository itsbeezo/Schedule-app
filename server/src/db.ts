import { Pool, PoolClient } from 'pg';

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

/** Runs fn in a transaction where RLS sees `userId` as the current user. */
export async function withUser<T>(
  pool: Pool,
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Creates the user row with a default timezone only if it is new; a saved timezone is never overwritten. */
export async function ensureUser(pool: Pool, userId: string, timezone: string): Promise<void> {
  await withUser(pool, userId, (c) =>
    c.query(
      `INSERT INTO users(id, timezone) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [userId, timezone]
    )
  );
}
