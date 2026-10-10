# Calendar and Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build sub-projects A (calendar, conflicts, work hours, settings, Violet dusk design system) and C (the agent-run build process) of the Schedule app, ending at checkpoint CP3.

**Architecture:** Keep the existing React 18 + Express 5 + Postgres split. The server owns all data rules: SQL migrations, Row Level Security (RLS) with a non-owner `app_user` role, a pure `detectConflicts` function, and a REST API with one error shape. The client is a themed FullCalendar app whose look lives entirely in `src/styles/` (design tokens plus component class names), so the Design agent and Frontend agent never edit the same file.

**Tech Stack:** Node 20, TypeScript, Express 5, `pg`, PostgreSQL 18, `luxon`, Jest + ts-jest + supertest (server); React 18 (Create React App), FullCalendar 6 (+ interaction plugin), React Testing Library, Playwright (screenshots), `@fontsource/inter` (client).

**Spec:** `docs/superpowers/specs/2026-10-03-calendar-and-agent-workflow-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- Times are stored as `timestamptz` in UTC and displayed in the user's timezone.
- RLS is `ENABLE`d and `FORCE`d on `events`, `work_hours`, `conflict_zones`, `conflict_ignores`, and `users`. The server connects as the non-owner role `app_user`. Each request runs in a transaction that calls `set_config('app.user_id', <id>, true)`.
- API errors are always `{ "error": { "code", "message", "details?" } }`.
- Reserved colors (exact values, case-insensitive): coral `#FF8A5B`, work-hours light blue `#A8D4FF`, UI purple `#9B6BFF`. Users may pick any other color for an event.
- Palette (Violet dusk): background `#14102A`, surface `#1E1840`, raised `#2A2258`, purple `#9B6BFF`, royal `#4A63F0`, light blue `#A8D4FF`, mint `#4DF5C0`, coral `#FF8A5B`, text `#EFEAFF`, muted text `#9D95C9`.
- Font: Inter. Radius 12-16px for cards and events, pill-shaped buttons. 8px spacing grid. All text meets WCAG AA (4.5:1 body, 3:1 large text).
- All colors are CSS variables in `tokens.css`. No other CSS file contains a hex color or an `rgb()`/`rgba()` literal.
- Color is never the only signal: conflicts always carry the clock icon with "!".
- Drag and resize snap to 15 minutes and save immediately; on failure the event reverts and a toast explains. On touch, press-and-hold starts a drag.
- Two events conflict if `a.start < b.end && b.start < a.end`; touching end-to-start is not a conflict.
- Weekday numbers are 0-6 with 0 = Sunday (same as JavaScript `Date.getDay()`).
- The Spec reviewer and UX reviewer are read-only. Implementer agents commit only to their own branch and never push or merge.

**Approved new dependencies** (the only ones agents may add; anything else needs owner approval):
- Server: `luxon`; dev: `jest`, `ts-jest`, `supertest`, `@types/jest`, `@types/supertest`, `@types/luxon`.
- Client: `@fullcalendar/interaction` (the existing `editable`/`selectable` props do nothing without it), `@fontsource/inter` (self-hosted font, so no request goes to Google Fonts); dev: `playwright` (screenshots for the UX reviewer).

**Decisions this plan makes where the spec was silent:**
- Event titles are 1-200 characters; notes are at most 5000 characters.
- `GET /api/events` and `GET /api/conflicts` accept optional `from` and `to` (ISO timestamps) and return what overlaps that window.
- The user's timezone comes from the `USER_TIMEZONE` environment variable (default `UTC`) and is stored on the `users` row.
- The all-day row is hidden; every event has a start and end time.
- A weekly conflict zone applies from the week it was created onward, not to earlier weeks.
- "Color preferences" in Settings means one default color for new events, stored in the browser's `localStorage`.
- CP1's "styled static calendar" is a plain HTML page in `client/my_scheduler/design/mockups/` built with the real stylesheets. The real calendar is styled with the same stylesheets from CP2.

## Review Focus

Failure modes the spec implies but no task exercises by default. Each has a test in the task named in parentheses.

1. An event that spans midnight, or a weekly zone across a daylight-saving change, must still conflict or be suppressed correctly (Task 3).
2. A drag or dialog edit that produces `end <= start` must be rejected, and the event must snap back (Tasks 4, 11, 12).
3. Dragging an event into the all-day area or a month cell must not create an event without times (Task 12).
4. Very long titles and emoji titles must save and render without breaking the layout (Tasks 4, 11).
5. If the API is down or slow on load, the user sees a visible error with a retry, not a blank calendar (Task 10).

## File Structure

```
server/
  package.json                 modify: scripts + dependencies (Task 1)
  tsconfig.build.json          create: build config with outDir (Task 1)
  jest.config.js               create (Task 1)
  .env.example                 create (Task 1)
  migrations/001_schema.sql    create (Task 1)
  migrations/002_rls.sql       create (Task 2)
  scripts/seed-demo.ts         create (Task 6)
  src/config.ts                create: env settings (Task 2)
  src/db.ts                    modify: pool, withUser, ensureUser (Task 2)
  src/migrate.ts               create: migration runner (Task 1)
  src/migrate-cli.ts           create (Task 1)
  src/conflicts/detectConflicts.ts   create: pure function (Task 3)
  src/errors.ts, validation.ts, reservedColors.ts, types.ts   create (Task 4)
  src/app.ts                   create: createApp(ctx) (Task 4)
  src/index.ts                 modify: bootstrap (Task 4)
  src/routes/events.ts         modify: full CRUD (Task 4)
  src/routes/workHours.ts, conflictZones.ts, conflictIgnores.ts   create (Task 5)
  src/routes/conflicts.ts      create (Task 6)
  tests/helpers/env.ts, tests/helpers/db.ts   create (Task 1)
  tests/*.test.ts              create (Tasks 1-6)
client/my_scheduler/
  design/mockups/, design/screenshots/   Design agent output (Tasks 8, 16, 17)
  design/screenshot.mjs, design/screenshot-app.mjs   create (Tasks 8, 16)
  src/styles/                  Design agent only (Tasks 7, 8, 16, 17)
    tokens.css, base.css, components.css, calendar.css, index.css
    contrast.ts, reservedColors.ts
    __tests__/
  src/api/types.ts, client.ts  create (Task 9)
  src/components/              CalendarView, EventDialog, ColorPicker, SelectionToolbar,
                               ConflictIcon, ConflictBadge, ConflictPopover, Toast,
                               SettingsPanel (Tasks 9-15)
  src/lib/                     workHoursBand, zoneBand, eventChange, conflictIndex, preferences
  src/hooks/useCalendarData.ts create (Task 10)
  src/test/fullCalendarMock.tsx create (Task 10)
```

## CSS Class Contract (Design agent defines, Frontend agent uses)

Frontend components may use only these class names for styling. If a component needs a class not listed, the Frontend agent says so in its report and the Design agent adds it.

| Class | Used for |
|---|---|
| `app-shell`, `app-header`, `app-title` | page frame and header |
| `btn`, `btn--primary` (mint), `btn--ghost` | buttons |
| `card`, `dialog`, `dialog__backdrop`, `dialog__title` | panels and event dialog |
| `field`, `field__label`, `field__input`, `field__error` | form fields |
| `swatch`, `swatch--selected` | color swatches |
| `toast`, `toast--error` | toasts |
| `load-error` | "could not load" banner with retry |
| `selection-toolbar` | toolbar after a drag-select |
| `cal-event`, `cal-event--time-block`, `cal-event--conflict`, `cal-event--ignored` | events (passed through FullCalendar `classNames`) |
| `cal-work-hours`, `cal-zone` | background bands |
| `conflict-badge`, `conflict-badge--ignored` | clock-and-"!" badge and its quiet variant |
| `popover`, `popover__title`, `popover__actions` | conflict popover |
| `settings`, `settings__section` | settings panel |

## Rounds, Owners, and Checkpoints

Each round runs the listed tasks in parallel (different agents, different worktrees), then the Spec reviewer (and the UX reviewer for visible work), then the orchestrator's round gate (Task 0 describes it).

| Round | Backend | Design | Frontend | Ends at |
|---|---|---|---|---|
| 1 | Tasks 1, 2 | Task 7 | Task 9 | |
| 2 | Tasks 3, 4 | Task 8 | Task 10 | **CP1** (look approval) |
| 3 | Tasks 5, 6 | | Tasks 11, 12 | |
| 4 | | Task 16 | review fixes only | **CP2** |
| 5 | | | Tasks 13, 14, 15 | |
| 6 | | Task 17 | review fixes only | **CP3** |

Dependency rule: a task may use only what earlier rounds have already merged. Tasks in the same round never depend on each other. Each agent starts a round by running `git merge Calender-dev` inside its worktree.

The orchestrator stops and reports at CP1, CP2, CP3, and at any hard stop in `CLAUDE.md`.

---

### Task 0: Orchestrator setup (before Round 1)

**Owner:** orchestrator (main session). **Files:** `.gitignore`, `server/.env`, git branches and worktrees.

- [ ] **Step 1: Confirm the agent definitions and project rules are committed (the owner approved them and they were committed together with this plan)**

```bash
cd /home/beezo/Documents/GitHub/Schedule-app
git status --short CLAUDE.md .claude/agents    # expected: no output
git log --oneline -1 -- CLAUDE.md .claude/agents
```

- [ ] **Step 2: Ignore worktrees and generated screenshots**

```bash
printf '\n# agent worktrees\n.worktrees/\n\n# generated design screenshots (the UX reviewer reads them from the design worktree)\nclient/my_scheduler/design/screenshots/*.png\n' >> .gitignore
git add .gitignore && git commit -m "Ignore agent worktrees"
```

- [ ] **Step 3: Install every approved dependency once, on the integration branch, before any worktree exists** (so no two agents ever edit `package.json` or a lockfile in the same round)

```bash
cd /home/beezo/Documents/GitHub/Schedule-app/server
npm install luxon
npm install -D jest ts-jest supertest @types/jest @types/supertest @types/luxon
cd ../client/my_scheduler
npm install @fullcalendar/interaction@^6.1.17 @fontsource/inter
npm install -D playwright
npx playwright install chromium
cd ../..
git add server/package.json server/package-lock.json client/my_scheduler/package.json client/my_scheduler/package-lock.json
git commit -m "Install approved dependencies"
```

If the Chromium download fails on this machine, note it for the Design agent: it can set `CHROMIUM_PATH` to an installed Chromium or Chrome binary (the screenshot scripts read that variable).

- [ ] **Step 3b: Create one worktree and branch per implementer, from the current branch (`Calender-dev`, the integration branch)**

```bash
git worktree add .worktrees/backend  -b agents/backend  Calender-dev
git worktree add .worktrees/frontend -b agents/frontend Calender-dev
git worktree add .worktrees/design   -b agents/design   Calender-dev
```

Each worktree needs its own dependencies. Run `npm install` in `server/` and `client/my_scheduler/` inside each worktree that will touch them (backend: `server/`; frontend and design: `client/my_scheduler/`).

- [ ] **Step 4: Create the project's private Postgres cluster and databases**

This project does NOT use the system Postgres service (which keeps its data on the root partition and also holds the owner's other projects' databases, which are out of scope and must never be touched). It uses a private cluster under the owner's home partition, run as the owner's user, listening on a unix socket only (port 5433, socket directory `$HOME/pgdata/schedule-app/sock`), managed by `scripts/dev-db.sh`:

```bash
cd /home/beezo/Documents/GitHub/Schedule-app
scripts/dev-db.sh init      # once: creates the cluster plus schedule_dev and schedule_test
scripts/dev-db.sh status    # expected: "server is running"
scripts/dev-db.sh url       # prints host=<socket dir> port=5433
```

Expected from `init`: `CREATE DATABASE` twice. After a reboot, run `scripts/dev-db.sh start`. The cluster must be running whenever server tests or the dev server run.

- [ ] **Step 5: Round gate (run at the end of every round, on the integration branch after merging the round's branches)**

```bash
scripts/dev-db.sh status         # the private Postgres must be running
cd server && npm test            # all server tests pass
cd ../client/my_scheduler && CI=true npm test -- --watchAll=false   # all client tests pass
npm run build                    # client builds
```

The app must also start: `cd server && npm run dev` prints `Server running on port 4000`, and `cd client/my_scheduler && npm start` compiles. Merge a branch into `Calender-dev` only after the gate passes with it merged. After merging, update each worktree with `git merge Calender-dev` from inside it.


---

## BACKEND AGENT TASKS (work in `.worktrees/backend`)

### Task 1: Server test infrastructure, migration runner, and base schema

**Files:**
- Modify: `server/package.json`
- Create: `server/tsconfig.build.json`, `server/jest.config.js`, `server/.env.example`
- Create: `server/src/migrate.ts`, `server/src/migrate-cli.ts`, `server/migrations/001_schema.sql`
- Create: `server/tests/helpers/env.ts`, `server/tests/helpers/db.ts`, `server/tests/migrate.test.ts`

**Interfaces:**
- Produces: `migrate(pool: Pool, dir?: string): Promise<string[]>` in `src/migrate.ts` (returns the names of the migration files it applied). From `tests/helpers/db.ts`: `ownerPool`, `appPool` (both `pg.Pool`), `USER_A`, `USER_B` (UUID strings), `resetDb(): Promise<void>`, `seedUsers(): Promise<void>`, `closePools(): Promise<void>`.

- [ ] **Step 1: Confirm dependencies and set scripts**

The server dependencies were installed in Task 0. Confirm with `cd server && npm ls luxon jest ts-jest supertest` (all present), then replace the `"scripts"` block in `server/package.json` with:

```json
"scripts": {
  "dev": "ts-node src/index.ts",
  "build": "tsc -p tsconfig.build.json",
  "start": "node dist/index.js",
  "test": "jest --runInBand",
  "migrate": "ts-node src/migrate-cli.ts",
  "seed:demo": "ts-node scripts/seed-demo.ts"
},
```

(`--runInBand` is required: all test files share one test database.)

- [ ] **Step 2: Create `server/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `server/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/helpers/env.ts'],
};
```

- [ ] **Step 4: Create `server/tests/helpers/env.ts`**

```ts
// Private cluster managed by scripts/dev-db.sh (unix socket only, see Task 0 Step 4).
const sock = process.env.SCHEDULE_PG_SOCKET ?? `${process.env.HOME}/pgdata/schedule-app/sock`;
const port = process.env.SCHEDULE_PG_PORT ?? '5433';
process.env.TEST_MIGRATION_DATABASE_URL ??= `postgresql://postgres@/schedule_test?host=${sock}&port=${port}`;
process.env.TEST_DATABASE_URL ??= `postgresql://app_user@/schedule_test?host=${sock}&port=${port}`;
```

- [ ] **Step 5: Verify the socket connection string works**

```bash
SOCK="$HOME/pgdata/schedule-app/sock"
node -e "const {Pool}=require('pg');new Pool({connectionString:'postgresql://postgres@/schedule_test?host=$SOCK&port=5433'}).query('select 1 as ok').then(r=>{console.log(r.rows);process.exit()})"
```

Expected: `[ { ok: 1 } ]`. If it fails, stop and report; the connection string format is the thing to fix before continuing.

- [ ] **Step 6: Create `server/tests/helpers/db.ts`**

```ts
import { Pool } from 'pg';
import { migrate } from '../../src/migrate';

export const ownerPool = new Pool({ connectionString: process.env.TEST_MIGRATION_DATABASE_URL });
export const appPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

export const USER_A = '00000000-0000-4000-8000-0000000000a1';
export const USER_B = '00000000-0000-4000-8000-0000000000b2';

export async function resetDb(): Promise<void> {
  await ownerPool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ownerPool.query('CREATE SCHEMA public');
  await ownerPool.query('GRANT USAGE ON SCHEMA public TO PUBLIC');
  await migrate(ownerPool);
}

export async function seedUsers(): Promise<void> {
  await ownerPool.query(
    `INSERT INTO users(id, timezone) VALUES ($1, 'UTC'), ($2, 'UTC') ON CONFLICT DO NOTHING`,
    [USER_A, USER_B]
  );
}

export async function closePools(): Promise<void> {
  await ownerPool.end();
  await appPool.end();
}
```

- [ ] **Step 7: Write the failing test `server/tests/migrate.test.ts`**

```ts
import { ownerPool, resetDb, closePools, seedUsers, USER_A } from './helpers/db';
import { migrate } from '../src/migrate';

beforeAll(resetDb);
afterAll(closePools);

test('creates all tables', async () => {
  const { rows } = await ownerPool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const names = rows.map((r) => r.table_name);
  for (const t of ['conflict_ignores', 'conflict_zones', 'events', 'schema_migrations', 'users', 'work_hours']) {
    expect(names).toContain(t);
  }
});

test('running migrations again applies nothing', async () => {
  expect(await migrate(ownerPool)).toEqual([]);
});

test('rejects an event that ends before it starts', async () => {
  await seedUsers();
  await expect(
    ownerPool.query(
      `INSERT INTO events(user_id, title, start_at, end_at)
       VALUES ($1, 'x', '2026-01-01T10:00Z', '2026-01-01T09:00Z')`,
      [USER_A]
    )
  ).rejects.toThrow(/check constraint/);
});

test('rejects an ignore row whose event ids are not in canonical order', async () => {
  await seedUsers();
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  for (const id of ids) {
    await ownerPool.query(
      `INSERT INTO events(id, user_id, title, start_at, end_at)
       VALUES ($1, $2, 'e', '2026-01-01T10:00Z', '2026-01-01T11:00Z')`,
      [id, USER_A]
    );
  }
  await expect(
    ownerPool.query(
      `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode) VALUES ($1, $2, $3, 'allow')`,
      [USER_A, ids[1], ids[0]]
    )
  ).rejects.toThrow(/check constraint/);
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd server && npx jest tests/migrate.test.ts`
Expected: FAIL with "Cannot find module '../../src/migrate'".

- [ ] **Step 9: Create `server/src/migrate.ts`**

```ts
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const DEFAULT_DIR = path.join(__dirname, '..', 'migrations');

export async function migrate(pool: Pool, dir: string = DEFAULT_DIR): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );
  const done = new Set<string>(
    (await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name)
  );
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}
```

- [ ] **Step 10: Create `server/src/migrate-cli.ts`**

```ts
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { migrate } from './migrate';

dotenv.config();

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url });
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 11: Create `server/migrations/001_schema.sql`**

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  timezone text NOT NULL DEFAULT 'UTC'
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) > 0 AND length(title) <= 200),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'event' CHECK (kind IN ('event', 'time_block')),
  color text NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  notes text NULL CHECK (length(notes) <= 5000),
  source text NOT NULL DEFAULT 'local',
  external_id text NULL,
  external_color text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX events_user_start_idx ON events (user_id, start_at);

CREATE TABLE work_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE conflict_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  repeats_weekly boolean NOT NULL DEFAULT false,
  CHECK (end_at > start_at)
);

