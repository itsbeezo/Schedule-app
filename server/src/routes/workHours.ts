import { Router } from 'express';
import { withUser } from '../db';
import { Ctx } from '../types';
import { bad, parseTime } from '../validation';

interface Entry {
  weekday: number;
  start_time: string;
  end_time: string;
}

export function workHoursRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  const list = (c: import('pg').PoolClient) =>
    c
      .query(
        `SELECT weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
         FROM work_hours ORDER BY weekday, start_time`
      )
      .then((r) => r.rows as Entry[]);

  router.get('/', async (_req, res) => {
    res.json(await withUser(pool, userId, list));
  });

  router.put('/', async (req, res) => {
    const input = req.body?.workHours;
    if (!Array.isArray(input)) bad('workHours must be an array', 'workHours');
    const entries: Entry[] = (input as unknown[]).map((raw, i) => {
      const e = (raw ?? {}) as Record<string, unknown>;
      if (!Number.isInteger(e.weekday) || (e.weekday as number) < 0 || (e.weekday as number) > 6) {
        bad('weekday must be an integer from 0 (Sunday) to 6', `workHours[${i}].weekday`);
      }
      const start_time = parseTime(e.start_time, `workHours[${i}].start_time`);
      const end_time = parseTime(e.end_time, `workHours[${i}].end_time`);
      if (end_time <= start_time) bad('end_time must be after start_time', `workHours[${i}].end_time`);
      return { weekday: e.weekday as number, start_time, end_time };
    });
    const sorted = [...entries].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].weekday === sorted[i - 1].weekday && sorted[i].start_time < sorted[i - 1].end_time) {
        bad('work hour ranges on the same weekday must not overlap', 'workHours');
      }
    }
    const result = await withUser(pool, userId, async (c) => {
      await c.query('DELETE FROM work_hours');
      for (const e of sorted) {
        await c.query(
          'INSERT INTO work_hours(user_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [userId, e.weekday, e.start_time, e.end_time]
        );
      }
      return list(c);
    });
    res.json(result);
  });

  return router;
}
