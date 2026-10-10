import { Router } from 'express';
import { withUser } from '../db';
import { ApiError } from '../errors';
import { Ctx } from '../types';
import { EventFields, optionalDate, parseEventFields, requireUuid } from '../validation';

export function eventsRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const from = optionalDate(req.query.from, 'from');
    const to = optionalDate(req.query.to, 'to');
    const rows = await withUser(pool, userId, async (c) => {
      const result = await c.query(
        `SELECT * FROM events
         WHERE ($1::timestamptz IS NULL OR end_at > $1)
           AND ($2::timestamptz IS NULL OR start_at < $2)
         ORDER BY start_at, id`,
        [from, to]
      );
      return result.rows;
    });
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const f = parseEventFields(req.body);
    const row = await withUser(pool, userId, async (c) => {
      const result = await c.query(
        `INSERT INTO events(user_id, title, start_at, end_at, kind, color, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, f.title, f.start_at, f.end_at, f.kind, f.color, f.notes]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  });

  router.put('/:id', async (req, res) => {
    const id = requireUuid(req.params.id);
    const row = await withUser(pool, userId, async (c) => {
      const current = await c.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [id]);
      if (current.rowCount === 0) throw new ApiError(404, 'not_found', 'Event not found');
      const existing: EventFields = {
        title: current.rows[0].title,
        start_at: current.rows[0].start_at,
        end_at: current.rows[0].end_at,
        kind: current.rows[0].kind,
        color: current.rows[0].color,
        notes: current.rows[0].notes,
      };
      const f = parseEventFields(req.body, existing);
      const result = await c.query(
        `UPDATE events SET title = $2, start_at = $3, end_at = $4, kind = $5, color = $6, notes = $7,
                updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, f.title, f.start_at, f.end_at, f.kind, f.color, f.notes]
      );
      return result.rows[0];
    });
    res.json(row);
  });

  router.delete('/:id', async (req, res) => {
    const id = requireUuid(req.params.id);
    const count = await withUser(pool, userId, async (c) => (await c.query('DELETE FROM events WHERE id = $1', [id])).rowCount);
    if (!count) throw new ApiError(404, 'not_found', 'Event not found');
    res.status(204).end();
  });

  return router;
}