CREATE TABLE conflict_ignores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_a_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_b_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('once', 'allow')),
  overlap_start timestamptz NULL,
  overlap_end timestamptz NULL,
  CHECK (event_a_id < event_b_id),
  CHECK ((mode = 'once') = (overlap_start IS NOT NULL AND overlap_end IS NOT NULL)),
  UNIQUE (user_id, event_a_id, event_b_id)
);
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `cd server && npx jest tests/migrate.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 13: Create `server/.env.example`**

```
PORT=4000
# App connection: non-owner role (created by migration 002)
# (private cluster from scripts/dev-db.sh: unix socket under your home partition, port 5433)
DATABASE_URL=postgresql://app_user@/schedule_dev?host=/home/beezo/pgdata/schedule-app/sock&port=5433
# Migration connection: owner role
MIGRATION_DATABASE_URL=postgresql://postgres@/schedule_dev?host=/home/beezo/pgdata/schedule-app/sock&port=5433
CURRENT_USER_ID=00000000-0000-4000-8000-000000000001
USER_TIMEZONE=UTC
```

- [ ] **Step 14: Commit**

```bash
git add server
git commit -m "Add server test infrastructure, migration runner, and base schema"
```

---

### Task 2: Row Level Security, `app_user` role, and per-request user context

**Files:**
- Create: `server/migrations/002_rls.sql`, `server/src/config.ts`
- Modify: `server/src/db.ts` (replace entirely)
- Test: `server/tests/rls.test.ts`

**Interfaces:**
- Consumes: `resetDb`, `ownerPool`, `appPool`, `USER_A`, `USER_B`, `closePools` (Task 1).
- Produces: `createPool(url: string): Pool`; `withUser<T>(pool: Pool, userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T>` (runs `fn` in a transaction with `app.user_id` set); `ensureUser(pool: Pool, userId: string, timezone: string): Promise<void>`; `config` object `{ port: number; databaseUrl: string; userId: string; userTimezone: string }` from `src/config.ts`.

- [ ] **Step 1: Write the failing test `server/tests/rls.test.ts`**

```ts
import { appPool, ownerPool, resetDb, closePools, USER_A, USER_B } from './helpers/db';
import { withUser, ensureUser } from '../src/db';

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '33333333-3333-4333-8333-333333333333';
const B1 = '22222222-2222-4222-8222-222222222222';
const B2 = '44444444-4444-4444-8444-444444444444';

beforeAll(async () => {
  await resetDb();
  await ownerPool.query(`INSERT INTO users(id, timezone) VALUES ($1, 'UTC'), ($2, 'UTC')`, [USER_A, USER_B]);
  for (const [id, user] of [[A1, USER_A], [A2, USER_A], [B1, USER_B], [B2, USER_B]]) {
    await ownerPool.query(
      `INSERT INTO events(id, user_id, title, start_at, end_at)
       VALUES ($1, $2, 'e', '2026-01-01T10:00Z', '2026-01-01T11:00Z')`,
      [id, user]
    );
  }
  await ownerPool.query(
    `INSERT INTO work_hours(user_id, weekday, start_time, end_time) VALUES ($1, 1, '09:00', '17:00'), ($2, 1, '10:00', '18:00')`,
    [USER_A, USER_B]
  );
  await ownerPool.query(
    `INSERT INTO conflict_zones(user_id, start_at, end_at) VALUES ($1, '2026-01-01T09:00Z', '2026-01-01T17:00Z'), ($2, '2026-01-01T09:00Z', '2026-01-01T17:00Z')`,
    [USER_A, USER_B]
  );
  await ownerPool.query(
    `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode) VALUES ($1, $2, $3, 'allow'), ($4, $5, $6, 'allow')`,
    [USER_A, A1, A2, USER_B, B1, B2]
  );
});
afterAll(closePools);

test('the app connects as a role that cannot bypass RLS', async () => {
  const { rows } = await appPool.query(
    `SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`
  );
  expect(rows[0]).toEqual({ name: 'app_user', rolsuper: false, rolbypassrls: false });
});

test('RLS is enabled and forced on every user-data table', async () => {
  const { rows } = await ownerPool.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
     WHERE relname IN ('users', 'events', 'work_hours', 'conflict_zones', 'conflict_ignores')`
  );
  expect(rows).toHaveLength(5);
  for (const r of rows) {
    expect([r.relname, r.relrowsecurity, r.relforcerowsecurity]).toEqual([r.relname, true, true]);
  }
});

test.each(['events', 'work_hours', 'conflict_zones', 'conflict_ignores'])(
  'user A sees only their own rows in %s',
  async (table) => {
    const rows = await withUser(appPool, USER_A, async (c) => (await c.query(`SELECT user_id FROM ${table}`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.user_id).toBe(USER_A);
  }
);

test('user A sees only their own users row', async () => {
  const rows = await withUser(appPool, USER_A, async (c) => (await c.query('SELECT id FROM users')).rows);
  expect(rows).toEqual([{ id: USER_A }]);
});

test('with no user set, nothing is visible', async () => {
  expect((await appPool.query('SELECT * FROM events')).rows).toHaveLength(0);
});

test('user A cannot update or delete user B rows', async () => {
  const result = await withUser(appPool, USER_A, async (c) => {
    const u = await c.query(`UPDATE events SET title = 'hacked' WHERE id = $1`, [B1]);
    const d = await c.query(`DELETE FROM events WHERE id = $1`, [B1]);
    return [u.rowCount, d.rowCount];
  });
  expect(result).toEqual([0, 0]);
  const { rows } = await ownerPool.query(`SELECT title FROM events WHERE id = $1`, [B1]);
  expect(rows[0].title).toBe('e');
});

test('user A cannot insert a row owned by user B', async () => {
  await expect(
    withUser(appPool, USER_A, (c) =>
      c.query(
        `INSERT INTO events(user_id, title, start_at, end_at) VALUES ($1, 'x', '2026-01-02T10:00Z', '2026-01-02T11:00Z')`,
        [USER_B]
      )
    )
  ).rejects.toThrow(/row-level security/);
});

test('joins do not leak other users rows', async () => {
  const rows = await withUser(appPool, USER_A, async (c) =>
    (await c.query(
      `SELECT i.id, e.id AS event_id FROM conflict_ignores i JOIN events e ON e.id = i.event_a_id`
    )).rows
  );
  expect(rows.map((r) => r.event_id)).toEqual([A1]);
});

test('the pool keeps working after a failed transaction', async () => {
  await expect(withUser(appPool, USER_A, (c) => c.query('SELECT * FROM no_such_table'))).rejects.toThrow();
  const rows = await withUser(appPool, USER_A, async (c) => (await c.query('SELECT id FROM users')).rows);
  expect(rows).toHaveLength(1);
});

test('ensureUser creates a user once and updates the timezone', async () => {
  const NEW = '55555555-5555-4555-8555-555555555555';
  await ownerPool.query(`INSERT INTO users(id, timezone) VALUES ($1, 'UTC') ON CONFLICT DO NOTHING`, [NEW]);
  await ensureUser(appPool, NEW, 'America/New_York');
  await ensureUser(appPool, NEW, 'America/New_York');
  const { rows } = await ownerPool.query('SELECT timezone FROM users WHERE id = $1', [NEW]);
  expect(rows).toEqual([{ timezone: 'America/New_York' }]);
});

test('ensureUser works for an id that does not exist yet', async () => {
  const FRESH = '66666666-6666-4666-8666-666666666666';
  await ensureUser(appPool, FRESH, 'UTC');
  const { rows } = await ownerPool.query('SELECT id FROM users WHERE id = $1', [FRESH]);
  expect(rows).toHaveLength(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx jest tests/rls.test.ts`
Expected: FAIL (the `app_user` role does not exist yet, and `../src/db` has no `withUser`).

- [ ] **Step 3: Create `server/migrations/002_rls.sql`**

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON users, events, work_hours, conflict_zones, conflict_ignores TO app_user;

CREATE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_isolation ON users
  USING (id = app_current_user()) WITH CHECK (id = app_current_user());

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
CREATE POLICY events_isolation ON events
  USING (user_id = app_current_user()) WITH CHECK (user_id = app_current_user());

ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY work_hours_isolation ON work_hours
  USING (user_id = app_current_user()) WITH CHECK (user_id = app_current_user());

ALTER TABLE conflict_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_zones FORCE ROW LEVEL SECURITY;
CREATE POLICY conflict_zones_isolation ON conflict_zones
  USING (user_id = app_current_user()) WITH CHECK (user_id = app_current_user());

ALTER TABLE conflict_ignores ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_ignores FORCE ROW LEVEL SECURITY;
CREATE POLICY conflict_ignores_isolation ON conflict_ignores
  USING (user_id = app_current_user()) WITH CHECK (user_id = app_current_user());
```

- [ ] **Step 4: Create `server/src/config.ts`**

```ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  userId: process.env.CURRENT_USER_ID ?? '00000000-0000-4000-8000-000000000001',
  userTimezone: process.env.USER_TIMEZONE ?? 'UTC',
};
```

- [ ] **Step 5: Replace `server/src/db.ts`**

```ts
import { Pool, PoolClient } from 'pg';

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

/** Runs fn in a transaction where RLS sees `userId` as the current user. */
export async function withUser<T>(
  pool: Pool,
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function ensureUser(pool: Pool, userId: string, timezone: string): Promise<void> {
  await withUser(pool, userId, (c) =>
    c.query(
      `INSERT INTO users(id, timezone) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone`,
      [userId, timezone]
    )
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd server && npx jest`
Expected: PASS (migrate.test.ts and rls.test.ts). Note: `server/src/routes/events.ts` still imports the old `db` export and is not compiled by these tests; Task 4 rewrites it.

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "Add RLS policies, app_user role, and per-request user context"
```

---

### Task 3: `detectConflicts` pure function

**Files:**
- Create: `server/src/conflicts/detectConflicts.ts`
- Test: `server/tests/detectConflicts.test.ts`

**Interfaces:**
- Produces (all exported from `src/conflicts/detectConflicts.ts`):
  - `interface EventLike { id: string; start_at: Date; end_at: Date }`
  - `interface ZoneLike { start_at: Date; end_at: Date; repeats_weekly: boolean }`
  - `interface IgnoreLike { id: string; event_a_id: string; event_b_id: string; mode: 'once' | 'allow'; overlap_start: Date | null; overlap_end: Date | null }`
  - `interface Conflict { eventAId: string; eventBId: string; overlapStart: Date; overlapEnd: Date }` (`eventAId < eventBId`)
  - `interface IgnoredConflict extends Conflict { mode: 'once' | 'allow'; ignoreId: string }`
  - `detectConflicts(events: EventLike[], zones: ZoneLike[], ignores: IgnoreLike[], timezone: string): { active: Conflict[]; ignored: IgnoredConflict[] }` (both arrays sorted by `overlapStart`, then `eventAId`, then `eventBId`).

- [ ] **Step 1: Write the failing test `server/tests/detectConflicts.test.ts`**

```ts
import { detectConflicts, EventLike, ZoneLike, IgnoreLike } from '../src/conflicts/detectConflicts';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';
const ev = (id: string, start: string, end: string): EventLike => ({
  id,
  start_at: new Date(start),
  end_at: new Date(end),
});
const zone = (start: string, end: string, weekly = false): ZoneLike => ({
  start_at: new Date(start),
  end_at: new Date(end),
  repeats_weekly: weekly,
});

describe('overlap detection', () => {
  test('no events, no conflicts', () => {
    expect(detectConflicts([], [], [], 'UTC')).toEqual({ active: [], ignored: [] });
  });

  test('overlapping events conflict with the exact overlap interval', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'), ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z')],
      [], [], 'UTC'
    );
    expect(r.active).toEqual([
      { eventAId: A, eventBId: B, overlapStart: new Date('2026-01-05T11:00Z'), overlapEnd: new Date('2026-01-05T12:00Z') },
    ]);
  });

  test('touching end-to-start is not a conflict', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-05T10:00Z', '2026-01-05T11:00Z'), ev(B, '2026-01-05T11:00Z', '2026-01-05T12:00Z')],
      [], [], 'UTC'
    );
    expect(r.active).toEqual([]);
  });

  test('a contained event conflicts for its whole length', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-05T09:00Z', '2026-01-05T17:00Z'), ev(B, '2026-01-05T12:00Z', '2026-01-05T13:00Z')],
      [], [], 'UTC'
    );
    expect(r.active[0].overlapStart).toEqual(new Date('2026-01-05T12:00Z'));
    expect(r.active[0].overlapEnd).toEqual(new Date('2026-01-05T13:00Z'));
  });

  test('three mutually overlapping events produce three pairs', () => {
    const r = detectConflicts(
      [
        ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'),
        ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
        ev(C, '2026-01-05T11:30Z', '2026-01-05T12:30Z'),
      ],
      [], [], 'UTC'
    );
    expect(r.active.map((c) => `${c.eventAId[0]}${c.eventBId[0]}`).sort()).toEqual(['ab', 'ac', 'bc']);
  });

  test('input order does not matter and pair ids are canonical', () => {
    const r = detectConflicts(
      [ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'), ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z')],
      [], [], 'UTC'
    );
    expect(r.active).toHaveLength(1);
    expect(r.active[0].eventAId).toBe(A);
    expect(r.active[0].eventBId).toBe(B);
  });

  test('an event spanning midnight conflicts with one on the next day', () => {
    const r = detectConflicts(
      [ev(A, '2026-01-01T23:00Z', '2026-01-02T01:00Z'), ev(B, '2026-01-02T00:00Z', '2026-01-02T02:00Z')],
      [], [], 'UTC'
    );
    expect(r.active[0].overlapStart).toEqual(new Date('2026-01-02T00:00Z'));
    expect(r.active[0].overlapEnd).toEqual(new Date('2026-01-02T01:00Z'));
  });
});

describe('unconflicted zones', () => {
  const pair = [
    ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'),
    ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
  ]; // overlap 11:00-12:00

  test('a one-off zone containing the whole overlap suppresses the conflict entirely', () => {
    const r = detectConflicts(pair, [zone('2026-01-05T09:00Z', '2026-01-05T17:00Z')], [], 'UTC');
    expect(r).toEqual({ active: [], ignored: [] });
  });

  test('a zone that covers only part of the overlap does not suppress it', () => {
    const r = detectConflicts(pair, [zone('2026-01-05T09:00Z', '2026-01-05T11:30Z')], [], 'UTC');
    expect(r.active).toHaveLength(1);
  });

  test('a weekly zone suppresses the same weekday and time in later weeks', () => {
    const weekly = zone('2026-01-05T09:00Z', '2026-01-05T17:00Z', true); // Monday
    const nextMonday = [
      ev(A, '2026-01-12T10:00Z', '2026-01-12T12:00Z'),
      ev(B, '2026-01-12T11:00Z', '2026-01-12T13:00Z'),
    ];
    expect(detectConflicts(nextMonday, [weekly], [], 'UTC').active).toEqual([]);
  });

  test('a weekly zone does not apply on other weekdays', () => {
    const weekly = zone('2026-01-05T09:00Z', '2026-01-05T17:00Z', true);
    const tuesday = [
      ev(A, '2026-01-13T10:00Z', '2026-01-13T12:00Z'),
      ev(B, '2026-01-13T11:00Z', '2026-01-13T13:00Z'),
    ];
    expect(detectConflicts(tuesday, [weekly], [], 'UTC').active).toHaveLength(1);
  });

  test('a weekly zone does not apply to weeks before it was created', () => {
    const weekly = zone('2026-01-05T09:00Z', '2026-01-05T17:00Z', true);
    const before = [
      ev(A, '2025-12-29T10:00Z', '2025-12-29T12:00Z'),
      ev(B, '2025-12-29T11:00Z', '2025-12-29T13:00Z'),
    ];
    expect(detectConflicts(before, [weekly], [], 'UTC').active).toHaveLength(1);
  });

  test('a weekly zone keeps its local clock time across a daylight-saving change', () => {
    // Mon 09:00-17:00 New York in winter (EST) = 14:00Z-22:00Z.
    const weekly = zone('2026-03-02T14:00Z', '2026-03-02T22:00Z', true);
    // DST began Sun 2026-03-08, so Mon 03-09 09:00 local = 13:00Z. An overlap at 13:15Z-13:45Z is inside the zone.
    const afterDst = [
      ev(A, '2026-03-09T13:15Z', '2026-03-09T14:00Z'),
      ev(B, '2026-03-09T13:00Z', '2026-03-09T13:45Z'),
    ];
    expect(detectConflicts(afterDst, [weekly], [], 'America/New_York').active).toEqual([]);
  });
});

describe('ignores', () => {
  const pair = [
    ev(A, '2026-01-05T10:00Z', '2026-01-05T12:00Z'),
    ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
  ];
  const ignore = (over: Partial<IgnoreLike>): IgnoreLike => ({
    id: 'ign-1',
    event_a_id: A,
    event_b_id: B,
    mode: 'once',
    overlap_start: new Date('2026-01-05T11:00Z'),
    overlap_end: new Date('2026-01-05T12:00Z'),
    ...over,
  });

  test('"once" hides the conflict while the overlap is unchanged', () => {
    const r = detectConflicts(pair, [], [ignore({})], 'UTC');
    expect(r.active).toEqual([]);
    expect(r.ignored).toEqual([
      {
        eventAId: A, eventBId: B,
        overlapStart: new Date('2026-01-05T11:00Z'), overlapEnd: new Date('2026-01-05T12:00Z'),
        mode: 'once', ignoreId: 'ign-1',
      },
    ]);
  });

  test('"once" raises the conflict again when the overlap changes', () => {
    const moved = [
      ev(A, '2026-01-05T10:00Z', '2026-01-05T12:30Z'),
      ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
    ];
    const r = detectConflicts(moved, [], [ignore({})], 'UTC');
    expect(r.active).toHaveLength(1);
    expect(r.ignored).toEqual([]);
  });

  test('"allow" keeps hiding the conflict however the overlap changes', () => {
    const moved = [
      ev(A, '2026-01-05T10:00Z', '2026-01-05T12:30Z'),
      ev(B, '2026-01-05T11:00Z', '2026-01-05T13:00Z'),
    ];
    const r = detectConflicts(moved, [], [ignore({ mode: 'allow', overlap_start: null, overlap_end: null })], 'UTC');
    expect(r.active).toEqual([]);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0].mode).toBe('allow');
  });

  test('an ignore for events that no longer overlap does nothing', () => {
    const apart = [
      ev(A, '2026-01-05T10:00Z', '2026-01-05T11:00Z'),
      ev(B, '2026-01-05T12:00Z', '2026-01-05T13:00Z'),
    ];
    expect(detectConflicts(apart, [], [ignore({ mode: 'allow', overlap_start: null, overlap_end: null })], 'UTC'))
      .toEqual({ active: [], ignored: [] });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx jest tests/detectConflicts.test.ts`
Expected: FAIL with "Cannot find module '../src/conflicts/detectConflicts'".

- [ ] **Step 3: Create `server/src/conflicts/detectConflicts.ts`**

```ts
import { DateTime } from 'luxon';

export interface EventLike {
  id: string;
  start_at: Date;
  end_at: Date;
}

export interface ZoneLike {
  start_at: Date;
  end_at: Date;
  repeats_weekly: boolean;
}

export interface IgnoreLike {
  id: string;
  event_a_id: string;
  event_b_id: string;
  mode: 'once' | 'allow';
  overlap_start: Date | null;
  overlap_end: Date | null;
}

export interface Conflict {
  eventAId: string;
  eventBId: string;
  overlapStart: Date;
  overlapEnd: Date;
}

export interface IgnoredConflict extends Conflict {
  mode: 'once' | 'allow';
  ignoreId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function insideZone(zone: ZoneLike, overlapStart: Date, overlapEnd: Date, timezone: string): boolean {
  const os = overlapStart.getTime();
  const oe = overlapEnd.getTime();
  if (!zone.repeats_weekly) {
    return zone.start_at.getTime() <= os && zone.end_at.getTime() >= oe;
  }
  const zoneStart = DateTime.fromJSDate(zone.start_at, { zone: timezone });
  const durationMs = zone.end_at.getTime() - zone.start_at.getTime();
  const overlapDay = DateTime.fromJSDate(overlapStart, { zone: timezone }).startOf('day');
  const daysBack = Math.ceil(durationMs / DAY_MS);
  for (let offset = -daysBack; offset <= 0; offset++) {
    const day = overlapDay.plus({ days: offset });
    if (day.weekday !== zoneStart.weekday) continue;
    const occurrenceStart = day.set({
      hour: zoneStart.hour,
      minute: zoneStart.minute,
      second: zoneStart.second,
      millisecond: zoneStart.millisecond,
    });
    if (occurrenceStart.toMillis() < zone.start_at.getTime()) continue;
    const occurrenceEnd = occurrenceStart.toMillis() + durationMs;
    if (occurrenceStart.toMillis() <= os && occurrenceEnd >= oe) return true;
  }
  return false;
}

function byOverlap(a: Conflict, b: Conflict): number {
  return (
    a.overlapStart.getTime() - b.overlapStart.getTime() ||
    (a.eventAId < b.eventAId ? -1 : a.eventAId > b.eventAId ? 1 : 0) ||
    (a.eventBId < b.eventBId ? -1 : a.eventBId > b.eventBId ? 1 : 0)
  );
}

export function detectConflicts(
  events: EventLike[],
  zones: ZoneLike[],
  ignores: IgnoreLike[],
  timezone: string
): { active: Conflict[]; ignored: IgnoredConflict[] } {
  const sorted = [...events].sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
  const ignoreByPair = new Map<string, IgnoreLike>();
  for (const ig of ignores) ignoreByPair.set(`${ig.event_a_id}|${ig.event_b_id}`, ig);

  const active: Conflict[] = [];
  const ignored: IgnoredConflict[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.start_at.getTime() >= a.end_at.getTime()) break; // sorted by start: nothing later can overlap a
      const overlapStart = b.start_at;
      const overlapEnd = new Date(Math.min(a.end_at.getTime(), b.end_at.getTime()));
      const [first, second] = a.id < b.id ? [a, b] : [b, a];
      const conflict: Conflict = { eventAId: first.id, eventBId: second.id, overlapStart, overlapEnd };

      if (zones.some((z) => insideZone(z, overlapStart, overlapEnd, timezone))) continue;

      const ig = ignoreByPair.get(`${first.id}|${second.id}`);
      if (ig) {
        const stillSame =
          ig.mode === 'allow' ||
          (ig.overlap_start?.getTime() === overlapStart.getTime() &&
            ig.overlap_end?.getTime() === overlapEnd.getTime());
        if (stillSame) {
          ignored.push({ ...conflict, mode: ig.mode, ignoreId: ig.id });
          continue;
        }
      }
      active.push(conflict);
    }
  }
  active.sort(byOverlap);
  ignored.sort(byOverlap);
  return { active, ignored };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx jest tests/detectConflicts.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "Add detectConflicts with zone, ignore, and daylight-saving handling"
```


### Task 4: App skeleton, error shape, validation, and events CRUD

**Files:**
- Create: `server/src/types.ts`, `server/src/errors.ts`, `server/src/reservedColors.ts`, `server/src/validation.ts`, `server/src/app.ts`
- Modify: `server/src/routes/events.ts` (replace entirely), `server/src/index.ts` (replace entirely)
- Test: `server/tests/events.test.ts`

**Interfaces:**
- Consumes: `withUser`, `ensureUser`, `createPool`, `config` (Task 2); test helpers (Task 1).
- Produces:
  - `interface Ctx { pool: Pool; userId: string }` (`src/types.ts`)
  - `class ApiError extends Error { constructor(status: number, code: string, message: string, details?: unknown) }`, `errorHandler`, `notFoundHandler` (`src/errors.ts`)
  - `isReservedColor(value: string | null | undefined): boolean` (`src/reservedColors.ts`)
  - From `src/validation.ts`: `bad(message: string, field: string): never`, `requireUuid(value: unknown, field?: string): string`, `parseDate(value: unknown, field: string): Date`, `optionalDate(value: unknown, field: string): Date | null`, `parseTime(value: unknown, field: string): string` (returns `HH:MM`), `parseEventFields(body: unknown, existing?: EventFields): EventFields`
  - `createApp(ctx: Ctx): express.Express` (`src/app.ts`); `eventsRouter(ctx: Ctx): Router`
  - HTTP: `GET /api/events?from&to`, `POST /api/events` (201), `PUT /api/events/:id`, `DELETE /api/events/:id` (204). Event JSON fields: `id, user_id, title, start_at, end_at, kind, color, notes, source, external_id, external_color, created_at, updated_at`.

- [ ] **Step 1: Write the failing test `server/tests/events.test.ts`**

```ts
import request from 'supertest';
import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A, USER_B } from './helpers/db';
import { createApp } from '../src/app';

const appA = createApp({ pool: appPool, userId: USER_A });
const appB = createApp({ pool: appPool, userId: USER_B });
const valid = { title: 'Planning', start_at: '2026-01-05T10:00:00Z', end_at: '2026-01-05T11:00:00Z' };

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
beforeEach(() => ownerPool.query('TRUNCATE events CASCADE'));
afterAll(closePools);

describe('POST /api/events', () => {
  test('creates an event with defaults', async () => {
    const res = await request(appA).post('/api/events').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Planning', kind: 'event', color: null, source: 'local', user_id: USER_A });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.start_at).toBe('2026-01-05T10:00:00.000Z');
  });

  test('trims the title and accepts emoji and exactly 200 characters', async () => {
    const long = '🎉'.repeat(100); // 100 emoji = 200 UTF-16 code units
    const res = await request(appA).post('/api/events').send({ ...valid, title: `  ${long}  ` });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe(long);
  });

  test.each([
    ['empty title', { title: '   ' }],
    ['title over 200 characters', { title: 'x'.repeat(201) }],
    ['end before start', { end_at: '2026-01-05T09:00:00Z' }],
    ['end equal to start', { end_at: '2026-01-05T10:00:00Z' }],
    ['unparseable start', { start_at: 'not a date' }],
    ['bad color', { color: 'red' }],
    ['bad kind', { kind: 'meeting' }],
    ['non-string notes', { notes: 5 }],
  ])('rejects %s with the standard error shape', async (_name, patch) => {
    const res = await request(appA).post('/api/events').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(typeof res.body.error.message).toBe('string');
  });

  test.each(['title', 'start_at', 'end_at'])('rejects a missing %s', async (field) => {
    const body: Record<string, unknown> = { ...valid };
    delete body[field];
    const res = await request(appA).post('/api/events').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ field });
  });

  test.each(['#FF8A5B', '#ff8a5b', '#A8D4FF', '#9b6bff'])('rejects the reserved color %s', async (color) => {
    const res = await request(appA).post('/api/events').send({ ...valid, color });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('reserved_color');
  });

  test('accepts a non-reserved color, including one close to coral', async () => {
    const res = await request(appA).post('/api/events').send({ ...valid, color: '#FF8A5C' });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe('#FF8A5C');
  });

  test('rejects malformed JSON with the standard error shape', async () => {
    const res = await request(appA).post('/api/events').set('Content-Type', 'application/json').send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('GET /api/events', () => {
  test('returns events ordered by start time', async () => {
    await request(appA).post('/api/events').send({ ...valid, title: 'Later', start_at: '2026-01-05T14:00:00Z', end_at: '2026-01-05T15:00:00Z' });
    await request(appA).post('/api/events').send({ ...valid, title: 'Earlier' });
    const res = await request(appA).get('/api/events');
    expect(res.body.map((e: { title: string }) => e.title)).toEqual(['Earlier', 'Later']);
  });

  test('filters by from/to window using overlap', async () => {
    await request(appA).post('/api/events').send({ ...valid, title: 'Jan 5' });
    await request(appA).post('/api/events').send({ ...valid, title: 'Jan 20', start_at: '2026-01-20T10:00:00Z', end_at: '2026-01-20T11:00:00Z' });
    const res = await request(appA).get('/api/events?from=2026-01-05T10:30:00Z&to=2026-01-06T00:00:00Z');
    expect(res.body.map((e: { title: string }) => e.title)).toEqual(['Jan 5']);
  });

  test('rejects an invalid from', async () => {
    const res = await request(appA).get('/api/events?from=nope');
    expect(res.status).toBe(400);
  });

  test("never returns another user's events", async () => {
    await request(appB).post('/api/events').send({ ...valid, title: 'B only' });
    expect((await request(appA).get('/api/events')).body).toEqual([]);
  });
});

describe('PUT /api/events/:id', () => {
  test('updates fields and bumps updated_at', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ title: 'Renamed', color: '#4A63F0' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Renamed', color: '#4A63F0', start_at: created.start_at });
    expect(new Date(res.body.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(created.updated_at).getTime());
  });

  test('moves an event by changing both times', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    const res = await request(appA)
      .put(`/api/events/${created.id}`)
      .send({ start_at: '2026-01-06T10:00:00Z', end_at: '2026-01-06T11:15:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.end_at).toBe('2026-01-06T11:15:00.000Z');
  });

  test('rejects an update that makes the end earlier than the existing start', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ end_at: '2026-01-05T09:00:00Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(appA).put('/api/events/99999999-9999-4999-8999-999999999999').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  test("returns 404 for another user's event and leaves it unchanged", async () => {
    const created = (await request(appB).post('/api/events').send(valid)).body;
    const res = await request(appA).put(`/api/events/${created.id}`).send({ title: 'hacked' });
    expect(res.status).toBe(404);
    const { rows } = await ownerPool.query('SELECT title FROM events WHERE id = $1', [created.id]);
    expect(rows[0].title).toBe('Planning');
  });

  test('returns 400 for an id that is not a UUID', async () => {
    const res = await request(appA).put('/api/events/abc').send({ title: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/events/:id', () => {
  test('deletes the event', async () => {
    const created = (await request(appA).post('/api/events').send(valid)).body;
    expect((await request(appA).delete(`/api/events/${created.id}`)).status).toBe(204);
    expect((await request(appA).get('/api/events')).body).toEqual([]);
  });

  test('returns 404 for an unknown id', async () => {
    expect((await request(appA).delete('/api/events/99999999-9999-4999-8999-999999999999')).status).toBe(404);
  });

  test("returns 404 for another user's event and keeps it", async () => {
    const created = (await request(appB).post('/api/events').send(valid)).body;
    expect((await request(appA).delete(`/api/events/${created.id}`)).status).toBe(404);
    expect((await request(appB).get('/api/events')).body).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx jest tests/events.test.ts`
Expected: FAIL with "Cannot find module '../src/app'".

- [ ] **Step 3: Create `server/src/types.ts`**

```ts
import { Pool } from 'pg';

export interface Ctx {
  pool: Pool;
  userId: string;
}
```

- [ ] **Step 4: Create `server/src/errors.ts`**

```ts
import { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
```

- [ ] **Step 5: Create `server/src/reservedColors.ts`**

```ts
// Must match client/my_scheduler/src/styles/reservedColors.ts (coral, work-hours light blue, UI purple).
export const RESERVED_COLORS = ['#FF8A5B', '#A8D4FF', '#9B6BFF'];

export function isReservedColor(value: string | null | undefined): boolean {
  return !!value && RESERVED_COLORS.includes(value.trim().toUpperCase());
}
```

- [ ] **Step 6: Create `server/src/validation.ts`**

```ts
import { ApiError } from './errors';
import { isReservedColor } from './reservedColors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function bad(message: string, field: string): never {
  throw new ApiError(400, 'validation_error', message, { field });
}

export function requireUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) bad(`${field} must be a UUID`, field);
  return (value as string).toLowerCase();
}

export function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') bad(`${field} must be an ISO timestamp`, field);
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) bad(`${field} must be a valid ISO timestamp`, field);
  return d;
}

export function optionalDate(value: unknown, field: string): Date | null {
  return value === undefined || value === '' ? null : parseDate(value, field);
}

export function parseTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !TIME_RE.test(value)) bad(`${field} must be HH:MM`, field);
  return (value as string).slice(0, 5);
}

export interface EventFields {
  title: string;
  start_at: Date;
  end_at: Date;
  kind: 'event' | 'time_block';
  color: string | null;
  notes: string | null;
}

/** Validates a create body (no `existing`) or merges a partial update over `existing`. */
export function parseEventFields(body: unknown, existing?: EventFields): EventFields {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  if (!existing) {
    for (const k of ['title', 'start_at', 'end_at']) if (!has(k)) bad(`${k} is required`, k);
  }
  const out: EventFields = existing
    ? { ...existing }
    : { title: '', start_at: new Date(0), end_at: new Date(0), kind: 'event', color: null, notes: null };

  if (has('title')) {
    if (typeof b.title !== 'string') bad('title must be a string', 'title');
    const t = (b.title as string).trim();
    if (!t) bad('title must not be empty', 'title');
    if (t.length > 200) bad('title must be at most 200 characters', 'title');
    out.title = t;
  }
  if (has('start_at')) out.start_at = parseDate(b.start_at, 'start_at');
  if (has('end_at')) out.end_at = parseDate(b.end_at, 'end_at');
  if (has('kind')) {
    if (b.kind !== 'event' && b.kind !== 'time_block') bad("kind must be 'event' or 'time_block'", 'kind');
    out.kind = b.kind as EventFields['kind'];
  }
  if (has('color')) {
    if (b.color === null) {
      out.color = null;
    } else {
      if (typeof b.color !== 'string' || !HEX_RE.test(b.color)) bad('color must be a #RRGGBB hex value', 'color');
      if (isReservedColor(b.color as string)) {
        throw new ApiError(400, 'reserved_color', 'That exact color is reserved by the app. Pick a different shade.', {
          field: 'color',
        });
      }
      out.color = b.color as string;
    }
  }
  if (has('notes')) {
    if (b.notes !== null && typeof b.notes !== 'string') bad('notes must be a string or null', 'notes');
    if (typeof b.notes === 'string' && b.notes.length > 5000) bad('notes must be at most 5000 characters', 'notes');
    out.notes = b.notes as string | null;
  }
  if (out.end_at.getTime() <= out.start_at.getTime()) bad('end_at must be after start_at', 'end_at');
  return out;
}
```

- [ ] **Step 7: Replace `server/src/routes/events.ts`**

```ts
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
```

- [ ] **Step 8: Create `server/src/app.ts`**

```ts
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
```

- [ ] **Step 9: Replace `server/src/index.ts`**

```ts
import { createApp } from './app';
import { config } from './config';
import { createPool, ensureUser } from './db';

async function main() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set (see server/.env.example)');
  const pool = createPool(config.databaseUrl);
  await ensureUser(pool, config.userId, config.userTimezone);
  createApp({ pool, userId: config.userId }).listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `cd server && npx jest`
Expected: PASS for all files. Also run `npx tsc -p tsconfig.build.json --noEmit` (expected: no output).

- [ ] **Step 11: Run the dev server once to confirm startup**

```bash
../scripts/dev-db.sh status   # must be running; otherwise ../scripts/dev-db.sh start
cp .env.example .env
npm run migrate        # expected: Applied: 001_schema.sql, 002_rls.sql
npm run dev            # expected: "Server running on port 4000"
```

Stop the dev server after confirming. (`.env` is gitignored.)

- [ ] **Step 12: Commit**

```bash
git add server
git commit -m "Add events CRUD with validation, standard errors, and reserved-color rule"
```

---

### Task 5: Work hours, conflict zones, and conflict ignores routes

**Files:**
- Create: `server/src/routes/workHours.ts`, `server/src/routes/conflictZones.ts`, `server/src/routes/conflictIgnores.ts`
- Modify: `server/src/app.ts` (mount three routers)
- Test: `server/tests/settingsRoutes.test.ts`

**Interfaces:**
- Consumes: everything produced by Task 4.
- Produces (HTTP):
  - `GET /api/work-hours` returns `[{ weekday: number, start_time: 'HH:MM', end_time: 'HH:MM' }]` sorted by weekday then start; `PUT /api/work-hours` with body `{ "workHours": [...same shape...] }` replaces the whole set and returns the new list.
  - `GET /api/conflict-zones` returns `[{ id, user_id, start_at, end_at, repeats_weekly }]`; `POST /api/conflict-zones` with `{ start_at, end_at, repeats_weekly? }` returns 201; `DELETE /api/conflict-zones/:id` returns 204.
  - `GET /api/conflict-ignores` returns `[{ id, event_a_id, event_b_id, mode, overlap_start, overlap_end, event_a_title, event_b_title }]`; `POST /api/conflict-ignores` with `{ eventAId, eventBId, mode: 'once' | 'allow' }` returns 201 with the stored row (re-posting the same pair replaces it); `DELETE /api/conflict-ignores/:id` returns 204.

- [ ] **Step 1: Write the failing test `server/tests/settingsRoutes.test.ts`**

```ts
import request from 'supertest';
import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A, USER_B } from './helpers/db';
import { createApp } from '../src/app';

const appA = createApp({ pool: appPool, userId: USER_A });
const appB = createApp({ pool: appPool, userId: USER_B });

const mk = async (app: typeof appA, title: string, start: string, end: string) =>
  (await request(app).post('/api/events').send({ title, start_at: start, end_at: end })).body;

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
beforeEach(() => ownerPool.query('TRUNCATE events, work_hours, conflict_zones CASCADE'));
afterAll(closePools);

describe('work hours', () => {
  const body = { workHours: [
    { weekday: 1, start_time: '09:00', end_time: '17:00' },
    { weekday: 2, start_time: '09:30', end_time: '12:00' },
    { weekday: 2, start_time: '13:00', end_time: '17:30' },
  ] };

  test('PUT replaces the full set and GET returns it ordered', async () => {
    await request(appA).put('/api/work-hours').send({ workHours: [{ weekday: 5, start_time: '08:00', end_time: '10:00' }] });
    const put = await request(appA).put('/api/work-hours').send(body);
    expect(put.status).toBe(200);
    expect((await request(appA).get('/api/work-hours')).body).toEqual(body.workHours);
  });

  test('PUT with an empty list clears work hours', async () => {
    await request(appA).put('/api/work-hours').send(body);
    await request(appA).put('/api/work-hours').send({ workHours: [] });
    expect((await request(appA).get('/api/work-hours')).body).toEqual([]);
  });

  test.each([
    ['weekday 7', { weekday: 7, start_time: '09:00', end_time: '10:00' }],
    ['bad time', { weekday: 1, start_time: '9am', end_time: '10:00' }],
    ['end before start', { weekday: 1, start_time: '10:00', end_time: '09:00' }],
  ])('rejects %s', async (_n, entry) => {
    const res = await request(appA).put('/api/work-hours').send({ workHours: [entry] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  test('rejects overlapping ranges on the same weekday', async () => {
    const res = await request(appA).put('/api/work-hours').send({ workHours: [
      { weekday: 1, start_time: '09:00', end_time: '12:00' },
      { weekday: 1, start_time: '11:00', end_time: '13:00' },
    ] });
    expect(res.status).toBe(400);
  });

  test('rejects a body without workHours', async () => {
    expect((await request(appA).put('/api/work-hours').send({})).status).toBe(400);
  });

  test("a failed PUT keeps the previous set, and users do not see each other's", async () => {
    await request(appA).put('/api/work-hours').send(body);
    await request(appA).put('/api/work-hours').send({ workHours: [{ weekday: 9, start_time: '09:00', end_time: '10:00' }] });
    expect((await request(appA).get('/api/work-hours')).body).toEqual(body.workHours);
    expect((await request(appB).get('/api/work-hours')).body).toEqual([]);
  });
});

describe('conflict zones', () => {
  const zone = { start_at: '2026-01-05T09:00:00Z', end_at: '2026-01-05T17:00:00Z' };

  test('creates, lists, and deletes a zone', async () => {
    const created = await request(appA).post('/api/conflict-zones').send({ ...zone, repeats_weekly: true });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ repeats_weekly: true, user_id: USER_A });
    expect((await request(appA).get('/api/conflict-zones')).body).toHaveLength(1);
    expect((await request(appA).delete(`/api/conflict-zones/${created.body.id}`)).status).toBe(204);
    expect((await request(appA).get('/api/conflict-zones')).body).toEqual([]);
  });

  test('repeats_weekly defaults to false', async () => {
    expect((await request(appA).post('/api/conflict-zones').send(zone)).body.repeats_weekly).toBe(false);
  });

  test.each([
    ['end before start', { start_at: zone.end_at, end_at: zone.start_at }],
    ['bad date', { start_at: 'x', end_at: zone.end_at }],
    ['non-boolean repeats_weekly', { ...zone, repeats_weekly: 'yes' }],
  ])('rejects %s', async (_n, payload) => {
    expect((await request(appA).post('/api/conflict-zones').send(payload)).status).toBe(400);
  });

  test("404 when deleting another user's zone", async () => {
    const z = (await request(appB).post('/api/conflict-zones').send(zone)).body;
    expect((await request(appA).delete(`/api/conflict-zones/${z.id}`)).status).toBe(404);
  });
});

describe('conflict ignores', () => {
  test("'once' stores the current overlap interval", async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const res = await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
    expect(res.status).toBe(201);
    expect(res.body.overlap_start).toBe('2026-01-05T11:00:00.000Z');
    expect(res.body.overlap_end).toBe('2026-01-05T12:00:00.000Z');
  });

  test("'allow' stores no interval, and ids are stored in canonical order whichever way they are sent", async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const res = await request(appA).post('/api/conflict-ignores').send({ eventAId: hi, eventBId: lo, mode: 'allow' });
    expect(res.body).toMatchObject({ event_a_id: lo, event_b_id: hi, mode: 'allow', overlap_start: null, overlap_end: null });
  });

  test('posting the same pair again replaces the earlier choice', async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
    const list = (await request(appA).get('/api/conflict-ignores')).body;
    expect(list).toHaveLength(1);
    expect(list[0].mode).toBe('allow');
  });

  test('the list includes event titles', async () => {
    const a = await mk(appA, 'Alpha', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'Beta', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
    const [row] = (await request(appA).get('/api/conflict-ignores')).body;
    expect([row.event_a_title, row.event_b_title].sort()).toEqual(['Alpha', 'Beta']);
  });

  test('rejects events that do not overlap, the same id twice, and a bad mode', async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T12:00:00Z', '2026-01-05T13:00:00Z');
    const none = await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('no_overlap');
    expect((await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: a.id, mode: 'once' })).status).toBe(400);
    expect((await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'maybe' })).status).toBe(400);
  });

  test("404 when either event belongs to another user", async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const bOther = await mk(appB, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const res = await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: bOther.id, mode: 'allow' });
    expect(res.status).toBe(404);
  });

  test('delete removes the choice; deleting an event removes its ignores', async () => {
    const a = await mk(appA, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z');
    const b = await mk(appA, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z');
    const ig = (await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' })).body;
    expect((await request(appA).delete(`/api/conflict-ignores/${ig.id}`)).status).toBe(204);
    expect((await request(appA).get('/api/conflict-ignores')).body).toEqual([]);
    await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
    await request(appA).delete(`/api/events/${a.id}`);
    expect((await request(appA).get('/api/conflict-ignores')).body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx jest tests/settingsRoutes.test.ts`
Expected: FAIL (the routes return 404 "Route not found").

- [ ] **Step 3: Create `server/src/routes/workHours.ts`**

```ts
import { Router } from 'express';
import { withUser } from '../db';
import { Ctx } from '../types';
import { bad, parseTime } from '../validation';

interface Entry {
  weekday: number;
  start_time: string;
  end_time: string;
}

export function workHoursRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  const list = (c: import('pg').PoolClient) =>
    c
      .query(
        `SELECT weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
         FROM work_hours ORDER BY weekday, start_time`
      )
      .then((r) => r.rows as Entry[]);

  router.get('/', async (_req, res) => {
    res.json(await withUser(pool, userId, list));
  });

  router.put('/', async (req, res) => {
    const input = req.body?.workHours;
    if (!Array.isArray(input)) bad('workHours must be an array', 'workHours');
    const entries: Entry[] = (input as unknown[]).map((raw, i) => {
      const e = (raw ?? {}) as Record<string, unknown>;
      if (!Number.isInteger(e.weekday) || (e.weekday as number) < 0 || (e.weekday as number) > 6) {
        bad('weekday must be an integer from 0 (Sunday) to 6', `workHours[${i}].weekday`);
      }
      const start_time = parseTime(e.start_time, `workHours[${i}].start_time`);
      const end_time = parseTime(e.end_time, `workHours[${i}].end_time`);
      if (end_time <= start_time) bad('end_time must be after start_time', `workHours[${i}].end_time`);
      return { weekday: e.weekday as number, start_time, end_time };
    });
    const sorted = [...entries].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].weekday === sorted[i - 1].weekday && sorted[i].start_time < sorted[i - 1].end_time) {
        bad('work hour ranges on the same weekday must not overlap', 'workHours');
      }
    }
    const result = await withUser(pool, userId, async (c) => {
      await c.query('DELETE FROM work_hours');
      for (const e of sorted) {
        await c.query(
          'INSERT INTO work_hours(user_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [userId, e.weekday, e.start_time, e.end_time]
        );
      }
      return list(c);
    });
    res.json(result);
  });

  return router;
}
```

- [ ] **Step 4: Create `server/src/routes/conflictZones.ts`**

```ts
import { Router } from 'express';
import { withUser } from '../db';
import { ApiError } from '../errors';
import { Ctx } from '../types';
import { bad, parseDate, requireUuid } from '../validation';

export function conflictZonesRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await withUser(pool, userId, async (c) => (await c.query('SELECT * FROM conflict_zones ORDER BY start_at')).rows);
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const start = parseDate(b.start_at, 'start_at');
    const end = parseDate(b.end_at, 'end_at');
    if (end.getTime() <= start.getTime()) bad('end_at must be after start_at', 'end_at');
    if (b.repeats_weekly !== undefined && typeof b.repeats_weekly !== 'boolean') {
      bad('repeats_weekly must be true or false', 'repeats_weekly');
    }
    const row = await withUser(pool, userId, async (c) => {
      const r = await c.query(
        'INSERT INTO conflict_zones(user_id, start_at, end_at, repeats_weekly) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, start, end, b.repeats_weekly ?? false]
      );
      return r.rows[0];
    });
    res.status(201).json(row);
  });

  router.delete('/:id', async (req, res) => {
    const id = requireUuid(req.params.id);
    const count = await withUser(pool, userId, async (c) => (await c.query('DELETE FROM conflict_zones WHERE id = $1', [id])).rowCount);
    if (!count) throw new ApiError(404, 'not_found', 'Conflict zone not found');
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 5: Create `server/src/routes/conflictIgnores.ts`**

```ts
import { Router } from 'express';
import { withUser } from '../db';
import { ApiError } from '../errors';
import { Ctx } from '../types';
import { bad, requireUuid } from '../validation';

export function conflictIgnoresRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await withUser(pool, userId, async (c) =>
      (await c.query(
        `SELECT i.id, i.event_a_id, i.event_b_id, i.mode, i.overlap_start, i.overlap_end,
                a.title AS event_a_title, b.title AS event_b_title
         FROM conflict_ignores i
         JOIN events a ON a.id = i.event_a_id
         JOIN events b ON b.id = i.event_b_id
         ORDER BY a.start_at, i.id`
      )).rows
    );
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const idA = requireUuid(b.eventAId, 'eventAId');
    const idB = requireUuid(b.eventBId, 'eventBId');
    if (idA === idB) bad('eventAId and eventBId must be different events', 'eventBId');
    if (b.mode !== 'once' && b.mode !== 'allow') bad("mode must be 'once' or 'allow'", 'mode');
    const [lo, hi] = idA < idB ? [idA, idB] : [idB, idA];

    const row = await withUser(pool, userId, async (c) => {
      const found = await c.query('SELECT id, start_at, end_at FROM events WHERE id = ANY($1::uuid[])', [[lo, hi]]);
      if (found.rowCount !== 2) throw new ApiError(404, 'not_found', 'Event not found');
      const starts = found.rows.map((r) => r.start_at.getTime());
      const ends = found.rows.map((r) => r.end_at.getTime());
      const overlapStart = Math.max(...starts);
      const overlapEnd = Math.min(...ends);
      if (overlapStart >= overlapEnd) throw new ApiError(400, 'no_overlap', 'Those events do not overlap');
      const once = b.mode === 'once';
      const result = await c.query(
        `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode, overlap_start, overlap_end)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, event_a_id, event_b_id)
         DO UPDATE SET mode = EXCLUDED.mode, overlap_start = EXCLUDED.overlap_start, overlap_end = EXCLUDED.overlap_end
         RETURNING *`,
        [userId, lo, hi, b.mode, once ? new Date(overlapStart) : null, once ? new Date(overlapEnd) : null]
      );
      return result.rows[0];
    });
    res.status(201).json(row);
  });

  router.delete('/:id', async (req, res) => {
    const id = requireUuid(req.params.id);
    const count = await withUser(pool, userId, async (c) => (await c.query('DELETE FROM conflict_ignores WHERE id = $1', [id])).rowCount);
    if (!count) throw new ApiError(404, 'not_found', 'Conflict choice not found');
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 6: Mount the routers in `server/src/app.ts`**

Replace the comment `// Tasks 5 and 6 mount the remaining routers here.` with:

