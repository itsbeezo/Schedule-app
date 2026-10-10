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
