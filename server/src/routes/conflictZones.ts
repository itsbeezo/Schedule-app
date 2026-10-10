import { Router } from 'express';
import { withUser } from '../db';
import { ApiError } from '../errors';
import { Ctx } from '../types';
import { bad, parseDate, requireUuid } from '../validation';

export function conflictZonesRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await withUser(pool, userId, async (c) => (await c.query('SELECT * FROM conflict_zones ORDER BY start_at')).rows);
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const start = parseDate(b.start_at, 'start_at');
    const end = parseDate(b.end_at, 'end_at');
    if (end.getTime() <= start.getTime()) bad('end_at must be after start_at', 'end_at');
    if (b.repeats_weekly !== undefined && typeof b.repeats_weekly !== 'boolean') {
      bad('repeats_weekly must be true or false', 'repeats_weekly');
    }
    const row = await withUser(pool, userId, async (c) => {
      const r = await c.query(
        'INSERT INTO conflict_zones(user_id, start_at, end_at, repeats_weekly) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, start, end, b.repeats_weekly ?? false]
      );
      return r.rows[0];
    });
    res.status(201).json(row);
  });

  router.delete('/:id', async (req, res) => {
    const id = requireUuid(req.params.id);
    const count = await withUser(pool, userId, async (c) => (await c.query('DELETE FROM conflict_zones WHERE id = $1', [id])).rowCount);
    if (!count) throw new ApiError(404, 'not_found', 'Conflict zone not found');
    res.status(204).end();
  });

  return router;
}