```ts
  app.use('/api/work-hours', workHoursRouter(ctx));
  app.use('/api/conflict-zones', conflictZonesRouter(ctx));
  app.use('/api/conflict-ignores', conflictIgnoresRouter(ctx));
  // Task 6 mounts /api/conflicts here.
```

and add these imports at the top:

```ts
import { conflictIgnoresRouter } from './routes/conflictIgnores';
import { conflictZonesRouter } from './routes/conflictZones';
import { workHoursRouter } from './routes/workHours';
```

- [ ] **Step 7: Run all server tests to verify they pass**

Run: `cd server && npx jest`
Expected: PASS for all files.

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "Add work hours, conflict zones, and conflict ignores routes"
```

---

### Task 6: Conflicts endpoint and demo data

**Files:**
- Create: `server/src/routes/conflicts.ts`, `server/scripts/seed-demo.ts`
- Modify: `server/src/app.ts` (mount router)
- Test: `server/tests/conflictsRoute.test.ts`

**Interfaces:**
- Consumes: `detectConflicts` (Task 3), `withUser`, `Ctx`, `optionalDate`.
- Produces (HTTP): `GET /api/conflicts?from&to` returns `{ active: Conflict[], ignored: IgnoredConflict[] }` with the field names from Task 3 (`eventAId, eventBId, overlapStart, overlapEnd, mode?, ignoreId?`), dates as ISO strings. The window includes events that overlap `[from, to)`; all zones and ignores are always considered.
- Produces (script): `npm run seed:demo` fills the current week with demo events, work hours, one zone, and one ignored conflict, showing all three conflict states.

- [ ] **Step 1: Write the failing test `server/tests/conflictsRoute.test.ts`**

```ts
import request from 'supertest';
import { appPool, ownerPool, resetDb, closePools, seedUsers, USER_A, USER_B } from './helpers/db';
import { createApp } from '../src/app';

const appA = createApp({ pool: appPool, userId: USER_A });
const appB = createApp({ pool: appPool, userId: USER_B });

const mk = async (app: typeof appA, title: string, start: string, end: string) =>
  (await request(app).post('/api/events').send({ title, start_at: start, end_at: end })).body;

beforeAll(async () => {
  await resetDb();
  await seedUsers();
});
beforeEach(() => ownerPool.query('TRUNCATE events, conflict_zones CASCADE'));
afterAll(closePools);

const overlappingPair = async (app = appA) => ({
  a: await mk(app, 'A', '2026-01-05T10:00:00Z', '2026-01-05T12:00:00Z'),
  b: await mk(app, 'B', '2026-01-05T11:00:00Z', '2026-01-05T13:00:00Z'),
});

test('returns empty lists when there are no events', async () => {
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
});

test('reports an active conflict with ISO dates', async () => {
  const { a, b } = await overlappingPair();
  const res = await request(appA).get('/api/conflicts');
  expect(res.status).toBe(200);
  expect(res.body.active).toEqual([
    {
      eventAId: [a.id, b.id].sort()[0],
      eventBId: [a.id, b.id].sort()[1],
      overlapStart: '2026-01-05T11:00:00.000Z',
      overlapEnd: '2026-01-05T12:00:00.000Z',
    },
  ]);
});

