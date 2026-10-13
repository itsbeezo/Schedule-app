import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './errors';
import { conflictsRouter } from './routes/conflicts';
import { conflictIgnoresRouter } from './routes/conflictIgnores';
import { conflictZonesRouter } from './routes/conflictZones';
import { eventsRouter } from './routes/events';
import { settingsRouter } from './routes/settings';
import { workHoursRouter } from './routes/workHours';
import { Ctx } from './types';

export function createApp(ctx: Ctx, corsOrigins: string[] = config.corsOrigins): express.Express {
  const app = express();
  app.use(cors({ origin: corsOrigins }), express.json());
  app.use('/api/events', eventsRouter(ctx));
  app.use('/api/settings', settingsRouter(ctx));
  app.use('/api/work-hours', workHoursRouter(ctx));
  app.use('/api/conflict-zones', conflictZonesRouter(ctx));
  app.use('/api/conflict-ignores', conflictIgnoresRouter(ctx));
  app.use('/api/conflicts', conflictsRouter(ctx));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
