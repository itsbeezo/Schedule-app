import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './errors';
import { eventsRouter } from './routes/events';
import { Ctx } from './types';

export function createApp(ctx: Ctx): express.Express {
  const app = express();
  app.use(cors(), express.json());
  app.use('/api/events', eventsRouter(ctx));
  // Tasks 5 and 6 mount the remaining routers here.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
