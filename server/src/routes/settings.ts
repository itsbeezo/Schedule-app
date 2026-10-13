import { Router } from 'express';
import { withUser } from '../db';
import { Ctx } from '../types';
import { ApiError } from '../errors';
import { bad } from '../validation';

/** Returns the canonical IANA zone name, or null if tz is not a valid zone. */
function canonicalZone(tz: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function settingsRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const timezone = await withUser(
      pool,
      userId,
      async (c) => (await c.query('SELECT timezone FROM users WHERE id = $1', [userId])).rows[0]?.timezone as string | undefined
    );
    if (!timezone) throw new ApiError(404, 'not_found', 'user settings not found');
    res.json({ timezone });
  });

  router.put('/', async (req, res) => {
    const tz = req.body?.timezone;
    if (typeof tz !== 'string' || tz.trim() === '') bad('timezone must be a non-empty string', 'timezone');
    if (tz.length > 64) bad('timezone must be at most 64 characters', 'timezone');
    const canonical = canonicalZone(tz.trim());
    if (!canonical) bad(`timezone "${tz}" is not a valid IANA time zone`, 'timezone');
    const timezone = await withUser(
      pool,
      userId,
      async (c) =>
        (
          await c.query(
            `INSERT INTO users(id, timezone) VALUES ($1, $2)
             ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone RETURNING timezone`,
            [userId, canonical]
          )
        ).rows[0].timezone
    );
    res.json({ timezone });
  });

  return router;
}
