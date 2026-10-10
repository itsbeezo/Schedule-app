import { config } from '../src/config';
import { Pool } from 'pg';
import { createPool, ensureUser, withUser } from '../src/db';
import { assertDevDatabase } from './devGuard';

function at(monday: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export async function seedDemo(pool: Pool, databaseUrl: string, userId: string, userTimezone: string) {
  await assertDevDatabase(pool, databaseUrl);
  await ensureUser(pool, userId, userTimezone);
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  await withUser(pool, userId, async (c) => {
    await c.query('DELETE FROM events');
    await c.query('DELETE FROM work_hours');
    await c.query('DELETE FROM conflict_zones');
    for (let weekday = 1; weekday <= 5; weekday++) {
      await c.query(
        `INSERT INTO work_hours(user_id, weekday, start_time, end_time) VALUES ($1, $2, '09:00', '17:00')`,
        [userId, weekday]
      );
    }
    const add = async (title: string, day: number, sh: number, sm: number, eh: number, em: number, kind = 'event', color: string | null = null) =>
      (
        await c.query(
          `INSERT INTO events(user_id, title, start_at, end_at, kind, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [userId, title, at(monday, day, sh, sm), at(monday, day, eh, em), kind, color]
        )
      ).rows[0].id as string;

    await add('Deep work', 0, 9, 0, 11, 0, 'time_block');
    await add('Team sync', 0, 14, 0, 15, 0); // active conflict with Dentist
    await add('Dentist', 0, 14, 30, 15, 30);
    await add('Planning', 1, 10, 0, 11, 30, 'time_block');
    await add('Lunch with Sam', 1, 12, 0, 13, 0, 'event', '#7B5CD6');
    const standup = await add('Standup', 2, 9, 30, 10, 0); // ignored conflict
    const review = await add('Review', 2, 9, 45, 10, 30);
    await add('Client call', 3, 13, 0, 14, 0);
    await add('Write report', 3, 15, 0, 17, 0, 'time_block');
    await add('Workshop', 4, 10, 0, 12, 0); // inside a zone: no marker
    await add('Sprint demo', 4, 11, 0, 12, 30);

    const [lo, hi] = standup < review ? [standup, review] : [review, standup];
    await c.query(
      `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode) VALUES ($1, $2, $3, 'allow')`,
      [userId, lo, hi]
    );
    await c.query(
      `INSERT INTO conflict_zones(user_id, start_at, end_at, repeats_weekly) VALUES ($1, $2, $3, false)`,
      [userId, at(monday, 4, 9, 0), at(monday, 4, 17, 0)]
    );
  });
  console.log('Demo data loaded for the current week.');
}

if (require.main === module) {
  const pool = createPool(config.databaseUrl);
  seedDemo(pool, config.databaseUrl, config.userId, config.userTimezone)
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
