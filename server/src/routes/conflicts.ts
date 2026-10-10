import { Router } from 'express';
import { detectConflicts } from '../conflicts/detectConflicts';
import { withUser } from '../db';
import { Ctx } from '../types';
import { optionalDate } from '../validation';

export function conflictsRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const from = optionalDate(req.query.from, 'from');
    const to = optionalDate(req.query.to, 'to');
    const result = await withUser(pool, userId, async (c) => {
      const tz = (await c.query('SELECT timezone FROM users WHERE id = $1', [userId])).rows[0]?.timezone ?? 'UTC';
      const events = (
        await c.query(
          `SELECT id, start_at, end_at FROM events
           WHERE ($1::timestamptz IS NULL OR end_at > $1) AND ($2::timestamptz IS NULL OR start_at < $2)`,
          [from, to]
        )
      ).rows;
      const zones = (await c.query('SELECT start_at, end_at, repeats_weekly FROM conflict_zones')).rows;
      const ignores = (
        await c.query('SELECT id, event_a_id, event_b_id, mode, overlap_start, overlap_end FROM conflict_ignores')
      ).rows;
      return detectConflicts(events, zones, ignores, tz);
    });
    res.json(result);
  });

  return router;
}
