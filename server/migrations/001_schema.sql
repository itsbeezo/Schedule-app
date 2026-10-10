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
