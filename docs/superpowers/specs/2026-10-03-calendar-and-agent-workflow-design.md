# Schedule App — Calendar, Design System, and Agent Workflow (Sub-projects A + C)

Date: 2026-10-03
Status: Draft for owner review

## 1. Purpose

A clean, modern, dark-mode scheduling app that will grow into an AI-assisted planner: it time-blocks days, prioritizes work, and re-plans when events move or get cancelled. This spec covers the first two of three sub-projects:

- **A — Calendar and design system:** a calendar with create, edit, delete, and drag-to-move/resize events; conflict detection with owner-controlled suppression; work hours; settings; a distinctive Violet dusk look.
- **C — Agent workflow:** a team of specialist subagents that builds A in rounds, with the owner reviewing only at milestone checkpoints. The owner's second goal is to practice orchestrating an agent ecosystem.

**B — the AI scheduler** (Claude with tools, logging accept/reject decisions so a local model can be fine-tuned later as a separate side project) gets its own spec and plan after A + C. The **Google Calendar connector** is a follow-on after A + C with its own small spec; this spec only prepares the data model for it.

## 2. Non-goals (this spec)

- The AI scheduler, prioritization logic, and any model training (B).
- The Google Calendar connector, OAuth, and sync (follow-on). Its optional "use Google colors" toggle is further out still.
- Login screens and multi-user features. There is one user; the data layer is multi-user-ready (see 5.3).
- Light mode. Colors are tokens so it can be added later.
- A native mobile app. The web app is responsive.
- Replacing Create React App (kept as is).

## 3. Existing code (starting point)

Repo `Schedule-app`, branch `Calender-dev`:

- `client/my_scheduler`: React 18 + TypeScript on Create React App; `App.tsx` renders a FullCalendar week view fed by `GET /api/events`, with `editable` and `selectable` on, no styling, no event creation UI.
- `server`: Express 5 + TypeScript + `pg`. `routes/events.ts` has only `GET /` and `POST /`.
- Known defects to fix: the INSERT uses a column named `end` (a reserved word in Postgres); there is no schema or migration file; there are no server tests; there are no PUT or DELETE routes.

## 4. Look and feel

Dark mode, minimalist, simple and self-evident over flashy. Every box (UI panels, events, day/week cells, dialogs) has rounded corners; no harsh edges. Purple and blue tones carry the UI and "seep into everything."

### 4.1 Tokens (Palette B, "Violet dusk")

| Token | Value | Use |
|---|---|---|
| background | `#14102A` | page |
| surface | `#1E1840` | panels, calendar body |
| raised | `#2A2258` | popovers, dialogs, inputs |
| purple | `#9B6BFF` | UI chrome, settings, selection |
| royal | `#4A63F0` | time blocks / default events |
| light blue | `#A8D4FF` | work-hours band (tint at ~14% alpha), secondary highlights |
| mint | `#4DF5C0` | primary actions (e.g. "Add event"), focus accents |
| coral | `#FF8A5B` | conflicts |
| text | `#EFEAFF` | body text (must meet WCAG AA on surfaces) |
| muted text | `#9D95C9` | secondary text, ignored states |

Final hex values may be adjusted by the Design agent for contrast, with owner approval at CP1.

### 4.2 System rules

- Font: **Inter** (owner may critique after CP1).
- One radius scale: ~12–16px for cards and events, pill shapes for buttons and chips.
- 8px spacing grid; generous whitespace.
- One line-icon set used consistently.
- Every interactive element has hover, selected, disabled, and visible keyboard-focus states.
- Motion is fast and subtle; `prefers-reduced-motion` is respected.
- All colors are CSS variables in a single `tokens.css`; no component hard-codes a color.
- Responsive from the start, desktop-first layouts.

### 4.3 Semantic colors

Each section has its own clear color: time-blocked events = royal blue; conflicts = coral; work hours = light-blue band; UI and settings = purple. Color is never the only signal: conflicts also carry a clock icon with "!".

**User event colors:** users may choose any color for an event except the exact reserved semantic values (coral `#FF8A5B`, the work-hours light blue, and the UI purple). A near-coral choice is allowed; the conflict badge, not the hue, is what marks a conflict.

## 5. Data model (Postgres, via SQL migrations)

All times are stored UTC (`timestamptz`) and displayed in the user's timezone.

### 5.1 Tables