test('a zone containing the overlap removes the conflict from both lists', async () => {
  await overlappingPair();
  await request(appA).post('/api/conflict-zones').send({ start_at: '2026-01-05T09:00:00Z', end_at: '2026-01-05T17:00:00Z' });
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
});

test("'once' moves the conflict to ignored until the overlap changes", async () => {
  const { a, b } = await overlappingPair();
  await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'once' });
  let body = (await request(appA).get('/api/conflicts')).body;
  expect(body.active).toEqual([]);
  expect(body.ignored[0].mode).toBe('once');
  await request(appA).put(`/api/events/${a.id}`).send({ end_at: '2026-01-05T12:30:00Z' });
  body = (await request(appA).get('/api/conflicts')).body;
  expect(body.active).toHaveLength(1);
  expect(body.ignored).toEqual([]);
});

test("'allow' stays ignored after the overlap changes", async () => {
  const { a, b } = await overlappingPair();
  await request(appA).post('/api/conflict-ignores').send({ eventAId: a.id, eventBId: b.id, mode: 'allow' });
  await request(appA).put(`/api/events/${a.id}`).send({ end_at: '2026-01-05T12:30:00Z' });
  const body = (await request(appA).get('/api/conflicts')).body;
  expect(body.active).toEqual([]);
  expect(body.ignored[0].mode).toBe('allow');
  expect(typeof body.ignored[0].ignoreId).toBe('string');
});

test('a weekly zone uses the stored user timezone', async () => {
  await ownerPool.query(`UPDATE users SET timezone = 'America/New_York' WHERE id = $1`, [USER_A]);
  // Zone: Mondays 09:00-17:00 New York, created in winter (EST).
  await request(appA).post('/api/conflict-zones').send({
    start_at: '2026-03-02T14:00:00Z', end_at: '2026-03-02T22:00:00Z', repeats_weekly: true,
  });
  await mk(appA, 'A', '2026-03-09T13:15:00Z', '2026-03-09T14:00:00Z');
  await mk(appA, 'B', '2026-03-09T13:00:00Z', '2026-03-09T13:45:00Z');
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
  await ownerPool.query(`UPDATE users SET timezone = 'UTC' WHERE id = $1`, [USER_A]);
});

test('the from/to window limits which events are considered', async () => {
  await overlappingPair();
  const out = await request(appA).get('/api/conflicts?from=2026-02-01T00:00:00Z&to=2026-02-08T00:00:00Z');
  expect(out.body).toEqual({ active: [], ignored: [] });
  const inside = await request(appA).get('/api/conflicts?from=2026-01-05T00:00:00Z&to=2026-01-06T00:00:00Z');
  expect(inside.body.active).toHaveLength(1);
});

test("never includes another user's events", async () => {
  await overlappingPair(appB);
  expect((await request(appA).get('/api/conflicts')).body).toEqual({ active: [], ignored: [] });
});

test('rejects an invalid window', async () => {
  expect((await request(appA).get('/api/conflicts?from=garbage')).status).toBe(400);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx jest tests/conflictsRoute.test.ts`
Expected: FAIL (404 "Route not found").

- [ ] **Step 3: Create `server/src/routes/conflicts.ts`**

```ts
import { Router } from 'express';
import { detectConflicts } from '../conflicts/detectConflicts';
import { withUser } from '../db';
import { Ctx } from '../types';
import { optionalDate } from '../validation';

export function conflictsRouter({ pool, userId }: Ctx): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const from = optionalDate(req.query.from, 'from');
    const to = optionalDate(req.query.to, 'to');
    const result = await withUser(pool, userId, async (c) => {
      const tz = (await c.query('SELECT timezone FROM users WHERE id = $1', [userId])).rows[0]?.timezone ?? 'UTC';
      const events = (
        await c.query(
          `SELECT id, start_at, end_at FROM events
           WHERE ($1::timestamptz IS NULL OR end_at > $1) AND ($2::timestamptz IS NULL OR start_at < $2)`,
          [from, to]
        )
      ).rows;
      const zones = (await c.query('SELECT start_at, end_at, repeats_weekly FROM conflict_zones')).rows;
      const ignores = (
        await c.query('SELECT id, event_a_id, event_b_id, mode, overlap_start, overlap_end FROM conflict_ignores')
      ).rows;
      return detectConflicts(events, zones, ignores, tz);
    });
    res.json(result);
  });

  return router;
}
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

Replace `// Task 6 mounts /api/conflicts here.` with `app.use('/api/conflicts', conflictsRouter(ctx));` and add `import { conflictsRouter } from './routes/conflicts';` at the top.

- [ ] **Step 5: Create `server/scripts/seed-demo.ts`**

```ts
import { config } from '../src/config';
import { createPool, ensureUser, withUser } from '../src/db';

function at(monday: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const pool = createPool(config.databaseUrl);
  await ensureUser(pool, config.userId, config.userTimezone);
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  await withUser(pool, config.userId, async (c) => {
    await c.query('DELETE FROM events');
    await c.query('DELETE FROM work_hours');
    await c.query('DELETE FROM conflict_zones');
    for (let weekday = 1; weekday <= 5; weekday++) {
      await c.query(
        `INSERT INTO work_hours(user_id, weekday, start_time, end_time) VALUES ($1, $2, '09:00', '17:00')`,
        [config.userId, weekday]
      );
    }
    const add = async (title: string, day: number, sh: number, sm: number, eh: number, em: number, kind = 'event', color: string | null = null) =>
      (
        await c.query(
          `INSERT INTO events(user_id, title, start_at, end_at, kind, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [config.userId, title, at(monday, day, sh, sm), at(monday, day, eh, em), kind, color]
        )
      ).rows[0].id as string;

    await add('Deep work', 0, 9, 0, 11, 0, 'time_block');
    await add('Team sync', 0, 14, 0, 15, 0); // active conflict with Dentist
    await add('Dentist', 0, 14, 30, 15, 30);
    await add('Planning', 1, 10, 0, 11, 30, 'time_block');
    await add('Lunch with Sam', 1, 12, 0, 13, 0, 'event', '#7B5CD6');
    const standup = await add('Standup', 2, 9, 30, 10, 0); // ignored conflict
    const review = await add('Review', 2, 9, 45, 10, 30);
    await add('Client call', 3, 13, 0, 14, 0);
    await add('Write report', 3, 15, 0, 17, 0, 'time_block');
    await add('Workshop', 4, 10, 0, 12, 0); // inside a zone: no marker
    await add('Sprint demo', 4, 11, 0, 12, 30);

    const [lo, hi] = standup < review ? [standup, review] : [review, standup];
    await c.query(
      `INSERT INTO conflict_ignores(user_id, event_a_id, event_b_id, mode) VALUES ($1, $2, $3, 'allow')`,
      [config.userId, lo, hi]
    );
    await c.query(
      `INSERT INTO conflict_zones(user_id, start_at, end_at, repeats_weekly) VALUES ($1, $2, $3, false)`,
      [config.userId, at(monday, 4, 9, 0), at(monday, 4, 17, 0)]
    );
  });
  console.log('Demo data loaded for the current week.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Run all server tests and the build check**

Run: `cd server && npx jest && npx tsc -p tsconfig.build.json --noEmit`
Expected: all tests PASS; no compiler output.

- [ ] **Step 7: Verify the seed script**

Run: `cd server && npm run seed:demo`
Expected: `Demo data loaded for the current week.` (requires `.env` from Task 4 and `npm run migrate` applied to `schedule_dev`).

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "Add conflicts endpoint and demo data seed"
```


---

## DESIGN AGENT TASKS (work in `.worktrees/design`, inside `client/my_scheduler/`)

### Task 7: Design tokens, contrast helpers, and reserved colors

**Files:**
- Create: `client/my_scheduler/src/styles/tokens.css`, `client/my_scheduler/src/styles/contrast.ts`, `client/my_scheduler/src/styles/reservedColors.ts`
- Test: `client/my_scheduler/src/styles/__tests__/contrast.test.ts`, `client/my_scheduler/src/styles/__tests__/tokens.test.ts`, `client/my_scheduler/src/styles/__tests__/reservedColors.test.ts`

**Interfaces:**
- Produces:
  - CSS custom properties in `tokens.css` (names below are the contract for all later CSS).
  - `contrastRatio(a: string, b: string): number` and `readableTextOn(background: string): '#FFFFFF' | '#14102A'` (picks whichever has the higher contrast; used by the Frontend agent for user-colored events) and `hexToRgb`, `luminance` in `contrast.ts`.
  - `RESERVED_COLORS: readonly string[]` and `isReservedColor(value: string | null | undefined): boolean` in `reservedColors.ts`.

Token names: `--color-bg --color-surface --color-raised --color-purple --color-royal --color-light-blue --color-mint --color-coral --color-text --color-muted --color-on-royal --color-on-purple --color-on-mint --color-on-coral --color-border --color-hover --color-purple-soft --color-work-hours --color-zone-bg --color-overlay --radius-card --radius-event --radius-input --radius-pill --space-half --space-1 --space-2 --space-3 --space-4 --space-5 --font-sans --text-sm --text-md --text-lg --text-xl --motion-fast --motion-ease --focus-ring --shadow-pop`.

- [ ] **Step 1: Write the failing tests**

`src/styles/__tests__/contrast.test.ts`:

```ts
import { contrastRatio, hexToRgb, readableTextOn } from '../contrast';

test('black on white is 21:1 and identical colors are 1:1', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  expect(contrastRatio('#4A63F0', '#4A63F0')).toBeCloseTo(1, 5);
});

test('contrast is symmetric', () => {
  expect(contrastRatio('#14102A', '#EFEAFF')).toBeCloseTo(contrastRatio('#EFEAFF', '#14102A'), 5);
});

test('hexToRgb parses #RRGGBB and rejects anything else', () => {
  expect(hexToRgb('#4DF5C0')).toEqual([77, 245, 192]);
  expect(() => hexToRgb('red')).toThrow();
});

test('readableTextOn picks white on dark backgrounds and dark text on light ones', () => {
  expect(readableTextOn('#1E1840')).toBe('#FFFFFF');
  expect(readableTextOn('#4DF5C0')).toBe('#14102A');
});
```

`src/styles/__tests__/reservedColors.test.ts`:

```ts
import { RESERVED_COLORS, isReservedColor } from '../reservedColors';

test('the reserved colors are coral, work-hours light blue, and UI purple', () => {
  expect([...RESERVED_COLORS].sort()).toEqual(['#9B6BFF', '#A8D4FF', '#FF8A5B']);
});

test.each(['#FF8A5B', '#ff8a5b', ' #a8d4ff ', '#9B6BFF'])('%s is reserved (any case, trimmed)', (c) => {
  expect(isReservedColor(c)).toBe(true);
});

test.each(['#FF8A5C', '#4A63F0', '', null, undefined])('%s is not reserved', (c) => {
  expect(isReservedColor(c as string | null | undefined)).toBe(false);
});
```

`src/styles/__tests__/tokens.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { contrastRatio } from '../contrast';
import { RESERVED_COLORS } from '../reservedColors';

const dir = path.join(__dirname, '..');

function readTokens(): Record<string, string> {
  const css = fs.readFileSync(path.join(dir, 'tokens.css'), 'utf8');
  const tokens: Record<string, string> = {};
  for (const m of Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))) tokens[m[1]] = m[2].trim();
  return tokens;
}
const t = readTokens();

const REQUIRED = [
  'color-bg', 'color-surface', 'color-raised', 'color-purple', 'color-royal', 'color-light-blue', 'color-mint',
  'color-coral', 'color-text', 'color-muted', 'color-on-royal', 'color-on-purple', 'color-on-mint',
  'color-on-coral', 'color-border', 'color-hover', 'color-purple-soft', 'color-work-hours', 'color-zone-bg',
  'color-overlay', 'radius-card', 'radius-event', 'radius-input', 'radius-pill', 'space-half', 'space-1',
  'space-2', 'space-3', 'space-4', 'space-5', 'font-sans', 'text-sm', 'text-md', 'text-lg', 'text-xl',
  'motion-fast', 'motion-ease', 'focus-ring', 'shadow-pop',
];

test.each(REQUIRED)('defines --%s', (name) => {
  expect(t[`--${name}`]).toBeDefined();
});

test('palette matches the approved Violet dusk values', () => {
  expect(t['--color-bg']).toBe('#14102A');
  expect(t['--color-surface']).toBe('#1E1840');
  expect(t['--color-raised']).toBe('#2A2258');
  expect(t['--color-purple']).toBe('#9B6BFF');
  expect(t['--color-royal']).toBe('#4A63F0');
  expect(t['--color-light-blue']).toBe('#A8D4FF');
  expect(t['--color-mint']).toBe('#4DF5C0');
  expect(t['--color-coral']).toBe('#FF8A5B');
  expect(t['--color-text']).toBe('#EFEAFF');
  expect(t['--color-muted']).toBe('#9D95C9');
});

test('the reserved color list equals the coral, light-blue, and purple tokens', () => {
  const fromTokens = [t['--color-coral'], t['--color-light-blue'], t['--color-purple']].map((c) => c.toUpperCase());
  expect([...RESERVED_COLORS].sort()).toEqual(fromTokens.sort());
});

test.each([
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-raised'],
  ['--color-muted', '--color-bg'],
  ['--color-muted', '--color-surface'],
  ['--color-muted', '--color-raised'],
  ['--color-light-blue', '--color-surface'],
  ['--color-on-royal', '--color-royal'],
  ['--color-on-purple', '--color-purple'],
  ['--color-on-mint', '--color-mint'],
  ['--color-on-coral', '--color-coral'],
])('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
  expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
});

test('cards and events use 12-16px radii and buttons are pills', () => {
  for (const name of ['--radius-card', '--radius-event', '--radius-input']) {
    const px = parseInt(t[name], 10);
    expect(px).toBeGreaterThanOrEqual(12);
    expect(px).toBeLessThanOrEqual(16);
  }
  expect(parseInt(t['--radius-pill'], 10)).toBeGreaterThanOrEqual(999);
});

test('numbered spacing tokens sit on the 8px grid', () => {
  for (const n of [1, 2, 3, 4, 5]) expect(parseInt(t[`--space-${n}`], 10) % 8).toBe(0);
});

