-- PostgreSQL schema for durable home and Supercharger session records.
-- Apply only after provisioning a database and configuring server-side access.
CREATE TABLE IF NOT EXISTS charging_sessions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  vehicle_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('home', 'supercharger')),
  external_session_id text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  energy_kwh numeric(12,3) CHECK (energy_kwh >= 0),
  cost_amount numeric(12,2) CHECK (cost_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'MXN',
  cost_is_estimate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, external_session_id)
);
CREATE INDEX IF NOT EXISTS charging_sessions_user_started_idx ON charging_sessions(user_id, started_at DESC);
-- Never expose this table directly to browsers; enforce authenticated user isolation in the API.
