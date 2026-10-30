-- A confirmed home observation is not a completed charging session.
-- Never infer historical charging sessions from a single charge_state snapshot.
CREATE TABLE IF NOT EXISTS electricity_home_observations (
  vehicle_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  charging_state text NOT NULL,
  energy_added_kwh numeric(12,3) NOT NULL CHECK (energy_added_kwh >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, observed_at)
);
CREATE INDEX IF NOT EXISTS electricity_home_observations_recent
  ON electricity_home_observations (vehicle_id, observed_at DESC);