- `users(id uuid pk, timezone text not null)`.
- `events(id uuid pk, user_id fk, title text not null, start_at timestamptz not null, end_at timestamptz not null, kind text check in ('event','time_block') default 'event', color text null, notes text null, source text not null default 'local', external_id text null, external_color text null, created_at, updated_at)`; constraint `end_at > start_at`.
- `work_hours(id, user_id, weekday smallint 0–6, start_time time, end_time time)`; constraint `end_time > start_time`.
- `conflict_zones(id, user_id, start_at, end_at, repeats_weekly boolean default false)`; constraint `end_at > start_at`.
- `conflict_ignores(id, user_id, event_a_id, event_b_id, mode text check in ('once','allow'), overlap_start timestamptz null, overlap_end timestamptz null)`; the pair is stored canonically (`event_a_id < event_b_id`) and unique per pair; cascade-deleted with either event.

`source`, `external_id`, and `external_color` are unused in A; they exist so the Google connector can tag imported events without a schema change.

### 5.2 Migrations

Plain numbered SQL files run by a small migration runner (the Backend agent picks the tool, e.g. `node-pg-migrate`, and records the choice in the plan). The existing `events` usage (`start`, `end`) is replaced by `start_at`, `end_at`.

### 5.3 Row Level Security

- RLS is enabled **and forced** (`ENABLE` + `FORCE ROW LEVEL SECURITY`) on every table that holds user data: `events`, `work_hours`, `conflict_zones`, `conflict_ignores`, and `users`.
- The server connects as a **non-owner role** (`app_user`) with only the privileges it needs; migrations run as the owner role.
- Each request runs in a transaction that sets `app.user_id` via `set_config('app.user_id', <id>, true)`; each table has a policy limiting rows to `user_id = current_setting('app.user_id')::uuid` (for `users`, `id = ...`).
- In A, the current user is a single fixed id from configuration; there is no login.
- Tests create two users and prove neither can read, update, or delete the other's rows, including through joins and the conflicts endpoint.
- RLS is defense in depth; API validation still enforces its own rules.

## 6. Conflict logic

Implemented as a **pure function** on the server (`detectConflicts(events, zones, ignores, timezone)`), unit tested, and exposed via the API. The AI in B will reuse it.