test('no stylesheet other than tokens.css hard-codes a color', () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'tokens.css');
  for (const f of files) {
    const css = fs.readFileSync(path.join(dir, f), 'utf8');
    expect({ file: f, hex: css.match(/#[0-9a-fA-F]{3,8}\b/g) }).toEqual({ file: f, hex: null });
    expect({ file: f, fn: css.match(/\brgba?\(/g) }).toEqual({ file: f, fn: null });
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npx react-scripts test --watchAll=false src/styles`
Expected: FAIL ("Cannot find module '../contrast'" and similar).

- [ ] **Step 3: Create `src/styles/contrast.ts`**

```ts
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The better of white and the app's dark background as text on `background`. */
export function readableTextOn(background: string): '#FFFFFF' | '#14102A' {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#14102A', background) ? '#FFFFFF' : '#14102A';
}
```

- [ ] **Step 4: Create `src/styles/reservedColors.ts`**

```ts
// Must match server/src/reservedColors.ts. Coral (conflicts), light blue (work hours), purple (UI).
export const RESERVED_COLORS: readonly string[] = ['#FF8A5B', '#A8D4FF', '#9B6BFF'];

export function isReservedColor(value: string | null | undefined): boolean {
  return !!value && RESERVED_COLORS.includes(value.trim().toUpperCase());
}
```

- [ ] **Step 5: Create `src/styles/tokens.css`**

```css
:root {
  --color-bg: #14102A;
  --color-surface: #1E1840;
  --color-raised: #2A2258;
  --color-purple: #9B6BFF;
  --color-royal: #4A63F0;
  --color-light-blue: #A8D4FF;
  --color-mint: #4DF5C0;
  --color-coral: #FF8A5B;
  --color-text: #EFEAFF;
  --color-muted: #9D95C9;

  --color-on-royal: #FFFFFF;
  --color-on-purple: #14102A;
  --color-on-mint: #06241A;
  --color-on-coral: #2A0D05;

  --color-border: rgba(239, 234, 255, 0.12);
  --color-hover: rgba(239, 234, 255, 0.08);
  --color-purple-soft: rgba(155, 107, 255, 0.18);
  --color-work-hours: rgba(168, 212, 255, 0.14);
  --color-zone-bg: rgba(168, 212, 255, 0.08);
  --color-overlay: rgba(10, 7, 24, 0.72);

  --radius-card: 14px;
  --radius-event: 12px;
  --radius-input: 12px;
  --radius-pill: 999px;

  --space-half: 4px;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;

  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --text-sm: 12px;
  --text-md: 14px;
  --text-lg: 18px;
  --text-xl: 24px;

  --motion-fast: 120ms;
  --motion-ease: cubic-bezier(0.2, 0, 0, 1);
  --focus-ring: 0 0 0 3px rgba(77, 245, 192, 0.55);
  --shadow-pop: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd client/my_scheduler && CI=true npx react-scripts test --watchAll=false src/styles`
Expected: PASS, three test files. If a contrast pair fails, adjust the foreground token (never the approved palette values) and report the change; white text on purple, for example, is only 3.5:1, which is why `--color-on-purple` is dark.

- [ ] **Step 7: Commit**

```bash
git add client/my_scheduler/src/styles
git commit -m "Add design tokens, contrast helpers, and reserved colors with tests"
```

---

### Task 8: Component and calendar stylesheets, CP1 static mockup, and Playwright screenshots

**Files:**
- Create: `src/styles/base.css`, `src/styles/components.css`, `src/styles/calendar.css`, `src/styles/index.css`
- Create: `design/mockups/cp1-calendar.html`, `design/screenshot.mjs`
- Modify: `client/my_scheduler/package.json` (the `design:shots` script only)
- Test: `src/styles/__tests__/classContract.test.ts`
- Output (not committed): `design/screenshots/cp1-calendar-{1280,768,390}.png`

**Interfaces:**
- Consumes: tokens from Task 7.
- Produces: every class in the CSS Class Contract table (see top of this plan) defined in `components.css` or `calendar.css`; `styles/index.css` as the single entry point that the Frontend agent imports once in `src/index.tsx` (Task 10); `npm run design:shots [mockups/<file>.html]` writes screenshots at 1280, 768 and 390 px wide into `design/screenshots/`.

- [ ] **Step 1: Confirm the dependencies and add the screenshot script**

`@fontsource/inter` and `playwright` (with Chromium) were installed in Task 0. Confirm with `cd client/my_scheduler && npm ls @fontsource/inter playwright`. Add to `scripts` in `package.json`: `"design:shots": "node design/screenshot.mjs"`. If Chromium is not available, set `CHROMIUM_PATH` to an installed Chromium or Chrome binary (the screenshot script reads it) and note this in the report.

- [ ] **Step 2: Write the failing test `src/styles/__tests__/classContract.test.ts`**

```ts
import fs from 'fs';
import path from 'path';

const dir = path.join(__dirname, '..');
const css = ['components.css', 'calendar.css']
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const CONTRACT = [
  'app-shell', 'app-header', 'app-title', 'btn', 'btn--primary', 'btn--ghost', 'card', 'dialog',
  'dialog__backdrop', 'dialog__title', 'field', 'field__label', 'field__input', 'field__error', 'swatch',
  'swatch--selected', 'toast', 'toast--error', 'load-error', 'selection-toolbar', 'cal-event',
  'cal-event--time-block', 'cal-event--conflict', 'cal-event--ignored', 'cal-work-hours', 'cal-zone',
  'conflict-badge', 'conflict-badge--ignored', 'popover', 'popover__title', 'popover__actions', 'settings',
  'settings__section',
];

test.each(CONTRACT)('defines .%s', (name) => {
  expect(css).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
});

test('index.css imports the font, tokens, and every stylesheet', () => {
  const index = fs.readFileSync(path.join(dir, 'index.css'), 'utf8');
  for (const f of ['tokens.css', 'base.css', 'components.css', 'calendar.css']) expect(index).toContain(f);
  expect(index).toContain('@fontsource/inter');
});

test('interactive controls have a visible keyboard focus style', () => {
  const base = fs.readFileSync(path.join(dir, 'base.css'), 'utf8');
  expect(base).toMatch(/:focus-visible/);
  expect(base).toMatch(/prefers-reduced-motion/);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd client/my_scheduler && CI=true npx react-scripts test --watchAll=false src/styles/__tests__/classContract`
Expected: FAIL (the CSS files do not exist).

- [ ] **Step 4: Create `src/styles/base.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Create `src/styles/components.css`**

```css
.app-shell { max-width: 1280px; margin: 0 auto; padding: var(--space-2); }
.app-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2); }
.app-title { margin: 0; font-size: var(--text-xl); font-weight: 600; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1);
  min-height: 40px; padding: 0 var(--space-2);
  border: 1px solid var(--color-border); border-radius: var(--radius-pill);
  background: var(--color-raised); color: var(--color-text); font-weight: 600; cursor: pointer;
  transition: background var(--motion-fast) var(--motion-ease), transform var(--motion-fast) var(--motion-ease);
}
.btn:hover { background: var(--color-hover); }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--primary { background: var(--color-mint); color: var(--color-on-mint); border-color: transparent; }
.btn--primary:hover { background: var(--color-mint); filter: brightness(1.08); }
.btn--ghost { background: transparent; }

.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: var(--space-2); }

.dialog__backdrop {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  padding: var(--space-2); background: var(--color-overlay);
}
.dialog {
  width: min(480px, 100%); max-height: 90vh; overflow: auto; padding: var(--space-3);
  background: var(--color-raised); border-radius: var(--radius-card); box-shadow: var(--shadow-pop);
}
.dialog__title { margin: 0 0 var(--space-2); font-size: var(--text-lg); font-weight: 600; }

.field { display: flex; flex-direction: column; gap: var(--space-half); margin-bottom: var(--space-2); }
.field__label { font-size: var(--text-sm); color: var(--color-muted); }
.field__input {
  min-height: 40px; padding: 8px 12px; background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-input);
}
.field__input:focus-visible { border-color: var(--color-purple); }
.field__error { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
.field__error::before {
  content: '!'; display: inline-grid; place-items: center; width: 16px; height: 16px; margin-right: 6px;
  border-radius: 50%; background: var(--color-purple); color: var(--color-on-purple); font-size: 11px;
}

.swatch { width: 28px; height: 28px; padding: 0; border: 2px solid transparent; border-radius: 50%; cursor: pointer; }
.swatch--selected { border-color: var(--color-text); }

.toast {
  position: fixed; bottom: var(--space-3); left: 50%; transform: translateX(-50%); z-index: 60;
  padding: var(--space-1) var(--space-2); background: var(--color-raised);
  border-radius: var(--radius-card); box-shadow: var(--shadow-pop);
}
.toast--error { border-left: 4px solid var(--color-purple); }

.load-error {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
  margin-bottom: var(--space-2); padding: var(--space-2);
  background: var(--color-raised); border-radius: var(--radius-card);
}

.selection-toolbar {
  position: fixed; bottom: var(--space-3); left: 50%; transform: translateX(-50%); z-index: 40;
  display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1); padding: var(--space-1);
  background: var(--color-raised); border-radius: var(--radius-pill); box-shadow: var(--shadow-pop);
}

.conflict-badge {
  display: inline-flex; align-items: center; gap: var(--space-half); padding: 2px 8px;
  background: var(--color-coral); color: var(--color-on-coral); border: 0; border-radius: var(--radius-pill);
  font-size: var(--text-sm); font-weight: 700; cursor: pointer;
}
.conflict-badge--ignored { background: transparent; color: var(--color-muted); border: 1px solid var(--color-muted); font-weight: 600; }

.popover {
  position: fixed; z-index: 45; width: min(300px, calc(100vw - 32px)); padding: var(--space-2);
  background: var(--color-raised); border-radius: var(--radius-card); box-shadow: var(--shadow-pop);
}
.popover__title { margin: 0 0 var(--space-half); font-weight: 600; overflow-wrap: anywhere; }
.popover__actions { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-2); }

.settings {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 50; width: min(420px, 100%); overflow: auto;
  padding: var(--space-3); background: var(--color-surface); border-left: 1px solid var(--color-border);
  border-radius: var(--radius-card) 0 0 var(--radius-card);
}
.settings__section { margin-bottom: var(--space-3); }

@media (max-width: 600px) {
  .settings { width: 100%; border-radius: 0; }
  .dialog { padding: var(--space-2); }
  .app-shell { padding: var(--space-1); }
}
```

- [ ] **Step 6: Create `src/styles/calendar.css`**

```css
.fc {
  --fc-page-bg-color: transparent;
  --fc-border-color: var(--color-border);
  --fc-neutral-bg-color: var(--color-surface);
  --fc-neutral-text-color: var(--color-muted);
  --fc-today-bg-color: var(--color-purple-soft);
  --fc-now-indicator-color: var(--color-mint);
  --fc-event-bg-color: var(--color-royal);
  --fc-event-border-color: transparent;
  --fc-event-text-color: var(--color-on-royal);
  --fc-button-bg-color: var(--color-raised);
  --fc-button-border-color: var(--color-border);
  --fc-button-text-color: var(--color-text);
  --fc-button-hover-bg-color: var(--color-hover);
  --fc-button-hover-border-color: var(--color-border);
  --fc-button-active-bg-color: var(--color-purple);
  --fc-button-active-border-color: transparent;
  font-family: var(--font-sans);
}

.fc .fc-toolbar-title { font-size: var(--text-xl); font-weight: 600; }
.fc .fc-button { border-radius: var(--radius-pill); font-weight: 600; text-transform: none; }
.fc .fc-button-primary:not(:disabled).fc-button-active { color: var(--color-on-purple); }
.fc .fc-scrollgrid { border-radius: var(--radius-card); overflow: hidden; }
.fc .fc-col-header-cell-cushion { color: var(--color-text); font-weight: 600; padding: var(--space-1); }
.fc .fc-timegrid-slot { height: 2.5em; }
.fc .fc-event { padding: 2px 6px; border-radius: var(--radius-event); }
.fc .fc-event-title { overflow-wrap: anywhere; }

.cal-event { border-radius: var(--radius-event); background-color: var(--color-royal); color: var(--color-on-royal); }
.cal-event--time-block { border-left: 4px solid var(--color-light-blue); }
.cal-event--conflict { outline: 2px solid var(--color-coral); outline-offset: -2px; }
.cal-event--ignored { outline: 2px dashed var(--color-muted); outline-offset: -2px; opacity: 0.85; }

.cal-work-hours { background: var(--color-work-hours) !important; border: 0 !important; border-radius: var(--radius-event); }
.cal-zone {
  background: var(--color-zone-bg) !important; border: 1px dashed var(--color-light-blue) !important;
  border-radius: var(--radius-event);
}
.cal-zone .fc-event-title { color: var(--color-light-blue); font-size: var(--text-sm); font-weight: 600; }
```

- [ ] **Step 7: Create `src/styles/index.css`**

```css
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import './tokens.css';
@import './base.css';
@import './components.css';
@import './calendar.css';
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd client/my_scheduler && CI=true npx react-scripts test --watchAll=false src/styles`
Expected: PASS, all style tests (including "no stylesheet hard-codes a color").

- [ ] **Step 9: Create the CP1 mockup `design/mockups/cp1-calendar.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CP1 static calendar</title>
  <link rel="stylesheet" href="../../node_modules/@fontsource/inter/400.css" />
  <link rel="stylesheet" href="../../node_modules/@fontsource/inter/600.css" />
  <link rel="stylesheet" href="../../node_modules/@fontsource/inter/700.css" />
  <link rel="stylesheet" href="../../src/styles/tokens.css" />
  <link rel="stylesheet" href="../../src/styles/base.css" />
  <link rel="stylesheet" href="../../src/styles/components.css" />
  <link rel="stylesheet" href="../../src/styles/calendar.css" />
  <style>
    /* Mockup-only layout. Colors come from tokens only. */
    .grid { display: grid; grid-template-columns: 56px repeat(5, 1fr); gap: 0; border-radius: var(--radius-card); overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); }
    .head { padding: var(--space-1); text-align: center; font-weight: 600; border-bottom: 1px solid var(--color-border); }
    .head--today { background: var(--color-purple-soft); }
    .hours, .day { position: relative; height: 480px; }
    .hours span { position: absolute; right: 8px; font-size: var(--text-sm); color: var(--color-muted); transform: translateY(-50%); }
    .day { border-left: 1px solid var(--color-border); background-image: linear-gradient(to bottom, var(--color-border) 1px, transparent 1px); background-size: 100% 48px; }
    .day .cal-work-hours, .day .cal-zone, .day .cal-event { position: absolute; left: 4px; right: 4px; }
    .day .cal-event { padding: 4px 8px; font-size: var(--text-sm); font-weight: 600; overflow: hidden; }
    .half-l { right: 50% !important; } .half-r { left: 50% !important; }
    .cal-event .conflict-badge { margin-top: 4px; display: inline-flex; }
    .zone-label { color: var(--color-light-blue); font-size: var(--text-sm); font-weight: 600; padding: 4px 8px; }
    .legend { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-2); }
    .legend .chip { padding: 4px 12px; border-radius: var(--radius-pill); font-size: var(--text-sm); font-weight: 600; }
    @media (max-width: 600px) { .grid { grid-template-columns: 40px repeat(3, 1fr); } .day--extra, .head--extra { display: none; } }
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Week of Oct 5</h1>
      <button class="btn btn--primary" type="button">+ Add event</button>
    </header>

    <div class="grid">
      <div class="head"></div>
      <div class="head head--today">Mon 5</div>
      <div class="head head--extra">Tue 6</div>
      <div class="head">Wed 7</div>
      <div class="head head--extra">Thu 8</div>
      <div class="head">Fri 9</div>

      <div class="hours">
        <span style="top:0">8</span><span style="top:48px">9</span><span style="top:96px">10</span><span style="top:144px">11</span>
        <span style="top:192px">12</span><span style="top:240px">1</span><span style="top:288px">2</span><span style="top:336px">3</span>
        <span style="top:384px">4</span><span style="top:432px">5</span>
      </div>

      <!-- Mon: time block + ACTIVE conflict -->
      <div class="day">
        <div class="cal-work-hours" style="top:48px;height:384px"></div>
        <div class="cal-event cal-event--time-block" style="top:48px;height:96px">Deep work</div>
        <div class="cal-event cal-event--conflict half-l" style="top:288px;height:48px">Team sync</div>
        <div class="cal-event cal-event--conflict half-r" style="top:312px;height:72px">Dentist<br /><button class="conflict-badge" type="button">⏰! Conflict</button></div>
      </div>

      <!-- Tue: plain events, one with a user-chosen color -->
      <div class="day day--extra">
        <div class="cal-work-hours" style="top:48px;height:384px"></div>
        <div class="cal-event cal-event--time-block" style="top:96px;height:72px">Planning</div>
        <div class="cal-event" style="top:192px;height:48px;background-color:#7B5CD6">Lunch with Sam</div>
      </div>

      <!-- Wed: IGNORED conflict (quiet) -->
      <div class="day">
        <div class="cal-work-hours" style="top:48px;height:384px"></div>
        <div class="cal-event cal-event--ignored half-l" style="top:72px;height:36px">Standup</div>
        <div class="cal-event cal-event--ignored half-r" style="top:84px;height:60px">Review<br /><button class="conflict-badge conflict-badge--ignored" type="button">⏰ ignored</button></div>
      </div>

      <!-- Thu -->
      <div class="day day--extra">
        <div class="cal-work-hours" style="top:48px;height:384px"></div>
        <div class="cal-event" style="top:240px;height:48px">Client call</div>
        <div class="cal-event cal-event--time-block" style="top:336px;height:96px">Write report</div>
      </div>

      <!-- Fri: inside an unconflicted ZONE (no markers) -->
      <div class="day">
        <div class="cal-zone" style="top:48px;height:384px"><div class="zone-label">Work hours · conflicts off</div></div>
        <div class="cal-event half-l" style="top:96px;height:96px">Workshop</div>
        <div class="cal-event half-r" style="top:144px;height:72px">Sprint demo</div>
      </div>
    </div>

    <div class="legend">
      <span class="chip" style="background:var(--color-royal);color:var(--color-on-royal)">Time block</span>
      <span class="chip" style="background:var(--color-coral);color:var(--color-on-coral)">Conflict</span>
      <span class="chip" style="background:var(--color-work-hours);color:var(--color-light-blue)">Work hours</span>
      <span class="chip" style="background:var(--color-purple);color:var(--color-on-purple)">UI &amp; settings</span>
    </div>
  </div>
</body>
</html>
```

(The "⏰" in the mockup is a stand-in; the real clock-and-"!" icon is the `ConflictIcon` SVG in Task 13. The Design agent may replace it with inline SVG here for the CP1 review.)

- [ ] **Step 10: Create `design/screenshot.mjs`**

```js
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ?? 'mockups/cp1-calendar.html';
const name = path.basename(target, path.extname(target));
const widths = [1280, 768, 390];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(pathToFileURL(path.join(here, target)).href);
  await page.waitForLoadState('networkidle');
  const out = path.join(here, 'screenshots', `${name}-${width}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`wrote ${out}`);
  await page.close();
}
await browser.close();
```

- [ ] **Step 11: Generate and inspect the screenshots**

Run: `cd client/my_scheduler && npm run design:shots`
Expected: three `wrote .../cp1-calendar-<width>.png` lines. Open each PNG with the Read tool and check, against the spec: dark Violet dusk background; mint "+ Add event" pill; rounded corners everywhere; the light-blue work-hours band; the active conflict (coral outline plus badge), the ignored conflict (dashed, quiet), and the zone (dashed light-blue band, no markers); readable text at 390 px. Fix the CSS and re-run until it matches, then write a short note in `design/mockups/CP1-NOTES.md` listing any decisions the spec did not dictate (for example, text colors chosen to meet AA).

- [ ] **Step 12: Commit (screenshots are ignored by git; the reviewer reads them from the worktree)**

```bash
git add client/my_scheduler/src/styles client/my_scheduler/design/mockups client/my_scheduler/design/screenshot.mjs client/my_scheduler/package.json client/my_scheduler/package-lock.json
git commit -m "Add component and calendar stylesheets, CP1 mockup, and screenshot script"
```


---

## FRONTEND AGENT TASKS (work in `.worktrees/frontend`, inside `client/my_scheduler/`)

Frontend components get their look only from the CSS Class Contract classes. Inline `style` is allowed for layout (flex, gap, wrapping, position) and for user-chosen event colors, never for palette colors, radii, fonts, or spacing tokens. They never import files from `src/styles/` except `reservedColors.ts` and `contrast.ts` (the Design agent exports these for the Frontend agent) and the single `styles/index.css` import in `src/index.tsx`. If a component needs a visual treatment that no contract class provides, the Frontend agent says so in its report and the Design agent adds the class.

### Task 9: API client, shared types, and toasts

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`, `src/components/Toast.tsx`
- Delete: `src/App.test.js` (the default "learn react" test), `src/App.css`, `src/logo.svg`, and `src/index.css` (default Create React App leftovers; none are used after Task 10)
- Test: `src/api/client.test.ts`, `src/components/Toast.test.tsx`

**Interfaces:**
- Produces:
  - Types in `types.ts`: `ApiEvent`, `EventInput`, `WorkHour`, `ConflictZone`, `Conflict`, `IgnoredConflict`, `ConflictsResponse`, `ConflictIgnore` (shapes below).
  - `class ApiClientError extends Error { code: string; status?: number }`; code is the server's error `code`, or `'network'` when the server cannot be reached, or `'http_error'` when the response has no error body.
  - In `client.ts`: `listEvents(from?: Date, to?: Date): Promise<ApiEvent[]>`, `createEvent(input: EventInput): Promise<ApiEvent>`, `updateEvent(id: string, patch: Partial<EventInput>): Promise<ApiEvent>`, `deleteEvent(id: string): Promise<void>`, `getConflicts(from?: Date, to?: Date): Promise<ConflictsResponse>`, `listWorkHours(): Promise<WorkHour[]>`, `putWorkHours(workHours: WorkHour[]): Promise<WorkHour[]>`, `listZones(): Promise<ConflictZone[]>`, `createZone(input: { start_at: string; end_at: string; repeats_weekly: boolean }): Promise<ConflictZone>`, `deleteZone(id: string): Promise<void>`, `listIgnores(): Promise<ConflictIgnore[]>`, `createIgnore(input: { eventAId: string; eventBId: string; mode: 'once' | 'allow' }): Promise<void>`, `deleteIgnore(id: string): Promise<void>`.
  - `ToastProvider` component and `useToast(): { showError(message: string): void }`.

`types.ts` (create exactly):

```ts
export type EventKind = 'event' | 'time_block';

export interface ApiEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  kind: EventKind;
  color: string | null;
  notes: string | null;
  source: string;
}

export interface EventInput {
  title: string;
  start_at: string;
  end_at: string;
  kind: EventKind;
  color: string | null;
  notes: string | null;
}

export interface WorkHour {
  weekday: number; // 0 = Sunday
  start_time: string; // HH:MM
  end_time: string; // HH:MM
}

export interface ConflictZone {
  id: string;
  start_at: string;
  end_at: string;
  repeats_weekly: boolean;
}

export interface Conflict {
  eventAId: string;
  eventBId: string;
  overlapStart: string;
  overlapEnd: string;
}

export interface IgnoredConflict extends Conflict {
  mode: 'once' | 'allow';
  ignoreId: string;
}

export interface ConflictsResponse {
  active: Conflict[];
  ignored: IgnoredConflict[];
}

export interface ConflictIgnore {
  id: string;
  event_a_id: string;
  event_b_id: string;
  mode: 'once' | 'allow';
  overlap_start: string | null;
  overlap_end: string | null;
  event_a_title: string;
  event_b_title: string;
}
```

- [ ] **Step 1: Write the failing test `src/api/client.test.ts`**

```ts
import { ApiClientError, createEvent, deleteEvent, getConflicts, listEvents, updateEvent } from './client';

const okJson = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  global.fetch = jest.fn();
});

test('listEvents sends from/to as ISO strings', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson([]));
  await listEvents(new Date('2026-01-05T00:00:00Z'), new Date('2026-01-12T00:00:00Z'));
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
    '/api/events?from=2026-01-05T00%3A00%3A00.000Z&to=2026-01-12T00%3A00%3A00.000Z'
  );
});

test('listEvents without a window calls the bare endpoint', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson([]));
  await listEvents();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/events');
});

test('createEvent POSTs JSON and returns the created event', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson({ id: 'x' }, 201));
  const input = { title: 'T', start_at: 'a', end_at: 'b', kind: 'event' as const, color: null, notes: null };
  await expect(createEvent(input)).resolves.toEqual({ id: 'x' });
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/events');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual(input);
});

test('updateEvent PUTs a partial body to the event URL', async () => {
  (global.fetch as jest.Mock).mockReturnValue(okJson({ id: 'x' }));
  await updateEvent('x', { title: 'New' });
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/events/x');
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body)).toEqual({ title: 'New' });
});

test('deleteEvent resolves on 204', async () => {
  (global.fetch as jest.Mock).mockReturnValue(Promise.resolve({ ok: true, status: 204 } as Response));
  await expect(deleteEvent('x')).resolves.toBeUndefined();
});

test('server errors become ApiClientError with the server code and message', async () => {
  (global.fetch as jest.Mock).mockReturnValue(
    okJson({ error: { code: 'validation_error', message: 'end_at must be after start_at' } }, 400)
  );
  const err = await updateEvent('x', {}).catch((e) => e);
  expect(err).toBeInstanceOf(ApiClientError);
  expect(err).toMatchObject({ code: 'validation_error', message: 'end_at must be after start_at', status: 400 });
});

test('an error response without a body still yields a readable error', async () => {
  (global.fetch as jest.Mock).mockReturnValue(
    Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) } as Response)
  );
  const err = await getConflicts().catch((e) => e);
  expect(err).toMatchObject({ code: 'http_error', message: 'Request failed (502)' });
});

test('a network failure becomes a "network" error', async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
  const err = await listEvents().catch((e) => e);
  expect(err).toMatchObject({ code: 'network', message: 'Cannot reach the server' });
});
```

`src/components/Toast.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const { showError } = useToast();
  return <button onClick={() => showError('Could not save')}>go</button>;
}

test('shows an error toast as an alert and removes it after a few seconds', () => {
  jest.useFakeTimers();
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('go').click());
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  act(() => { jest.advanceTimersByTime(6000); });
  expect(screen.queryByRole('alert')).toBeNull();
  jest.useRealTimers();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/api src/components/Toast`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create `src/api/types.ts`** with the exact content shown above.

- [ ] **Step 4: Create `src/api/client.ts`**

```ts
import {
  ApiEvent, ConflictIgnore, ConflictsResponse, ConflictZone, EventInput, WorkHour,
} from './types';

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiClientError('network', 'Cannot reach the server');
  }
  if (res.status === 204) return undefined as T;
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new ApiClientError(
      body?.error?.code ?? 'http_error',
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status
    );
  }
  return body as T;
}

function windowQuery(from?: Date, to?: Date): string {
  const p = new URLSearchParams();
  if (from) p.set('from', from.toISOString());
  if (to) p.set('to', to.toISOString());
  const s = p.toString();
  return s ? `?${s}` : '';
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const listEvents = (from?: Date, to?: Date) => request<ApiEvent[]>(`/api/events${windowQuery(from, to)}`);
export const createEvent = (input: EventInput) => request<ApiEvent>('/api/events', json('POST', input));
export const updateEvent = (id: string, patch: Partial<EventInput>) =>
  request<ApiEvent>(`/api/events/${id}`, json('PUT', patch));
export const deleteEvent = (id: string) => request<void>(`/api/events/${id}`, { method: 'DELETE' });

export const getConflicts = (from?: Date, to?: Date) =>
  request<ConflictsResponse>(`/api/conflicts${windowQuery(from, to)}`);

export const listWorkHours = () => request<WorkHour[]>('/api/work-hours');
export const putWorkHours = (workHours: WorkHour[]) => request<WorkHour[]>('/api/work-hours', json('PUT', { workHours }));

export const listZones = () => request<ConflictZone[]>('/api/conflict-zones');
export const createZone = (input: { start_at: string; end_at: string; repeats_weekly: boolean }) =>
  request<ConflictZone>('/api/conflict-zones', json('POST', input));
export const deleteZone = (id: string) => request<void>(`/api/conflict-zones/${id}`, { method: 'DELETE' });

export const listIgnores = () => request<ConflictIgnore[]>('/api/conflict-ignores');
export const createIgnore = (input: { eventAId: string; eventBId: string; mode: 'once' | 'allow' }) =>
  request<void>('/api/conflict-ignores', json('POST', input));
export const deleteIgnore = (id: string) => request<void>(`/api/conflict-ignores/${id}`, { method: 'DELETE' });
```

- [ ] **Step 5: Create `src/components/Toast.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastApi {
  showError(message: string): void;
}

const ToastContext = createContext<ToastApi>({ showError: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const showError = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      {message && (
        <div className="toast toast--error" role="alert">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 6: Delete the Create React App leftovers**

```bash
git rm src/App.test.js src/App.css src/logo.svg src/index.css
```

(`src/App.tsx` still imports nothing from them. `src/index.tsx` still imports `./index.css`; Task 10 replaces that import. Until then, to keep the build green in this task, change that line in `src/index.tsx` to remove the `import './index.css';` line.)

- [ ] **Step 7: Run the tests and a type check**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit`
Expected: PASS; no compiler output.

- [ ] **Step 8: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add API client, shared types, and toast; remove Create React App leftovers"
```

---

### Task 10: CalendarView with live data, work-hours band, and load errors

**Files:**
- Create: `src/lib/workHoursBand.ts`, `src/hooks/useCalendarData.ts`, `src/components/CalendarView.tsx`, `src/test/fullCalendarMock.tsx`
- Modify: `src/App.tsx` (replace entirely)
- Test: `src/lib/workHoursBand.test.ts`, `src/components/CalendarView.test.tsx`

**Interfaces:**
- Consumes: API client and types (Task 9); the CSS classes `app-shell`, `app-header`, `app-title`, `btn`, `load-error`, `cal-event`, `cal-event--time-block`, `cal-work-hours`; `readableTextOn` from `src/styles/contrast.ts`.
- Produces:
  - `workHoursToBackground(workHours: WorkHour[], rangeStart: Date, rangeEnd: Date): BackgroundEvent[]` where `BackgroundEvent = { id: string; start: Date; end: Date; display: 'background'; classNames: string[] }`.
  - `CALENDAR_OPTIONS` (exported from `CalendarView.tsx`): the static FullCalendar options object.
  - `useCalendarData()` returning `{ events: ApiEvent[]; workHours: WorkHour[]; zones: ConflictZone[]; conflicts: ConflictsResponse; range: { from: Date; to: Date } | null; setRange(r: { from: Date; to: Date }): void; loadError: string | null; reload(): Promise<void>; setEvents: React.Dispatch<React.SetStateAction<ApiEvent[]>> }`.
  - `CalendarView` (default export, no props) — the whole calendar screen. Later tasks extend it.
  - `toFullCalendarEvent(e: ApiEvent)`: maps an API event to FullCalendar input with `id`, `title`, `start`, `end`, `backgroundColor`/`textColor` when `color` is set (text color from `readableTextOn`), `classNames: ['cal-event', ...(kind === 'time_block' ? ['cal-event--time-block'] : [])]`, and `extendedProps: { kind, notes, color }`.

- [ ] **Step 1: Confirm the plugin is installed**

`@fullcalendar/interaction` was installed in Task 0. Confirm with `cd client/my_scheduler && npm ls @fullcalendar/interaction`.

- [ ] **Step 2: Write the failing tests**

`src/lib/workHoursBand.test.ts`:

```ts
import { workHoursToBackground } from './workHoursBand';

const wh = [
  { weekday: 1, start_time: '09:00', end_time: '17:00' },
  { weekday: 2, start_time: '09:30', end_time: '12:00' },
  { weekday: 2, start_time: '13:00', end_time: '17:30' },
];

test('creates one band per matching weekday in the range', () => {
  // Mon 2026-10-05 through Sun 2026-10-11 (local time)
  const bands = workHoursToBackground(wh, new Date(2026, 9, 5), new Date(2026, 9, 12));
  expect(bands).toHaveLength(3);
  expect(bands[0].start).toEqual(new Date(2026, 9, 5, 9, 0));
  expect(bands[0].end).toEqual(new Date(2026, 9, 5, 17, 0));
  expect(bands[1].start).toEqual(new Date(2026, 9, 6, 9, 30));
  expect(bands.every((b) => b.display === 'background' && b.classNames.includes('cal-work-hours'))).toBe(true);
});

test('repeats across multiple weeks and gives each band a unique id', () => {
  const bands = workHoursToBackground(wh, new Date(2026, 9, 5), new Date(2026, 9, 19));
  expect(bands).toHaveLength(6);
  expect(new Set(bands.map((b) => b.id)).size).toBe(6);
});

test('returns nothing when there are no work hours or the range is empty', () => {
  expect(workHoursToBackground([], new Date(2026, 9, 5), new Date(2026, 9, 12))).toEqual([]);
  expect(workHoursToBackground(wh, new Date(2026, 9, 5), new Date(2026, 9, 5))).toEqual([]);
});

test('keeps the local clock time across a daylight-saving change', () => {
  // The browser's local zone decides DST; the band must still start at 09:00 local on every Monday.
  const bands = workHoursToBackground(
    [{ weekday: 1, start_time: '09:00', end_time: '10:00' }],
    new Date(2026, 2, 2), new Date(2026, 2, 16)
  );
  expect(bands.map((b) => b.start.getHours())).toEqual([9, 9]);
});
```

`src/test/fullCalendarMock.tsx` (a stand-in used by component tests, because FullCalendar's layout engine does not run meaningfully in jsdom):

```tsx
import React, { useEffect } from 'react';

type Info = Record<string, any>;

export interface MockCalendarProps {
  events?: Info[];
  datesSet?: (arg: { start: Date; end: Date }) => void;
  select?: (arg: { start: Date; end: Date }) => void;
  eventClick?: (arg: Info) => void;
  eventDrop?: (arg: Info) => void;
  eventResize?: (arg: Info) => void;
  eventContent?: (arg: Info) => React.ReactNode;
  [key: string]: unknown;
}

export const MOCK_RANGE = { start: new Date(2026, 9, 5), end: new Date(2026, 9, 12) };

export default function FullCalendarMock(props: MockCalendarProps) {
  const { datesSet } = props;
  useEffect(() => {
    datesSet?.(MOCK_RANGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const visible = (props.events ?? []).filter((e) => e.display !== 'background');
  return (
    <div data-testid="calendar">
      <div data-testid="bands">{(props.events ?? []).filter((e) => e.display === 'background').length}</div>
      {visible.map((e) => {
        const info = { event: { id: e.id, title: e.title, start: e.start, end: e.end, extendedProps: e.extendedProps ?? {} } };
        return (
          <div key={e.id} data-testid={`event-${e.id}`} className={(e.classNames ?? []).join(' ')}>
            {props.eventContent ? props.eventContent(info) : e.title}
            <button onClick={() => props.eventClick?.(info)}>open {e.title}</button>
            <button
              onClick={() => {
                const start = new Date(new Date(e.start).getTime() + 3600000);
                const end = new Date(new Date(e.end).getTime() + 3600000);
                props.eventDrop?.({ event: { ...info.event, start, end }, revert: (window as any).__revert ?? (() => {}) });
              }}
            >
              drag {e.title}
            </button>
          </div>
        );
      })}
      <button
        onClick={() => props.select?.({ start: new Date(2026, 9, 6, 9, 0), end: new Date(2026, 9, 6, 10, 0) })}
      >
        mock-select
      </button>
    </div>
  );
}
```

`src/components/CalendarView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarView, { CALENDAR_OPTIONS, toFullCalendarEvent } from './CalendarView';
import { ToastProvider } from './Toast';
import * as api from '../api/client';

jest.mock('@fullcalendar/react', () => ({ __esModule: true, default: require('../test/fullCalendarMock').default }));
jest.mock('../api/client');
const mocked = api as jest.Mocked<typeof api>;

const ev = (over = {}) => ({
  id: 'e1', title: 'Planning', start_at: '2026-10-06T10:00:00.000Z', end_at: '2026-10-06T11:00:00.000Z',
  kind: 'event' as const, color: null, notes: null, source: 'local', ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  mocked.listEvents.mockResolvedValue([ev()]);
  mocked.listWorkHours.mockResolvedValue([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]);
  mocked.listZones.mockResolvedValue([]);
  mocked.getConflicts.mockResolvedValue({ active: [], ignored: [] });
});

const renderView = () => render(<ToastProvider><CalendarView /></ToastProvider>);

test('loads and shows events and work-hours bands for the visible range', async () => {
  renderView();
  expect(await screen.findByText('Planning')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('bands')).toHaveTextContent('1'));
  expect(mocked.listEvents).toHaveBeenCalledWith(new Date(2026, 9, 5), new Date(2026, 9, 12));
});

test('shows a visible error with a Retry button when the API is down, then recovers', async () => {
  mocked.listEvents.mockRejectedValueOnce(new Error('Cannot reach the server'));
  renderView();
  expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  expect(await screen.findByText('Planning')).toBeInTheDocument();
  expect(screen.queryByText(/Cannot reach the server/)).toBeNull();
});

test('toFullCalendarEvent applies classes and a readable text color for user colors', () => {
  const plain = toFullCalendarEvent(ev());
  expect(plain.classNames).toEqual(['cal-event']);
  const block = toFullCalendarEvent(ev({ kind: 'time_block', color: '#7B5CD6' }));
  expect(block.classNames).toEqual(['cal-event', 'cal-event--time-block']);
  expect(block.backgroundColor).toBe('#7B5CD6');
  expect(['#FFFFFF', '#14102A']).toContain(block.textColor);
});

test('the calendar is configured for 15-minute snapping, no all-day row, and press-and-hold on touch', () => {
  expect(CALENDAR_OPTIONS).toMatchObject({
    snapDuration: '00:15:00',
    allDaySlot: false,
    editable: true,
    selectable: true,
    longPressDelay: 400,
    eventLongPressDelay: 400,
    selectLongPressDelay: 400,
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/lib src/components/CalendarView`
Expected: FAIL (modules not found).

- [ ] **Step 4: Create `src/lib/workHoursBand.ts`**

```ts
import { WorkHour } from '../api/types';

export interface BackgroundEvent {
  id: string;
  start: Date;
  end: Date;
  display: 'background';
  classNames: string[];
}

/** One background band per matching local weekday between rangeStart (inclusive) and rangeEnd (exclusive). */
export function workHoursToBackground(workHours: WorkHour[], rangeStart: Date, rangeEnd: Date): BackgroundEvent[] {
  const out: BackgroundEvent[] = [];
  const day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  while (day < rangeEnd) {
    for (const w of workHours) {
      if (w.weekday !== day.getDay()) continue;
      const [sh, sm] = w.start_time.split(':').map(Number);
      const [eh, em] = w.end_time.split(':').map(Number);
      out.push({
        id: `work-hours-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${w.start_time}`,
        start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm),
        end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em),
        display: 'background',
        classNames: ['cal-work-hours'],
      });
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}
```

- [ ] **Step 5: Create `src/hooks/useCalendarData.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { ApiEvent, ConflictsResponse, ConflictZone, WorkHour } from '../api/types';

export interface Range {
  from: Date;
  to: Date;
}

export function useCalendarData() {
  const [range, setRange] = useState<Range | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [zones, setZones] = useState<ConflictZone[]>([]);
  const [conflicts, setConflicts] = useState<ConflictsResponse>({ active: [], ignored: [] });
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!range) return;
    try {
      const [e, w, z, c] = await Promise.all([
        api.listEvents(range.from, range.to),
        api.listWorkHours(),
        api.listZones(),
        api.getConflicts(range.from, range.to),
      ]);
      setEvents(e);
      setWorkHours(w);
      setZones(z);
      setConflicts(c);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your calendar');
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, workHours, zones, conflicts, range, setRange, loadError, reload, setEvents };
}
```

- [ ] **Step 6: Create `src/components/CalendarView.tsx`**

```tsx
import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarOptions } from '@fullcalendar/core';
import { ApiEvent } from '../api/types';
import { useCalendarData } from '../hooks/useCalendarData';
import { workHoursToBackground } from '../lib/workHoursBand';
import { readableTextOn } from '../styles/contrast';

export const CALENDAR_OPTIONS: CalendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' },
  allDaySlot: false,
  slotDuration: '00:30:00',
  snapDuration: '00:15:00',
  nowIndicator: true,
  editable: true,
  selectable: true,
  selectMirror: true,
  longPressDelay: 400,
  eventLongPressDelay: 400,
  selectLongPressDelay: 400,
  height: 'auto',
};

export function toFullCalendarEvent(e: ApiEvent) {
  return {
    id: e.id,
    title: e.title,
    start: e.start_at,
    end: e.end_at,
    ...(e.color ? { backgroundColor: e.color, textColor: readableTextOn(e.color) } : {}),
    classNames: ['cal-event', ...(e.kind === 'time_block' ? ['cal-event--time-block'] : [])],
    extendedProps: { kind: e.kind, notes: e.notes, color: e.color },
  };
}

export default function CalendarView() {
  const data = useCalendarData();

  const calendarEvents = useMemo(
    () => [
      ...data.events.map(toFullCalendarEvent),
      ...(data.range ? workHoursToBackground(data.workHours, data.range.from, data.range.to) : []),
    ],
    [data.events, data.workHours, data.range]
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Schedule</h1>
      </header>
      {data.loadError && (
        <div className="load-error" role="alert">
          <span>{data.loadError}</span>
          <button className="btn" type="button" onClick={() => void data.reload()}>
            Retry
          </button>
        </div>
      )}
      <FullCalendar
        {...CALENDAR_OPTIONS}
        events={calendarEvents}
        datesSet={(arg) => data.setRange({ from: arg.start, to: arg.end })}
      />
    </div>
  );
}
```

- [ ] **Step 7: Replace `src/App.tsx`**

(The stylesheet import is added in Task 11, after Task 8's stylesheets have been merged. Until then the app renders unstyled, which is expected.)

`src/App.tsx`:

```tsx
import React from 'react';
import CalendarView from './components/CalendarView';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <CalendarView />
    </ToastProvider>
  );
}
```

- [ ] **Step 8: Run all client tests, type check, and build**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add CalendarView with live data, work-hours band, and load-error retry"
```

---

### Task 11: Event dialog, selection toolbar, color picker, and event CRUD in the calendar

**Files:**
- Create: `src/lib/preferences.ts`, `src/components/ColorPicker.tsx`, `src/components/EventDialog.tsx`, `src/components/SelectionToolbar.tsx`
- Modify: `src/components/CalendarView.tsx`, `src/index.tsx`
- Test: `src/lib/preferences.test.ts`, `src/components/EventDialog.test.tsx`, `src/components/CalendarView.test.tsx` (add cases)

**Interfaces:**
- Consumes: API client and types (Task 9), `CalendarView`, `toFullCalendarEvent`, `useCalendarData`, `useToast` (Tasks 9-10); `isReservedColor` from `src/styles/reservedColors.ts`; classes `dialog`, `dialog__backdrop`, `dialog__title`, `field`, `field__label`, `field__input`, `field__error`, `swatch`, `swatch--selected`, `btn`, `btn--primary`, `btn--ghost`, `selection-toolbar`.
- Produces:
  - `getDefaultEventColor(): string | null` and `setDefaultEventColor(color: string | null): void` in `preferences.ts` (browser `localStorage`, every access wrapped in try/catch so a blocked or full store never throws).
  - `EVENT_SWATCHES: readonly string[]` exported from `ColorPicker.tsx` (blue and purple shades that are not reserved).
  - `ColorPicker({ value, onChange }: { value: string | null; onChange(color: string | null): void })`.
  - `EventDialog` props: `{ mode: 'create' | 'edit'; initial: { id?: string; title: string; start: Date; end: Date; kind: EventKind; color: string | null; notes: string | null }; onSave(input: EventInput, id?: string): Promise<void>; onDelete?(id: string): Promise<void>; onClose(): void }`.
  - `SelectionToolbar` props: `{ range: { start: Date; end: Date }; onAddEvent(): void; onMarkZone?(repeatsWeekly: boolean): void; onCancel(): void }` (the "Mark as unconflicted zone" control renders only when `onMarkZone` is provided; Task 14 provides it).

- [ ] **Step 1: Write the failing tests**

`src/lib/preferences.test.ts`:

```ts
import { getDefaultEventColor, setDefaultEventColor } from './preferences';

afterEach(() => localStorage.clear());

test('stores and returns the default event color', () => {
  expect(getDefaultEventColor()).toBeNull();
  setDefaultEventColor('#4A63F0');
  expect(getDefaultEventColor()).toBe('#4A63F0');
  setDefaultEventColor(null);
  expect(getDefaultEventColor()).toBeNull();
});

test('never throws when storage is blocked', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(getDefaultEventColor()).toBeNull();
  spy.mockRestore();
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  expect(() => setDefaultEventColor('#4A63F0')).not.toThrow();
  set.mockRestore();
});
```

`src/components/EventDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventDialog from './EventDialog';

// datetime-local inputs and emoji are unreliable with userEvent.type in jsdom, so set those values directly.
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

const initial = {
  title: '', start: new Date(2026, 9, 6, 9, 0), end: new Date(2026, 9, 6, 10, 0),
  kind: 'event' as const, color: null, notes: null,
};

function setup(over = {}) {
  const props = {
    mode: 'create' as const, initial, onSave: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined), onClose: jest.fn(), ...over,
  };
  render(<EventDialog {...props} />);
  return props;
}

test('is an accessible modal dialog with the title field focused', () => {
  setup();
  expect(screen.getByRole('dialog', { name: /new event/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/title/i)).toHaveFocus();
});

test('saving sends ISO times, kind, color and trimmed title', async () => {
  const props = setup();
  await userEvent.type(screen.getByLabelText(/title/i), '  Planning  ');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(props.onSave).toHaveBeenCalledWith(
    {
      title: 'Planning', start_at: new Date(2026, 9, 6, 9, 0).toISOString(),
      end_at: new Date(2026, 9, 6, 10, 0).toISOString(), kind: 'event', color: null, notes: null,
    },
    undefined
  );
});

test('refuses an empty title and an end that is not after the start', async () => {
  const props = setup();
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/enter a title/i)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/title/i), 'X');
  setValue(screen.getByLabelText(/^end/i), '2026-10-06T08:00');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/end must be after the start/i)).toBeInTheDocument();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('accepts a 200-character emoji title without complaint', async () => {
  const props = setup();
  setValue(screen.getByLabelText(/title/i), '🎉'.repeat(100));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(props.onSave).toHaveBeenCalled();
});

test('rejects a title over 200 characters', async () => {
  const props = setup();
  setValue(screen.getByLabelText(/title/i), 'x'.repeat(201));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/200 characters/i)).toBeInTheDocument();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('blocks reserved colors with an explanation and allows near-by shades', async () => {
  const props = setup({ initial: { ...initial, title: 'X', color: '#FF8A5B' } });
  expect(screen.getByText(/reserved/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('edit mode shows a two-step delete', async () => {
  const props = setup({ mode: 'edit', initial: { ...initial, id: 'e1', title: 'Planning' } });
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  expect(props.onDelete).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
  expect(props.onDelete).toHaveBeenCalledWith('e1');
});

test('Escape closes the dialog', async () => {
  const props = setup();
  await userEvent.keyboard('{Escape}');
  expect(props.onClose).toHaveBeenCalled();
});

test('stays open and shows the error when saving fails', async () => {
  const props = setup({ onSave: jest.fn().mockRejectedValue(new Error('Server said no')) });
  await userEvent.type(screen.getByLabelText(/title/i), 'X');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(await screen.findByText(/server said no/i)).toBeInTheDocument();
  expect(props.onClose).not.toHaveBeenCalled();
});
```

Add to `src/components/CalendarView.test.tsx` (new `test` blocks; keep existing mocks):

```tsx
test('Add event opens an empty dialog and creating refreshes the calendar', async () => {
  mocked.createEvent.mockResolvedValue(ev({ id: 'new', title: 'Created' }));
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /add event/i }));
  await userEvent.type(screen.getByLabelText(/title/i), 'Created');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mocked.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Created' })));
  await waitFor(() => expect(mocked.listEvents).toHaveBeenCalledTimes(2));
});

test('dragging a range offers Add event in a toolbar, which opens the dialog on that range', async () => {
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByText('mock-select'));
  const toolbar = screen.getByRole('toolbar');
  await userEvent.click(within(toolbar).getByRole('button', { name: /add event/i }));
  expect(screen.getByLabelText(/^start/i)).toHaveValue('2026-10-06T09:00');
});

test('clicking an event opens it for editing and saving updates it', async () => {
  mocked.updateEvent.mockResolvedValue(ev({ title: 'Renamed' }));
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /open planning/i }));
  const title = screen.getByLabelText(/title/i);
  await userEvent.clear(title);
  await userEvent.type(title, 'Renamed');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(mocked.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Renamed' })));
});

test('deleting an event calls the API and closes the dialog', async () => {
  mocked.deleteEvent.mockResolvedValue(undefined);
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /open planning/i }));
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
  await waitFor(() => expect(mocked.deleteEvent).toHaveBeenCalledWith('e1'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
```

(Add `within` to the existing `@testing-library/react` import in that test file.)

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/lib/preferences src/components`
Expected: FAIL (new modules missing; new CalendarView cases fail).

- [ ] **Step 3: Create `src/lib/preferences.ts`**

```ts
const KEY = 'schedule.defaultEventColor';

export function getDefaultEventColor(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDefaultEventColor(color: string | null): void {
  try {
    if (color) localStorage.setItem(KEY, color);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the preference simply does not persist */
  }
}
```

- [ ] **Step 4: Create `src/components/ColorPicker.tsx`**

```tsx
import React from 'react';
import { isReservedColor } from '../styles/reservedColors';

export const EVENT_SWATCHES: readonly string[] = ['#4A63F0', '#3B4FD6', '#6C7DF5', '#7B5CD6', '#5B3FC4', '#2F8FD6'];

interface Props {
  value: string | null;
  onChange(color: string | null): void;
}

export default function ColorPicker({ value, onChange }: Props) {
  const reserved = isReservedColor(value);
  return (
    <div className="field">
      <span className="field__label">Color</span>
      <div role="group" aria-label="Event color" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className={`btn btn--ghost${value === null ? ' swatch--selected' : ''}`}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          Default
        </button>
        {EVENT_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={value === c}
            className={`swatch${value === c ? ' swatch--selected' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <input
          type="color"
          aria-label="Custom color"
          value={value ?? '#4a63f0'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </div>
      {reserved && (
        <span className="field__error" role="alert">
          That exact color is reserved for conflicts, work hours, or the app itself. Pick a slightly different shade.
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/SelectionToolbar.tsx`**

```tsx
import React, { useState } from 'react';

interface Props {
  range: { start: Date; end: Date };
  onAddEvent(): void;
  onMarkZone?(repeatsWeekly: boolean): void;
  onCancel(): void;
}

export default function SelectionToolbar({ onAddEvent, onMarkZone, onCancel }: Props) {
  const [weekly, setWeekly] = useState(false);
  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selected time range">
      <button className="btn btn--primary" type="button" onClick={onAddEvent}>
        Add event
      </button>
      {onMarkZone && (
        <>
          <button className="btn" type="button" onClick={() => onMarkZone(weekly)}>
            Mark as unconflicted zone
          </button>
          <label className="field__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            Repeat weekly
          </label>
        </>
      )}
      <button className="btn btn--ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/EventDialog.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { EventInput, EventKind } from '../api/types';
import { isReservedColor } from '../styles/reservedColors';
import ColorPicker from './ColorPicker';

export interface EventDraft {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  kind: EventKind;
  color: string | null;
  notes: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  initial: EventDraft;
  onSave(input: EventInput, id?: string): Promise<void>;
  onDelete?(id: string): Promise<void>;
  onClose(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function EventDialog({ mode, initial, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [start, setStart] = useState(toLocalInput(initial.start));
  const [end, setEnd] = useState(toLocalInput(initial.end));
  const [kind, setKind] = useState<EventKind>(initial.kind);
  const [color, setColor] = useState<string | null>(initial.color);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [errors, setErrors] = useState<{ title?: string; end?: string; form?: string }>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    const next: typeof errors = {};
    if (!trimmed) next.title = 'Enter a title.';
    else if (trimmed.length > 200) next.title = 'Titles can be at most 200 characters.';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      next.end = 'End must be after the start.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSave(
        {
          title: trimmed, start_at: startDate.toISOString(), end_at: endDate.toISOString(), kind, color,
          notes: notes.trim() ? notes : null,
        },
        initial.id
      );
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save the event.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog__backdrop">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" onSubmit={submit}>
        <h2 className="dialog__title" id="event-dialog-title">
          {mode === 'create' ? 'New event' : 'Edit event'}
        </h2>

        <div className="field">
          <label className="field__label" htmlFor="ev-title">Title</label>
          <input id="ev-title" ref={titleRef} className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <span className="field__error">{errors.title}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ev-start">Start</label>
          <input id="ev-start" type="datetime-local" className="field__input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-end">End</label>
          <input id="ev-end" type="datetime-local" className="field__input" value={end} onChange={(e) => setEnd(e.target.value)} />
          {errors.end && <span className="field__error">{errors.end}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ev-kind">Type</label>
          <select id="ev-kind" className="field__input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            <option value="event">Event</option>
            <option value="time_block">Time block</option>
          </select>
        </div>

        <ColorPicker value={color} onChange={setColor} />

        <div className="field">
          <label className="field__label" htmlFor="ev-notes">Notes</label>
          <textarea id="ev-notes" className="field__input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {errors.form && <p className="field__error" role="alert">{errors.form}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {mode === 'edit' && initial.id && onDelete &&
            (confirmingDelete ? (
              <button type="button" className="btn" onClick={() => void onDelete(initial.id!)}>
                Confirm delete
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            ))}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || isReservedColor(color)}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Wire the dialog and toolbar into `CalendarView`**

Replace the `CalendarView` function in `src/components/CalendarView.tsx` with the following (keep `CALENDAR_OPTIONS` and `toFullCalendarEvent` as they are, and add the imports shown):

```tsx
import { useState } from 'react';
import * as api from '../api/client';
import { EventInput } from '../api/types';
import { getDefaultEventColor } from '../lib/preferences';
import EventDialog, { EventDraft } from './EventDialog';
import SelectionToolbar from './SelectionToolbar';
import { useToast } from './Toast';

export default function CalendarView() {
  const data = useCalendarData();
  const { showError } = useToast();
  const [draft, setDraft] = useState<{ mode: 'create' | 'edit'; value: EventDraft } | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date } | null>(null);

  const calendarEvents = useMemo(
    () => [
      ...data.events.map(toFullCalendarEvent),
      ...(data.range ? workHoursToBackground(data.workHours, data.range.from, data.range.to) : []),
    ],
    [data.events, data.workHours, data.range]
  );

  function newDraft(start: Date, end: Date): EventDraft {
    return { title: '', start, end, kind: 'event', color: getDefaultEventColor(), notes: null };
  }

  function openNewEvent() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    setDraft({ mode: 'create', value: newDraft(start, new Date(start.getTime() + 3600000)) });
  }

  async function save(input: EventInput, id?: string) {
    if (id) await api.updateEvent(id, input);
    else await api.createEvent(input);
    setDraft(null);
    await data.reload();
  }

  async function remove(id: string) {
    try {
      await api.deleteEvent(id);
      setDraft(null);
      await data.reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not delete the event.');
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Schedule</h1>
        <button className="btn btn--primary" type="button" onClick={openNewEvent}>
          Add event
        </button>
      </header>
      {data.loadError && (
        <div className="load-error" role="alert">
          <span>{data.loadError}</span>
          <button className="btn" type="button" onClick={() => void data.reload()}>
            Retry
          </button>
        </div>
      )}
      <FullCalendar
        {...CALENDAR_OPTIONS}
        events={calendarEvents}
        datesSet={(arg) => data.setRange({ from: arg.start, to: arg.end })}
        select={(arg) => setSelection({ start: arg.start, end: arg.end })}
        eventClick={(arg) => {
          const e = data.events.find((x) => x.id === arg.event.id);
          if (!e) return;
          setDraft({
            mode: 'edit',
            value: { id: e.id, title: e.title, start: new Date(e.start_at), end: new Date(e.end_at), kind: e.kind, color: e.color, notes: e.notes },
          });
        }}
      />
      {selection && (
        <SelectionToolbar
          range={selection}
          onAddEvent={() => {
            setDraft({ mode: 'create', value: newDraft(selection.start, selection.end) });
            setSelection(null);
          }}
          onCancel={() => setSelection(null)}
        />
      )}
      {draft && (
        <EventDialog
          mode={draft.mode}
          initial={draft.value}
          onSave={save}
          onDelete={remove}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Import the stylesheet entry (once)**

First run `git merge Calender-dev` in your worktree so `src/styles/index.css` (Task 8) exists. Then, in `src/index.tsx`, add this line directly below the `ReactDOM` import:

```tsx
import './styles/index.css';
```

This is the only place the stylesheet entry is imported. Confirm in your report that `grep -rn "styles/index.css" src` finds exactly this one line.

- [ ] **Step 9: Run all client tests, type check, and build**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 10: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add event dialog, color picker, selection toolbar, and event CRUD in the calendar"
```

---

### Task 12: Drag to move and resize with 15-minute snapping and rollback

**Files:**
- Create: `src/lib/eventChange.ts`
- Modify: `src/components/CalendarView.tsx`
- Test: `src/lib/eventChange.test.ts`, `src/components/CalendarView.test.tsx` (add cases)

**Interfaces:**
- Consumes: `updateEvent` (Task 9), `CALENDAR_OPTIONS` (already sets `snapDuration: '00:15:00'`, `allDaySlot: false`, `editable: true`, and the press-and-hold delays), `useToast`, `useCalendarData` (`setEvents`, `reload`).
- Produces: `persistEventChange(info: ChangeInfo, update: (id: string, patch: { start_at: string; end_at: string }) => Promise<unknown>, onSaved: () => void, onError: (message: string) => void): Promise<void>` where `ChangeInfo = { event: { id: string; start: Date | null; end: Date | null; allDay?: boolean }; revert(): void }`. It saves the new times via `update`; on any failure (or a missing/invalid start or end, or an all-day drop) it calls `info.revert()` and `onError` with a readable message and does not call `update` for invalid input.

- [ ] **Step 1: Write the failing tests**

`src/lib/eventChange.test.ts`:

```ts
import { persistEventChange } from './eventChange';

const info = (over = {}) => ({
  event: { id: 'e1', start: new Date('2026-10-06T10:15:00Z'), end: new Date('2026-10-06T11:45:00Z'), allDay: false, ...over },
  revert: jest.fn(),
});

test('saves the new start and end as ISO strings and reports success', async () => {
  const update = jest.fn().mockResolvedValue({});
  const onSaved = jest.fn();
  const i = info();
  await persistEventChange(i, update, onSaved, jest.fn());
  expect(update).toHaveBeenCalledWith('e1', { start_at: '2026-10-06T10:15:00.000Z', end_at: '2026-10-06T11:45:00.000Z' });
  expect(onSaved).toHaveBeenCalled();
  expect(i.revert).not.toHaveBeenCalled();
});

test('reverts and explains when the save fails', async () => {
  const update = jest.fn().mockRejectedValue(new Error('end_at must be after start_at'));
  const onError = jest.fn();
  const i = info();
  await persistEventChange(i, update, jest.fn(), onError);
  expect(i.revert).toHaveBeenCalled();
  expect(onError).toHaveBeenCalledWith('end_at must be after start_at');
});

test('reverts without calling the server when the end is missing, not after the start, or the drop is all-day', async () => {
  for (const bad of [
    { end: null },
    { end: new Date('2026-10-06T10:15:00Z') },
    { end: new Date('2026-10-06T09:00:00Z') },
    { allDay: true },
    { start: null },
  ]) {
    const update = jest.fn();
    const onError = jest.fn();
    const i = info(bad);
    await persistEventChange(i, update, jest.fn(), onError);
    expect(update).not.toHaveBeenCalled();
    expect(i.revert).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  }
});
```

Add to `src/components/CalendarView.test.tsx`:

```tsx
test('dropping an event saves its new times and refreshes conflicts', async () => {
  mocked.updateEvent.mockResolvedValue(ev());
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /drag planning/i }));
  await waitFor(() =>
    expect(mocked.updateEvent).toHaveBeenCalledWith('e1', {
      start_at: '2026-10-06T11:00:00.000Z',
      end_at: '2026-10-06T12:00:00.000Z',
    })
  );
  await waitFor(() => expect(mocked.getConflicts).toHaveBeenCalledTimes(2));
});

test('a failed drop reverts the event and shows a toast', async () => {
  const revert = jest.fn();
  (window as any).__revert = revert;
  mocked.updateEvent.mockRejectedValue(new Error('Could not save that move'));
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /drag planning/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that move');
  expect(revert).toHaveBeenCalled();
  delete (window as any).__revert;
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/lib/eventChange src/components/CalendarView`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/eventChange.ts`**

```ts
export interface ChangeInfo {
  event: { id: string; start: Date | null; end: Date | null; allDay?: boolean };
  revert(): void;
}

export async function persistEventChange(
  info: ChangeInfo,
  update: (id: string, patch: { start_at: string; end_at: string }) => Promise<unknown>,
  onSaved: () => void,
  onError: (message: string) => void
): Promise<void> {
  const { id, start, end, allDay } = info.event;
  if (allDay || !start || !end || end.getTime() <= start.getTime()) {
    info.revert();
    onError('Events need a start and end time, and the end must be after the start.');
    return;
  }
  try {
    await update(id, { start_at: start.toISOString(), end_at: end.toISOString() });
    onSaved();
  } catch (err) {
    info.revert();
    onError(err instanceof Error ? err.message : 'Could not save that change.');
  }
}
```

- [ ] **Step 4: Wire it into `CalendarView`**

Add the import `import { persistEventChange } from '../lib/eventChange';` and add these two props to the `<FullCalendar ... />` element:

```tsx
        eventDrop={(info) => void persistEventChange(info, api.updateEvent, () => void data.reload(), showError)}
        eventResize={(info) => void persistEventChange(info, api.updateEvent, () => void data.reload(), showError)}
```

- [ ] **Step 5: Run all client tests, type check, and build**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add drag-to-move and resize with snapping, rollback, and toast on failure"
```


### Task 13: Conflict badges, popover, and the three conflict states

**Files:**
- Create: `src/lib/conflictIndex.ts`, `src/components/ConflictIcon.tsx`, `src/components/ConflictBadge.tsx`, `src/components/ConflictPopover.tsx`
- Modify: `src/components/CalendarView.tsx`
- Test: `src/lib/conflictIndex.test.ts`, `src/components/CalendarView.test.tsx` (add cases)

**Interfaces:**
- Consumes: `ConflictsResponse` (Task 9); `createIgnore`, `deleteIgnore`, `getConflicts` (Task 9); `CalendarView` from Tasks 10-12; classes `conflict-badge`, `conflict-badge--ignored`, `popover`, `popover__title`, `popover__actions`, `btn`, `btn--primary`, `cal-event--conflict`, `cal-event--ignored`.
- Produces:
  - `interface ConflictInfo { eventAId: string; eventBId: string; otherId: string; state: 'active' | 'ignored'; mode?: 'once' | 'allow'; ignoreId?: string }`
  - `indexConflicts(resp: ConflictsResponse): Map<string, ConflictInfo[]>` (each conflict is listed under both of its event ids)
  - `eventConflictState(infos: ConflictInfo[] | undefined): 'active' | 'ignored' | null` (any active conflict wins over ignored)
  - `ConflictIcon({ size?: number })`, `ConflictBadge({ state, mode, otherTitle, onOpen(rect: DOMRect) })`, `ConflictPopover({ x, y, otherTitle, state, mode, onIgnoreOnce, onAllow, onRestore, onClose })`.

- [ ] **Step 1: Write the failing tests**

`src/lib/conflictIndex.test.ts`:

```ts
import { eventConflictState, indexConflicts } from './conflictIndex';

const active = { eventAId: 'a', eventBId: 'b', overlapStart: 's', overlapEnd: 'e' };
const ignored = { eventAId: 'b', eventBId: 'c', overlapStart: 's', overlapEnd: 'e', mode: 'allow' as const, ignoreId: 'i1' };

test('lists each conflict under both of its events', () => {
  const idx = indexConflicts({ active: [active], ignored: [ignored] });
  expect(idx.get('a')).toEqual([{ eventAId: 'a', eventBId: 'b', otherId: 'b', state: 'active' }]);
  expect(idx.get('c')).toEqual([{ eventAId: 'b', eventBId: 'c', otherId: 'b', state: 'ignored', mode: 'allow', ignoreId: 'i1' }]);
  expect(idx.get('b')).toHaveLength(2);
});

test('an active conflict wins over an ignored one; none gives null', () => {
  const idx = indexConflicts({ active: [active], ignored: [ignored] });
  expect(eventConflictState(idx.get('b'))).toBe('active');
  expect(eventConflictState(idx.get('c'))).toBe('ignored');
  expect(eventConflictState(idx.get('zzz'))).toBeNull();
});
```

Add to `src/components/CalendarView.test.tsx` (these use a second event, so add `ev2` next to `ev` and, in the file's `beforeEach`, `mocked.createIgnore.mockResolvedValue(undefined); mocked.deleteIgnore.mockResolvedValue(undefined);`):

```tsx
const ev2 = () => ev({ id: 'e2', title: 'Dentist', start_at: '2026-10-06T10:30:00.000Z', end_at: '2026-10-06T11:30:00.000Z' });
const activeConflict = { eventAId: 'e1', eventBId: 'e2', overlapStart: '2026-10-06T10:30:00.000Z', overlapEnd: '2026-10-06T11:00:00.000Z' };

describe('conflict states', () => {
  test('an active conflict marks both events and shows a Conflict badge on each', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    expect(screen.getByTestId('event-e1')).toHaveClass('cal-event--conflict');
    expect(screen.getByTestId('event-e2')).toHaveClass('cal-event--conflict');
    expect(screen.getAllByRole('button', { name: /^conflict: overlaps with/i })).toHaveLength(2);
  });

  test('"Ignore this once" saves a once-ignore for the pair and refreshes conflicts', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByRole('button', { name: /conflict: overlaps with dentist/i }));
    expect(screen.getByText(/overlaps with dentist/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ignore this once/i }));
    await waitFor(() => expect(mocked.createIgnore).toHaveBeenCalledWith({ eventAId: 'e1', eventBId: 'e2', mode: 'once' }));
    await waitFor(() => expect(mocked.getConflicts).toHaveBeenCalledTimes(2));
  });

  test('"Allow overlap" saves an allow-ignore', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByRole('button', { name: /conflict: overlaps with dentist/i }));
    await userEvent.click(screen.getByRole('button', { name: /allow overlap/i }));
    await waitFor(() => expect(mocked.createIgnore).toHaveBeenCalledWith({ eventAId: 'e1', eventBId: 'e2', mode: 'allow' }));
  });

  test('an ignored conflict is shown quietly and can be restored', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [], ignored: [{ ...activeConflict, mode: 'allow', ignoreId: 'ign1' }] });
    renderView();
    await screen.findByText('Planning');
    expect(screen.getByTestId('event-e1')).toHaveClass('cal-event--ignored');
    expect(screen.getByTestId('event-e1')).not.toHaveClass('cal-event--conflict');
    await userEvent.click(screen.getAllByRole('button', { name: /^allowed: overlaps with/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /restore conflict/i }));
    await waitFor(() => expect(mocked.deleteIgnore).toHaveBeenCalledWith('ign1'));
  });

  test('a failed ignore shows a toast', async () => {
    mocked.listEvents.mockResolvedValue([ev(), ev2()]);
    mocked.getConflicts.mockResolvedValue({ active: [activeConflict], ignored: [] });
    mocked.createIgnore.mockRejectedValue(new Error('Those events do not overlap'));
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getAllByRole('button', { name: /^conflict: overlaps with/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /allow overlap/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Those events do not overlap');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/lib/conflictIndex src/components/CalendarView`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/conflictIndex.ts`**

```ts
import { ConflictsResponse } from '../api/types';

export interface ConflictInfo {
  eventAId: string;
  eventBId: string;
  otherId: string;
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  ignoreId?: string;
}

export function indexConflicts(resp: ConflictsResponse): Map<string, ConflictInfo[]> {
  const map = new Map<string, ConflictInfo[]>();
  const add = (id: string, info: ConflictInfo) => map.set(id, [...(map.get(id) ?? []), info]);
  for (const c of resp.active) {
    add(c.eventAId, { eventAId: c.eventAId, eventBId: c.eventBId, otherId: c.eventBId, state: 'active' });
    add(c.eventBId, { eventAId: c.eventAId, eventBId: c.eventBId, otherId: c.eventAId, state: 'active' });
  }
  for (const c of resp.ignored) {
    const base = { eventAId: c.eventAId, eventBId: c.eventBId, state: 'ignored' as const, mode: c.mode, ignoreId: c.ignoreId };
    add(c.eventAId, { ...base, otherId: c.eventBId });
    add(c.eventBId, { ...base, otherId: c.eventAId });
  }
  return map;
}

export function eventConflictState(infos: ConflictInfo[] | undefined): 'active' | 'ignored' | null {
  if (!infos || infos.length === 0) return null;
  return infos.some((i) => i.state === 'active') ? 'active' : 'ignored';
}
```

- [ ] **Step 4: Create `src/components/ConflictIcon.tsx`** (a clock with an exclamation mark, drawn as inline SVG, so the conflict marker never depends on color)

```tsx
import React from 'react';

export default function ConflictIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="8.5" r="5.5" />
      <path d="M7 5.5v3l2 1.5" />
      <path d="M13.5 1.5v3.2" />
      <circle cx="13.5" cy="6.6" r="0.5" fill="currentColor" />
    </svg>
  );
}
```

- [ ] **Step 5: Create `src/components/ConflictBadge.tsx`**

```tsx
import React from 'react';
import ConflictIcon from './ConflictIcon';

interface Props {
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  otherTitle: string;
  onOpen(rect: DOMRect): void;
}

export default function ConflictBadge({ state, mode, otherTitle, onOpen }: Props) {
  const label = state === 'active' ? 'Conflict' : mode === 'allow' ? 'Allowed' : 'Ignored';
  return (
    <button
      type="button"
      className={`conflict-badge${state === 'ignored' ? ' conflict-badge--ignored' : ''}`}
      aria-label={`${label}: overlaps with ${otherTitle}. Open options`}
      onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
    >
      <ConflictIcon />
      {label}
    </button>
  );
}
```

- [ ] **Step 6: Create `src/components/ConflictPopover.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';

interface Props {
  x: number;
  y: number;
  otherTitle: string;
  state: 'active' | 'ignored';
  mode?: 'once' | 'allow';
  onIgnoreOnce(): void;
  onAllow(): void;
  onRestore(): void;
  onClose(): void;
}

export default function ConflictPopover({ x, y, otherTitle, state, mode, onIgnoreOnce, onAllow, onRestore, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(x, window.innerWidth - 316));
  const top = Math.max(8, Math.min(y + 8, window.innerHeight - 180));

  return (
    <div ref={ref} className="popover" role="dialog" aria-label="Conflict options" style={{ left, top }}>
      {state === 'active' ? (
        <>
          <p className="popover__title">Overlaps with {otherTitle}</p>
          <div className="popover__actions">
            <button type="button" className="btn" onClick={onIgnoreOnce}>Ignore this once</button>
            <button type="button" className="btn btn--primary" onClick={onAllow}>Allow overlap</button>
          </div>
        </>
      ) : (
        <>
          <p className="popover__title">
            {mode === 'allow' ? 'Allowed' : 'Ignored'} overlap with {otherTitle}
          </p>
          <div className="popover__actions">
            <button type="button" className="btn" onClick={onRestore}>Restore conflict</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Wire into `CalendarView`**

Add imports:

```tsx
import ConflictBadge from './ConflictBadge';
import ConflictPopover from './ConflictPopover';
import { ConflictInfo, eventConflictState, indexConflicts } from '../lib/conflictIndex';
```

Inside `CalendarView`, add state and helpers after the existing state declarations:

```tsx
  const [popover, setPopover] = useState<{ x: number; y: number; eventId: string; info: ConflictInfo } | null>(null);
  const conflictIndex = useMemo(() => indexConflicts(data.conflicts), [data.conflicts]);
  const titleOf = (id: string) => data.events.find((e) => e.id === id)?.title ?? 'another event';

  async function chooseIgnore(info: ConflictInfo, mode: 'once' | 'allow') {
    try {
      await api.createIgnore({ eventAId: info.eventAId, eventBId: info.eventBId, mode });
      setPopover(null);
      await data.reload();
    } catch (err) {
      setPopover(null);
      showError(err instanceof Error ? err.message : 'Could not save that choice.');
    }
  }

  async function restore(info: ConflictInfo) {
    try {
      if (info.ignoreId) await api.deleteIgnore(info.ignoreId);
      setPopover(null);
      await data.reload();
    } catch (err) {
      setPopover(null);
      showError(err instanceof Error ? err.message : 'Could not restore that conflict.');
    }
  }
```

Replace the `calendarEvents` memo with one that adds the state classes:

```tsx
  const calendarEvents = useMemo(
    () => [
      ...data.events.map((e) => {
        const fc = toFullCalendarEvent(e);
        const state = eventConflictState(conflictIndex.get(e.id));
        const extra = state === 'active' ? ['cal-event--conflict'] : state === 'ignored' ? ['cal-event--ignored'] : [];
        return { ...fc, classNames: [...fc.classNames, ...extra] };
      }),
      ...(data.range ? workHoursToBackground(data.workHours, data.range.from, data.range.to) : []),
    ],
    [data.events, data.workHours, data.range, conflictIndex]
  );
```

Add to the `<FullCalendar />` element (and extend the existing `eventClick` so a click on a badge does not also open the edit dialog — insert as its first line):

```tsx
        eventContent={(arg) => {
          const infos = conflictIndex.get(arg.event.id);
          const state = eventConflictState(infos);
          const info = infos?.find((i) => i.state === state);
          return (
            <div>
              <div className="fc-event-title">{arg.event.title}</div>
              {state && info && (
                <ConflictBadge
                  state={state}
                  mode={info.mode}
                  otherTitle={titleOf(info.otherId)}
                  onOpen={(rect) => setPopover({ x: rect.left, y: rect.bottom, eventId: arg.event.id, info })}
                />
              )}
            </div>
          );
        }}
```

and, as the first line inside the existing `eventClick` handler:

```tsx
          if ((arg as { jsEvent?: MouseEvent }).jsEvent && ((arg as { jsEvent: MouseEvent }).jsEvent.target as HTMLElement).closest('.conflict-badge')) return;
```

Render the popover after the toolbar/dialog blocks:

```tsx
      {popover && (
        <ConflictPopover
          x={popover.x}
          y={popover.y}
          otherTitle={titleOf(popover.info.otherId)}
          state={popover.info.state}
          mode={popover.info.mode}
          onIgnoreOnce={() => void chooseIgnore(popover.info, 'once')}
          onAllow={() => void chooseIgnore(popover.info, 'allow')}
          onRestore={() => void restore(popover.info)}
          onClose={() => setPopover(null)}
        />
      )}
```

- [ ] **Step 8: Run all client tests, type check, and build**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add conflict badges, popover actions, and active/ignored conflict states"
```

---

### Task 14: Unconflicted zones from a drag-selection

**Files:**
- Create: `src/lib/zoneBand.ts`
- Modify: `src/lib/workHoursBand.ts` (add optional `title` to `BackgroundEvent`), `src/components/CalendarView.tsx`
- Test: `src/lib/zoneBand.test.ts`, `src/components/CalendarView.test.tsx` (add cases)

**Interfaces:**
- Consumes: `createZone` (Task 9), `SelectionToolbar` with `onMarkZone` (Task 11), `BackgroundEvent` (Task 10), `useCalendarData().zones`.
- Produces: `zonesToBackground(zones: ConflictZone[], rangeStart: Date, rangeEnd: Date): BackgroundEvent[]` — one-off zones that overlap the range become one band each; weekly zones become one band per matching local weekday on or after the zone's own start date, with the same local start/end clock times. Bands use `classNames: ['cal-zone']` and `title: 'Conflicts off'`.

- [ ] **Step 1: Write the failing tests**

`src/lib/zoneBand.test.ts`:

```ts
import { zonesToBackground } from './zoneBand';

const oneOff = { id: 'z1', start_at: new Date(2026, 9, 9, 9, 0).toISOString(), end_at: new Date(2026, 9, 9, 17, 0).toISOString(), repeats_weekly: false };
const weekly = { id: 'z2', start_at: new Date(2026, 9, 5, 9, 0).toISOString(), end_at: new Date(2026, 9, 5, 17, 0).toISOString(), repeats_weekly: true }; // Monday

test('a one-off zone inside the range becomes one labelled band', () => {
  const bands = zonesToBackground([oneOff], new Date(2026, 9, 5), new Date(2026, 9, 12));
  expect(bands).toHaveLength(1);
  expect(bands[0]).toMatchObject({ display: 'background', classNames: ['cal-zone'], title: 'Conflicts off' });
  expect(bands[0].start).toEqual(new Date(2026, 9, 9, 9, 0));
  expect(bands[0].end).toEqual(new Date(2026, 9, 9, 17, 0));
});

test('a one-off zone outside the range is not shown', () => {
  expect(zonesToBackground([oneOff], new Date(2026, 9, 12), new Date(2026, 9, 19))).toEqual([]);
});

test('a weekly zone repeats on the same weekday with the same clock times', () => {
  const bands = zonesToBackground([weekly], new Date(2026, 9, 5), new Date(2026, 9, 19));
  expect(bands.map((b) => b.start)).toEqual([new Date(2026, 9, 5, 9, 0), new Date(2026, 9, 12, 9, 0)]);
  expect(bands.map((b) => b.end)).toEqual([new Date(2026, 9, 5, 17, 0), new Date(2026, 9, 12, 17, 0)]);
});

test('a weekly zone does not appear in weeks before it was created', () => {
  expect(zonesToBackground([weekly], new Date(2026, 8, 21), new Date(2026, 9, 5))).toEqual([]);
});

test('a weekly zone that runs past midnight ends on the next day', () => {
  const night = { id: 'z3', start_at: new Date(2026, 9, 5, 22, 0).toISOString(), end_at: new Date(2026, 9, 6, 2, 0).toISOString(), repeats_weekly: true };
  const [band] = zonesToBackground([night], new Date(2026, 9, 12), new Date(2026, 9, 19));
  expect(band.start).toEqual(new Date(2026, 9, 12, 22, 0));
  expect(band.end).toEqual(new Date(2026, 9, 13, 2, 0));
});

test('every band has a unique id', () => {
  const ids = zonesToBackground([weekly, oneOff], new Date(2026, 9, 5), new Date(2026, 9, 19)).map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
});
```

Add to `src/components/CalendarView.test.tsx`:

```tsx
describe('unconflicted zones', () => {
  test('the toolbar offers Mark as unconflicted zone and saves the dragged range', async () => {
    mocked.createZone.mockResolvedValue({ id: 'z', start_at: '', end_at: '', repeats_weekly: false });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(screen.getByRole('button', { name: /mark as unconflicted zone/i }));
    await waitFor(() =>
      expect(mocked.createZone).toHaveBeenCalledWith({
        start_at: new Date(2026, 9, 6, 9, 0).toISOString(),
        end_at: new Date(2026, 9, 6, 10, 0).toISOString(),
        repeats_weekly: false,
      })
    );
    await waitFor(() => expect(mocked.listZones).toHaveBeenCalledTimes(2));
  });

  test('"Repeat weekly" makes the zone repeat', async () => {
    mocked.createZone.mockResolvedValue({ id: 'z', start_at: '', end_at: '', repeats_weekly: true });
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(screen.getByLabelText(/repeat weekly/i));
    await userEvent.click(screen.getByRole('button', { name: /mark as unconflicted zone/i }));
    await waitFor(() => expect(mocked.createZone).toHaveBeenCalledWith(expect.objectContaining({ repeats_weekly: true })));
  });

  test('zones from the server are drawn as background bands', async () => {
    mocked.listZones.mockResolvedValue([
      { id: 'z', start_at: new Date(2026, 9, 6, 9, 0).toISOString(), end_at: new Date(2026, 9, 6, 17, 0).toISOString(), repeats_weekly: false },
    ]);
    renderView();
    await screen.findByText('Planning');
    await waitFor(() => expect(screen.getByTestId('bands')).toHaveTextContent('2')); // 1 work-hours band + 1 zone
  });

  test('a failed zone save shows a toast and keeps the toolbar', async () => {
    mocked.createZone.mockRejectedValue(new Error('end_at must be after start_at'));
    renderView();
    await screen.findByText('Planning');
    await userEvent.click(screen.getByText('mock-select'));
    await userEvent.click(screen.getByRole('button', { name: /mark as unconflicted zone/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('end_at must be after start_at');
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/lib/zoneBand src/components/CalendarView`
Expected: FAIL.

- [ ] **Step 3: Add `title?: string` to the `BackgroundEvent` interface in `src/lib/workHoursBand.ts`**

```ts
export interface BackgroundEvent {
  id: string;
  title?: string;
  start: Date;
  end: Date;
  display: 'background';
  classNames: string[];
}
```

- [ ] **Step 4: Create `src/lib/zoneBand.ts`**

```ts
import { ConflictZone } from '../api/types';
import { BackgroundEvent } from './workHoursBand';

const LABEL = 'Conflicts off';

export function zonesToBackground(zones: ConflictZone[], rangeStart: Date, rangeEnd: Date): BackgroundEvent[] {
  const out: BackgroundEvent[] = [];
  for (const z of zones) {
    const start = new Date(z.start_at);
    const end = new Date(z.end_at);
    if (!z.repeats_weekly) {
      if (start < rangeEnd && end > rangeStart) {
        out.push({ id: `zone-${z.id}`, title: LABEL, start, end, display: 'background', classNames: ['cal-zone'] });
      }
      continue;
    }
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayOffset = Math.round(
      (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - startDay.getTime()) / 86400000
    );
    const day = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() - dayOffset);
    while (day < rangeEnd) {
      if (day.getDay() === start.getDay() && day >= startDay) {
        const bandStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes());
        const bandEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset, end.getHours(), end.getMinutes());
        if (bandStart < rangeEnd && bandEnd > rangeStart) {
          out.push({
            id: `zone-${z.id}-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
            title: LABEL, start: bandStart, end: bandEnd, display: 'background', classNames: ['cal-zone'],
          });
        }
      }
      day.setDate(day.getDate() + 1);
    }
  }
  return out;
}
```

- [ ] **Step 5: Wire into `CalendarView`**

Import `zonesToBackground` and add it to the `calendarEvents` memo (after the work-hours bands, and add `data.zones` to the dependency list):

```tsx
      ...(data.range ? zonesToBackground(data.zones, data.range.from, data.range.to) : []),
```

Add a handler next to the other handlers:

```tsx
  async function markZone(repeatsWeekly: boolean) {
    if (!selection) return;
    try {
      await api.createZone({
        start_at: selection.start.toISOString(),
        end_at: selection.end.toISOString(),
        repeats_weekly: repeatsWeekly,
      });
      setSelection(null);
      await data.reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not create the zone.');
    }
  }
```

and pass it to the toolbar: `<SelectionToolbar ... onMarkZone={(weekly) => void markZone(weekly)} ... />`.

- [ ] **Step 6: Run all client tests, type check, and build**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add unconflicted zones from drag-selection, including weekly repeat"
```

---

### Task 15: Settings panel (work hours, zones, allowed overlaps, default color)

**Files:**
- Create: `src/components/WorkHoursEditor.tsx`, `src/components/SettingsPanel.tsx`
- Modify: `src/components/CalendarView.tsx` (Settings button and panel)
- Test: `src/components/WorkHoursEditor.test.tsx`, `src/components/SettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `listWorkHours`, `putWorkHours`, `listZones`, `deleteZone`, `listIgnores`, `deleteIgnore` (Task 9); `ColorPicker`, `getDefaultEventColor`, `setDefaultEventColor` (Task 11); `isReservedColor`; classes `settings`, `settings__section`, `btn`, `field`, `field__label`, `field__input`, `field__error`.
- Produces: `WorkHoursEditor({ value: WorkHour[]; onSave(next: WorkHour[]): Promise<void> })`; `SettingsPanel({ onClose(): void; onChanged(): void })` (`onChanged` is called after any saved change so the calendar can reload).

- [ ] **Step 1: Write the failing tests**

`src/components/WorkHoursEditor.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkHoursEditor from './WorkHoursEditor';

const value = [{ weekday: 1, start_time: '09:00', end_time: '17:00' }];
const set = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

test('shows existing ranges per weekday', () => {
  render(<WorkHoursEditor value={value} onSave={jest.fn()} />);
  expect(screen.getByLabelText('Monday range 1 start')).toHaveValue('09:00');
  expect(screen.getByLabelText('Monday range 1 end')).toHaveValue('17:00');
  expect(screen.queryByLabelText('Tuesday range 1 start')).toBeNull();
});

test('adds a range on another weekday and saves the full sorted set', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<WorkHoursEditor value={value} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add range to Tuesday' }));
  set(screen.getByLabelText('Tuesday range 1 start'), '10:00');
  set(screen.getByLabelText('Tuesday range 1 end'), '12:30');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  expect(onSave).toHaveBeenCalledWith([
    { weekday: 1, start_time: '09:00', end_time: '17:00' },
    { weekday: 2, start_time: '10:00', end_time: '12:30' },
  ]);
});

test('removing a range removes it from the saved set', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<WorkHoursEditor value={value} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: 'Remove Monday range 1' }));
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  expect(onSave).toHaveBeenCalledWith([]);
});

