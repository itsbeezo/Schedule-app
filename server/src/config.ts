import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  userId: process.env.CURRENT_USER_ID ?? '00000000-0000-4000-8000-000000000001',
  userTimezone: process.env.USER_TIMEZONE ?? 'UTC',
};
