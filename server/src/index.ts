import { createApp } from './app';
import { config } from './config';
import { createPool, ensureUser } from './db';

async function main() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set (see server/.env.example)');
  const pool = createPool(config.databaseUrl);
  await ensureUser(pool, config.userId, config.userTimezone);
  createApp({ pool, userId: config.userId }).listen(config.port, config.host, () => {
    console.log(`Server running on ${config.host}:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