test('rejects an end that is not after the start, and overlapping ranges, without saving', async () => {
  const onSave = jest.fn();
  render(<WorkHoursEditor value={value} onSave={onSave} />);
  set(screen.getByLabelText('Monday range 1 end'), '08:00');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  expect(screen.getByText(/monday: end must be after the start/i)).toBeInTheDocument();
  set(screen.getByLabelText('Monday range 1 end'), '17:00');
  await userEvent.click(screen.getByRole('button', { name: 'Add range to Monday' }));
  set(screen.getByLabelText('Monday range 2 start'), '16:00');
  set(screen.getByLabelText('Monday range 2 end'), '18:00');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  expect(screen.getByText(/monday: ranges overlap/i)).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
```

`src/components/SettingsPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from './SettingsPanel';
import { ToastProvider } from './Toast';
import * as api from '../api/client';

jest.mock('../api/client');
const mocked = api as jest.Mocked<typeof api>;

const zone = { id: 'z1', start_at: new Date(2026, 9, 5, 9, 0).toISOString(), end_at: new Date(2026, 9, 5, 17, 0).toISOString(), repeats_weekly: true };
const ignore = { id: 'i1', event_a_id: 'a', event_b_id: 'b', mode: 'allow' as const, overlap_start: null, overlap_end: null, event_a_title: 'Standup', event_b_title: 'Review' };

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  mocked.listWorkHours.mockResolvedValue([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]);
  mocked.listZones.mockResolvedValue([zone]);
  mocked.listIgnores.mockResolvedValue([ignore]);
  mocked.deleteZone.mockResolvedValue(undefined);
  mocked.deleteIgnore.mockResolvedValue(undefined);
  mocked.putWorkHours.mockResolvedValue([]);
});

