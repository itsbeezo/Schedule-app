import { Pool } from 'pg';

export interface Ctx {
  pool: Pool;
  userId: string;
}
