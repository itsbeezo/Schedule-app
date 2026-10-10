import { Router } from 'express';
import { withUser } from '../db';
import { ApiError } from '../errors';
import { Ctx } from '../types';
import { bad, requireUuid } from '../validation';

export function conflictIgnoresRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await withUser(pool, userId, async (c) =>
      (await c.query(
        `SELECT i.id, i.event_a_id, i.event_b_id, i.mode, i.overlap_start, i.overlap_end,
                a.title AS event_a_title, b.title AS event_b_title
         FROM conflict_ignores i
         JOIN events a ON a.id = i.event_a_id
         JOIN events b ON b.id = i.event_b_id
         ORDER BY a.start_at, i.id`
      )).rows
    );
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const idA = requireUuid(b.eventAId, 'eventAId');
    const idB = requireUuid(b.eventBId, 'eventBId');
    if (idA === idB) bad('eventAId and eventBId must be different events', 'eventBId');
    if (b.mode !== 'once' && b.mode !== 'allow') bad("mode must be 'once' or 'allow'", 'mode');
    const [lo, hi] = idA < idB ? [idA, idB] : [idB, idA];

    const row = await withUser(pool, userId, async (c) => {
      const found = await c.query('SELECT id, start_at, end_at FROM events WHERE id = ANY($1::uuid[])', [[lo, hi]]);
      if (found.rowCount !== 2) throw new ApiError(404, 'not_found', 'Event not found');
      const starts = found.rows.map((r) => r.start_at.getTime());
      const ends = found.rows.map((r) => r.end_at.getTime());
      const overlapStart = Math.max(...starts);
      const overlapEnd = Math.min(...ends);
      if (overlapStart >= overlapEnd) throw new ApiError(400, 'no_overlap', 'Those events do not overlap');
      const once = b.mode === 'once';
      const result = await c.query(
        `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode, overlap_start, overlap_end)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, event_a_id, event_b_id)
         DO UPDATE SET mode = EXCLUDED.mode, overlap_start = EXCLUDED.overlap_start, overlap_end = EXCLUDED.overlap_end
         RETURNING *`,
        [userId, lo, hi, b.mode, once ? new Date(overlapStart) : null, once ? new Date(overlapEnd) : null]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  });

  router.delete('/:id', async (req, res) => {
    const id = requireUuid(req.params.id);
    const count = await withUser(pool, userId, async (c) => (await c.query('DELETE FROM conflict_ignores WHERE id = $1', [id])).rowCount);
    if (!count) throw new ApiError(404, 'not_found', 'Conflict choice not found');
    res.status(204).end();
  });

  return router;
}
