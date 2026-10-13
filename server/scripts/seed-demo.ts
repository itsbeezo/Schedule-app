import { config } from '../src/config';
import { Pool } from 'pg';
import { createPool, ensureUser, withUser } from '../src/db';
import { assertDevDatabase } from './devGuard';

/** Wall-clock parts of an instant in a zone. */
function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short',
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return o;
}

/** The instant at which the wall clock in `tz` reads y-m-d h:min (m is 1-based; overflow days roll over). */
function zonedTime(tz: string, y: number, m: number, d: number, h: number, min: number): Date {
  const wall = Date.UTC(y, m - 1, d, h, min);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess), tz);
    const seen = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    guess += wall - seen;
  }
  return new Date(guess);
}

/** Monday of the current week in `tz`, as calendar y/m/d. */
function mondayIn(tz: string) {
  const p = parts(new Date(), tz);
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day - dow };
}

export async function seedDemo(pool: Pool, databaseUrl: string, userId: string, userTimezone: string) {
  await assertDevDatabase(pool, databaseUrl);
  await ensureUser(pool, userId, userTimezone);
  const tz = await withUser(pool, userId, async (c) =>
    ((await c.query('SELECT timezone FROM users WHERE id = $1', [userId])).rows[0]?.timezone as string) ?? userTimezone
  );
  const monday = mondayIn(tz);
  const at = (m: { y: number; m: number; d: number }, dayOffset: number, hour: number, minute: number) =>
    zonedTime(tz, m.y, m.m, m.d + dayOffset, hour, minute);

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