- Two events conflict if `a.start < b.end && b.start < a.end`. Touching end-to-start is not a conflict. The overlap interval is `[max(starts), min(ends))`.
- **Zone suppression:** a conflict is suppressed if its overlap interval lies entirely inside a conflict zone (weekly zones are expanded by weekday in the user's timezone).
- **Ignore once:** suppresses a pair only while its current overlap interval equals the stored `overlap_start`/`overlap_end`. If either event is moved or resized so the overlap changes, the conflict is raised again.
- **Allow overlap:** suppresses the pair permanently, regardless of later edits, until the owner removes the allowance.
- Suppressed-by-ignore and allowed pairs are returned in an `ignored` list so the UI can show them in a quiet style; zone-suppressed conflicts are not shown at all.
- Removing an ignore, an allowance, or a zone restores the conflict.

## 7. API (Express)

All routes run inside the per-request RLS transaction. Errors use one shape: `{ "error": { "code", "message", "details?" } }` with appropriate status codes. Input is validated (non-empty title, `end > start`, valid timestamps, valid color value not in the reserved set).

- `GET/POST /api/events`, `PUT/DELETE /api/events/:id`.
- `GET/PUT /api/work-hours` (replace the full set).
- `GET/POST /api/conflict-zones`, `DELETE /api/conflict-zones/:id`.
- `POST /api/conflict-ignores` (`{ eventAId, eventBId, mode }`), `DELETE /api/conflict-ignores/:id`.
- `GET /api/conflicts?from&to` returns `{ active: [...], ignored: [...] }` using the logic in section 6.

## 8. Client (React + TypeScript)

- `tokens.css`: all design tokens and the radius, spacing, type, and motion rules.
- `CalendarView`: FullCalendar (day/week/month) themed with the tokens, work hours as a light-blue background band, current-time indicator, today highlight.
- `EventDialog`: create, edit, and delete an event (title, start/end, kind, color, notes).
- **Drag to move and resize:** dragging an event moves it; dragging its top or bottom edge resizes it. Times snap to 15 minutes. The change saves immediately through `PUT`; on failure the event reverts and a toast explains. Conflicts are recalculated on drop so a new overlap shows its badge at once. On touch devices, press-and-hold starts a drag so scrolling still works.
- **Conflict states** (as approved in mockups): (1) active — coral outline with a "⏰! Conflict" badge; (2) ignored — quiet dashed outline with a muted "⏰ ignored" tag, still visible; (3) inside an unconflicted zone — light-blue "Work hours · conflicts off" band, no markers.
- **Conflict controls live on the calendar:** clicking a badge opens a popover naming the overlapping event with two actions, "Ignore this once" and "Allow overlap" (button labels may be refined at CP3). To create a zone, the user drags across a time range and a toolbar offers "Mark as unconflicted zone" (with a "repeat weekly" option).
- `SettingsPanel`: work hours per weekday, zone list (view/remove), allowed-overlap list (view/remove), color preferences.
- Errors: failed saves roll back and show a toast; the API error `message` is shown when safe.

## 9. Testing

- **Server:** Jest + supertest against a real test Postgres database (migrations applied, RLS active). Unit tests for `detectConflicts` (overlap, touching, zones, weekly zones, ignore-once invalidation, allow), route tests for every endpoint including validation errors, and RLS isolation tests for two users.
- **Client:** React Testing Library for `EventDialog`, the conflict badge and popover flow, zone creation, and drag/resize handlers (move, resize, 15-minute snapping, rollback on failed save).
- Accessibility check on contrast and keyboard focus at each checkpoint.
- A round does not count as complete unless the test suite passes and the app starts.

## 10. Milestones and checkpoints

The owner reviews only at these points, plus any hard stop.

- **CP1 — Design:** `tokens.css` and a styled static calendar (no live data) in Violet dusk: events, work-hours band, all three conflict states, mint "Add event" button, rounded shapes. The owner approves the look before any further UI work.
- **CP2 — Core calendar:** create, edit, delete, and drag-to-move/resize working end to end against the real database, with migrations, RLS, and tests passing.
- **CP3 — Conflicts and settings:** conflict detection, the badge popover, zones, work hours, and the settings panel.

After CP3, A is complete; the Google connector and B each start from their own spec.

## 11. Agent workflow (sub-project C)

### 11.1 Roster

| Role | Responsibility |
|---|---|
| **Orchestrator** (the main session) | Writes the plan, dispatches each round, runs gates, resolves disagreements, stops at checkpoints. Governed by the project `CLAUDE.md`. |
| **Design agent** | Owns tokens, mockups, and styling. *Written by the owner.* |
| **Backend agent** | Owns schema, migrations, RLS, routes, conflict function, server tests. |
| **Frontend agent** | Owns FullCalendar integration and all client components, built against the tokens. |
| **Spec reviewer** | Checks each round against this spec, runs the test suites, and flags gaps. |
| **UX reviewer** | Checks the UI against the look and feel in section 4 and the self-evident, uncluttered goal. *Written by the owner.* |

Agent definitions live in `.claude/agents/`. The owner writes the Design agent and UX reviewer (with coaching) and edits drafts of the other roles and the orchestrator's `CLAUDE.md`. Each definition states: role, what it owns, what it must not touch, inputs, report format, and when it must stop and ask.

### 11.2 Rounds

1. Implementer agents work in parallel, each in its own git worktree and branch, restricted to the files it owns.
2. Reviewer agents check the result: the spec reviewer for correctness and tests, the UX reviewer for the look.
3. The orchestrator resolves the flagged items (re-dispatching implementers as needed) and runs the round gate: tests pass and the app starts.
4. If no checkpoint or hard stop is reached, the next round begins; otherwise the orchestrator stops and reports.

### 11.3 Owner role and authority

The owner provides vision and taste, acceptance criteria, approvals at checkpoints, and decisions at hard stops, and tunes the agent instructions when a round goes badly. Agents may commit to their own branches. **Pushing to the remote, merging to the main line, installing new dependencies beyond those named in the plan, and any spending require owner approval.**

### 11.4 Hard stops

The orchestrator stops and asks the owner when: an agent is stuck after a bounded number of attempts (set in `CLAUDE.md`); two agents disagree and the orchestrator cannot resolve it against the spec; a change would alter this spec; or an action needs authority not yet granted.

## 12. Planned follow-ons (out of scope here)

- **Google Calendar connector** (own spec): off by default, read-only calendar permission, a per-calendar mapping to our event kinds, imported events styled with our colors, the original Google color kept as a small source marker, and disconnecting revokes access and deletes imported copies.
- **B — AI scheduler** (own spec): Claude with tools over the same API and conflict function; accept/reject decisions logged for a later local-model fine-tuning experiment; priority and learning-data columns are added by B's own migration.
- Light mode; an optional "use Google colors" toggle.

## 13. Assumptions to confirm during review

- Single fixed user in A (no login); multi-user readiness comes from the schema and RLS.
- Create React App stays.
- The migration tool and test-database setup are chosen by the Backend agent and recorded in the plan.
- Final hex values may shift slightly for contrast at CP1.
