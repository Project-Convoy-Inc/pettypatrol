-- Supabase Table Setup for Petty Patrol
-- Run this SQL in your Supabase SQL Editor

-- Table for reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  plate_text TEXT NOT NULL,
  behaviors TEXT[] NOT NULL,
  custom_note TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for badge unlocks
CREATE TABLE IF NOT EXISTS badges (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for deal claims
CREATE TABLE IF NOT EXISTS deals (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  offer TEXT NOT NULL,
  qr_code_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - allows anonymous inserts
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (for unauthenticated users)
CREATE POLICY IF NOT EXISTS "Allow anonymous inserts on reports" ON reports
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow anonymous inserts on badges" ON badges
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow anonymous inserts on deals" ON deals
  FOR INSERT TO anon
  WITH CHECK (true);

-- Optional: Allow service role to read all data (for your admin queries)
CREATE POLICY IF NOT EXISTS "Allow service role read on reports" ON reports
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow service role read on badges" ON badges
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow service role read on deals" ON deals
  FOR SELECT TO service_role
  USING (true);

