import { Router } from 'express';
import { withUser } from '../db';
import { Ctx } from '../types';
import { bad } from '../validation';

function isIanaZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function settingsRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const timezone = await withUser(
      pool,
      userId,
      async (c) => (await c.query('SELECT timezone FROM users WHERE id = $1', [userId])).rows[0]?.timezone ?? 'UTC'
    );
    res.json({ timezone });
  });

  router.put('/', async (req, res) => {
    const tz = req.body?.timezone;
    if (typeof tz !== 'string' || tz.trim() === '') bad('timezone must be a non-empty string', 'timezone');
    if (!isIanaZone(tz)) bad(`timezone "${tz}" is not a valid IANA time zone`, 'timezone');
    const timezone = await withUser(
      pool,
      userId,
      async (c) =>
        (await c.query('UPDATE users SET timezone = $2 WHERE id = $1 RETURNING timezone', [userId, tz])).rows[0]
          ?.timezone
    );
    res.json({ timezone });
  });

  return router;
}