const setup = () => {
  const props = { onClose: jest.fn(), onChanged: jest.fn() };
  render(<ToastProvider><SettingsPanel {...props} /></ToastProvider>);
  return props;
};

test('shows work hours, zones, and allowed overlaps loaded from the server', async () => {
  setup();
  expect(await screen.findByLabelText('Monday range 1 start')).toHaveValue('09:00');
  expect(screen.getByText(/repeats weekly/i)).toBeInTheDocument();
  expect(screen.getByText(/standup/i)).toBeInTheDocument();
  expect(screen.getByText(/review/i)).toBeInTheDocument();
});

test('removing a zone calls the API and tells the calendar to reload', async () => {
  mocked.listZones.mockReset().mockResolvedValueOnce([zone]).mockResolvedValue([]);
  const props = setup();
  await userEvent.click(await screen.findByRole('button', { name: /remove zone/i }));
  await waitFor(() => expect(mocked.deleteZone).toHaveBeenCalledWith('z1'));
  expect(props.onChanged).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('button', { name: /remove zone/i })).toBeNull());
});

test('restoring a conflict deletes the allowance', async () => {
  mocked.listIgnores.mockReset().mockResolvedValueOnce([ignore]).mockResolvedValue([]);
  const props = setup();
  await userEvent.click(await screen.findByRole('button', { name: /restore conflict/i }));
  await waitFor(() => expect(mocked.deleteIgnore).toHaveBeenCalledWith('i1'));
  expect(props.onChanged).toHaveBeenCalled();
});

