import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './errors';
import { conflictIgnoresRouter } from './routes/conflictIgnores';
import { conflictZonesRouter } from './routes/conflictZones';
import { eventsRouter } from './routes/events';
import { workHoursRouter } from './routes/workHours';
import { Ctx } from './types';

export function createApp(ctx: Ctx): express.Express {
  const app = express();
  app.use(cors(), express.json());
  app.use('/api/events', eventsRouter(ctx));
  app.use('/api/work-hours', workHoursRouter(ctx));
  app.use('/api/conflict-zones', conflictZonesRouter(ctx));
  app.use('/api/conflict-ignores', conflictIgnoresRouter(ctx));
  // Task 6 mounts /api/conflicts here.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
