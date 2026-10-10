// Private cluster managed by scripts/dev-db.sh (unix socket only, see Task 0 Step 4).
const sock = process.env.SCHEDULE_PG_SOCKET ?? `${process.env.HOME}/pgdata/schedule-app/sock`;
const port = process.env.SCHEDULE_PG_PORT ?? '5433';
process.env.TEST_MIGRATION_DATABASE_URL ??= `postgresql://postgres@/schedule_test?host=${sock}&port=${port}`;
process.env.TEST_DATABASE_URL ??= `postgresql://app_user@/schedule_test?host=${sock}&port=${port}`;