test('saving work hours calls the API and tells the calendar to reload', async () => {
  const props = setup();
  await screen.findByLabelText('Monday range 1 start');
  await userEvent.click(screen.getByRole('button', { name: /save work hours/i }));
  await waitFor(() => expect(mocked.putWorkHours).toHaveBeenCalledWith([{ weekday: 1, start_time: '09:00', end_time: '17:00' }]));
  expect(props.onChanged).toHaveBeenCalled();
});

test('choosing a default event color stores it; a reserved color is refused with an explanation', async () => {
  setup();
  await screen.findByLabelText('Monday range 1 start');
  await userEvent.click(screen.getByRole('button', { name: 'Color #3B4FD6' }));
  expect(localStorage.getItem('schedule.defaultEventColor')).toBe('#3B4FD6');
  fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#ff8a5b' } });
  expect(screen.getByText(/reserved/i)).toBeInTheDocument();
  expect(localStorage.getItem('schedule.defaultEventColor')).toBe('#3B4FD6');
});

test('shows a message when settings cannot be loaded, and Close works', async () => {
  mocked.listWorkHours.mockRejectedValue(new Error('Cannot reach the server'));
  const props = setup();
  expect(await screen.findByText(/cannot reach the server/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(props.onClose).toHaveBeenCalled();
});
```

Add to `src/components/CalendarView.test.tsx` (and in its `beforeEach`: `mocked.listIgnores.mockResolvedValue([]);`):

```tsx
test('the Settings button opens the settings panel and Close hides it', async () => {
  renderView();
  await screen.findByText('Planning');
  await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
  expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false src/components/WorkHoursEditor src/components/SettingsPanel src/components/CalendarView`
Expected: FAIL.

- [ ] **Step 3: Create `src/components/WorkHoursEditor.tsx`**

```tsx
import React, { useState } from 'react';
import { WorkHour } from '../api/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Row extends WorkHour {
  key: number;
}

interface Props {
  value: WorkHour[];
  onSave(next: WorkHour[]): Promise<void>;
}

export default function WorkHoursEditor({ value, onSave }: Props) {
  const [nextKey, setNextKey] = useState(value.length);
  const [rows, setRows] = useState<Row[]>(value.map((w, i) => ({ ...w, key: i })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forDay = (d: number) => rows.filter((r) => r.weekday === d);
  const update = (key: number, patch: Partial<WorkHour>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addRange(weekday: number) {
    setRows((rs) => [...rs, { key: nextKey, weekday, start_time: '09:00', end_time: '17:00' }]);
    setNextKey((k) => k + 1);
  }

  async function save() {
    for (let d = 0; d < 7; d++) {
      const day = forDay(d).sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (const r of day) {
        if (!r.start_time || !r.end_time || r.end_time <= r.start_time) {
          setError(`${DAYS[d]}: end must be after the start.`);
          return;
        }
      }
      for (let i = 1; i < day.length; i++) {
        if (day[i].start_time < day[i - 1].end_time) {
          setError(`${DAYS[d]}: ranges overlap.`);
          return;
        }
      }
    }
    setError(null);
    setBusy(true);
    try {
      const next = rows
        .map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time }))
        .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save work hours.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {DAYS.map((name, d) => (
        <fieldset key={name} style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend className="field__label">{name}</legend>
          {forDay(d).map((r, i) => (
            <div key={r.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <input type="time" className="field__input" aria-label={`${name} range ${i + 1} start`} value={r.start_time} onChange={(e) => update(r.key, { start_time: e.target.value })} />
              <span aria-hidden="true">to</span>
              <input type="time" className="field__input" aria-label={`${name} range ${i + 1} end`} value={r.end_time} onChange={(e) => update(r.key, { end_time: e.target.value })} />
              <button type="button" className="btn btn--ghost" aria-label={`Remove ${name} range ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn btn--ghost" aria-label={`Add range to ${name}`} onClick={() => addRange(d)}>
            + Add range
          </button>
        </fieldset>
      ))}
      {error && <p className="field__error" role="alert">{error}</p>}
      <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
        Save work hours
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/SettingsPanel.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { ConflictIgnore, ConflictZone, WorkHour } from '../api/types';
import { getDefaultEventColor, setDefaultEventColor } from '../lib/preferences';
import { isReservedColor } from '../styles/reservedColors';
import ColorPicker from './ColorPicker';
import { useToast } from './Toast';
import WorkHoursEditor from './WorkHoursEditor';

interface Props {
  onClose(): void;
  onChanged(): void;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function SettingsPanel({ onClose, onChanged }: Props) {
  const { showError } = useToast();
  const [workHours, setWorkHours] = useState<WorkHour[] | null>(null);
  const [zones, setZones] = useState<ConflictZone[]>([]);
  const [ignores, setIgnores] = useState<ConflictIgnore[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(getDefaultEventColor());

  const load = useCallback(async () => {
    try {
      const [w, z, i] = await Promise.all([api.listWorkHours(), api.listZones(), api.listIgnores()]);
      setWorkHours(w);
      setZones(z);
      setIgnores(i);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load settings.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, failure: string) {
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      showError(err instanceof Error ? err.message : failure);
    }
  }

  return (
    <aside className="settings" role="dialog" aria-label="Settings">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="dialog__title">Settings</h2>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
      </div>

      {loadError && <p className="field__error" role="alert">{loadError}</p>}

      <section className="settings__section">
        <h3>Work hours</h3>
        {workHours && (
          <WorkHoursEditor
            value={workHours}
            onSave={async (next) => {
              await api.putWorkHours(next);
              await load();
              onChanged();
            }}
          />
        )}
      </section>

      <section className="settings__section">
        <h3>Unconflicted zones</h3>
        {zones.length === 0 && <p className="field__label">None. Drag across the calendar and choose "Mark as unconflicted zone".</p>}
        {zones.map((z) => (
          <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>
              {fmt(z.start_at)} to {fmt(z.end_at)}
              {z.repeats_weekly ? ' (repeats weekly)' : ''}
            </span>
            <button type="button" className="btn btn--ghost" aria-label={`Remove zone ${fmt(z.start_at)}`} onClick={() => void run(() => api.deleteZone(z.id), 'Could not remove the zone.')}>
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="settings__section">
        <h3>Allowed overlaps</h3>
        {ignores.length === 0 && <p className="field__label">None.</p>}
        {ignores.map((ig) => (
          <div key={ig.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>
              {ig.event_a_title} and {ig.event_b_title} ({ig.mode === 'allow' ? 'always allowed' : 'ignored once'})
            </span>
            <button type="button" className="btn btn--ghost" onClick={() => void run(() => api.deleteIgnore(ig.id), 'Could not restore the conflict.')}>
              Restore conflict
            </button>
          </div>
        ))}
      </section>

      <section className="settings__section">
        <h3>Default event color</h3>
        <ColorPicker
          value={color}
          onChange={(c) => {
            setColor(c);
            if (!isReservedColor(c)) setDefaultEventColor(c);
          }}
        />
      </section>
    </aside>
  );
}
```

- [ ] **Step 5: Add the Settings button and panel to `CalendarView`**

Import `SettingsPanel`, add state `const [showSettings, setShowSettings] = useState(false);`, put this button in the header next to "Add event":

```tsx
        <button className="btn" type="button" onClick={() => setShowSettings(true)}>
          Settings
        </button>
```

and render after the popover block:

```tsx
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onChanged={() => void data.reload()} />}
```

- [ ] **Step 6: Run all client tests, type check, and build**

Run: `cd client/my_scheduler && CI=true npm test -- --watchAll=false && npx tsc --noEmit && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A client/my_scheduler
git commit -m "Add settings panel for work hours, zones, allowed overlaps, and default color"
```

---

## DESIGN AGENT TASKS, LIVE APP (after the Frontend components exist)

### Task 16: Style the live app for CP2 and capture screenshots

**Files:**
- Create: `design/screenshot-app.mjs`, `design/mockups/CP2-NOTES.md`
- Modify: `client/my_scheduler/package.json` (script `design:shots:app`), `src/styles/calendar.css`, `src/styles/components.css`, `src/styles/__tests__/classContract.test.ts` (only if you add classes)
- Output (not committed): `design/screenshots/app-{1280,768,390}.png`, `design/screenshots/app-dialog-{1280,768,390}.png`

**Interfaces:**
- Consumes: the merged Frontend work from Tasks 9-12 on the integration branch (merge `Calender-dev` into your worktree first), the CSS Class Contract, and demo data from `npm run seed:demo` (Task 6).
- Produces: `npm run design:shots:app` (screenshots the running app at 1280, 768, and 390 px, plus the Add-event dialog); a CP2 look that matches the approved CP1 mockup.

- [ ] **Step 1: Create `design/screenshot-app.mjs`**

```js
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? 'http://localhost:3000';
const widths = [1280, 768, 390];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(base);
  await page.waitForSelector('.fc-timegrid');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(here, 'screenshots', `app-${width}.png`), fullPage: true });

  await page.getByRole('button', { name: 'Add event' }).first().click();
  await page.waitForSelector('.dialog');
  await page.screenshot({ path: path.join(here, 'screenshots', `app-dialog-${width}.png`) });
  await page.keyboard.press('Escape');
  await page.close();
}
await browser.close();
console.log('wrote app screenshots');
```

Add to `package.json` scripts: `"design:shots:app": "node design/screenshot-app.mjs"`.

- [ ] **Step 2: Start the stack with demo data**

```bash
# terminal 1 (from the repo root, in the integration checkout or your merged worktree)
scripts/dev-db.sh start    # no-op error if already running; check with scripts/dev-db.sh status
cd server && cp -n .env.example .env && npm run migrate && npm run seed:demo && npm run dev
# terminal 2
cd client/my_scheduler && BROWSER=none npm start      # serves http://localhost:3000, proxies /api to :4000
```

- [ ] **Step 3: Capture and inspect**

Run: `cd client/my_scheduler && npm run design:shots:app`
Expected: `wrote app screenshots`. Open every PNG with the Read tool and compare against `design/screenshots/cp1-calendar-*.png` and the spec (section 4). Check in particular: FullCalendar's default styles are not showing through (white backgrounds, blue default buttons, square corners); events are rounded with readable text; the work-hours band is visible and rounded; today's column is tinted; toolbar buttons are pills; the dialog matches `.dialog` styling; focus rings are visible when tabbing.

- [ ] **Step 4: Fix differences in `calendar.css` / `components.css`, re-run Step 3 until they match**

Use only tokens. Every fix that is not a pure CSS-variable value must come with a line in `design/mockups/CP2-NOTES.md` explaining what FullCalendar was doing and which selector overrides it. Then run `CI=true npm test -- --watchAll=false src/styles` (the "no hard-coded color" and contrast tests must still pass).

- [ ] **Step 5: Commit**

```bash
git add client/my_scheduler/src/styles client/my_scheduler/design client/my_scheduler/package.json
git commit -m "Style the live calendar and add app screenshot script for CP2"
```

---

### Task 17: Style conflicts, popover, and settings for CP3 and capture screenshots

**Files:**
- Modify: `design/screenshot-app.mjs`, `src/styles/components.css`, `src/styles/calendar.css`
- Create: `design/mockups/CP3-NOTES.md`
- Output (not committed): `design/screenshots/app-popover-*.png`, `design/screenshots/app-settings-*.png`

**Interfaces:**
- Consumes: the merged Frontend work from Tasks 13-15 and the seeded week (Mon active conflict, Wed ignored conflict, Fri unconflicted zone).
- Produces: a live app whose three conflict states, popover, selection toolbar, and settings panel match the approved mockups.

- [ ] **Step 1: Extend `design/screenshot-app.mjs`** — inside the width loop, after the dialog screenshot and `Escape`, add:

```js
  const badge = page.locator('.conflict-badge').first();
  if (await badge.count()) {
    await badge.click();
    await page.waitForSelector('.popover');
    await page.screenshot({ path: path.join(here, 'screenshots', `app-popover-${width}.png`) });
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForSelector('.settings');
  await page.screenshot({ path: path.join(here, 'screenshots', `app-settings-${width}.png`) });
```

(Place this before `await page.close();`.)

- [ ] **Step 2: Capture and inspect**

With the stack from Task 16 running: `cd client/my_scheduler && npm run design:shots:app`. Open each PNG and check: active conflict (coral outline + "Conflict" badge with the clock icon), ignored/allowed conflict (dashed quiet outline + muted badge), the zone band (dashed light-blue, "Conflicts off" label, no markers on events inside it), the popover (rounded, two buttons, mint primary), the settings panel (sections readable, inputs rounded, scrollable, full-width at 390 px), and that badges remain tappable (at least 24 px tall) on the phone width.

- [ ] **Step 3: Fix differences with tokens only; re-run until they match. Record decisions in `design/mockups/CP3-NOTES.md`. Run `CI=true npm test -- --watchAll=false src/styles`.**

- [ ] **Step 4: Commit**

```bash
git add client/my_scheduler/src/styles client/my_scheduler/design
git commit -m "Style conflict states, popover, and settings for CP3"
```

---

## Checkpoint checklists (orchestrator)

At each checkpoint, report: what was built, both reviewers' verdicts, exact test results, how to see it running, and decisions needed. Then wait.

### CP1: Design approval (after Round 2)

- [ ] Tokens, contrast, and class-contract tests pass (`CI=true npm test -- --watchAll=false src/styles`).
- [ ] Screenshots exist at 1280, 768, 390 px for `cp1-calendar` and the UX reviewer's verdict is attached.
- [ ] Owner sees: Violet dusk palette, mint primary button, rounded shapes, work-hours band, the three conflict states, the legend. Owner approves or requests changes (including any font critique).
- [ ] Backend through Task 4 passes `npm test`; Frontend through Task 10 passes `CI=true npm test`.

### CP2: Core calendar (after Round 4)

- [ ] Spec coverage: create, edit, delete, drag-to-move, drag-to-resize all work end to end against Postgres; RLS tests pass; work-hours and zones routes exist.
- [ ] How to try it: `scripts/dev-db.sh start` (if not running), then `cd server && npm run migrate && npm run seed:demo && npm run dev`, then `cd client/my_scheduler && npm start`; open http://localhost:3000, drag an event, drag its bottom edge, double-check a failed save by stopping the server and dragging.
- [ ] Both reviewers' verdicts and the live-app screenshots are attached.

### CP3: Conflicts and settings (after Round 6)

- [ ] Spec coverage: conflict detection, badge and popover (Ignore this once, Allow overlap), the three conflict states, drag-selection zones with "repeat weekly", work hours, settings panel, default event color.
- [ ] How to try it: seeded week shows an active conflict (Mon), an allowed one (Wed), and a zone (Fri); create a new overlap by dragging, ignore it once, move an event and watch the ignore expire; mark a zone and watch markers disappear; restore from Settings.
- [ ] Both reviewers' verdicts and screenshots are attached. Owner approval ends sub-projects A and C; B (the AI scheduler) and the Google connector start from their own specs.
