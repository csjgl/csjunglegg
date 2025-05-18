-- Provably fair seed table for all games
CREATE TABLE IF NOT EXISTS provablyfairseed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  createdat timestamptz NOT NULL DEFAULT now(),
  revealedat timestamptz,
  serverseed text NOT NULL, -- revealed after N rounds
  serverseedhash text NOT NULL, -- sha256(serverseed)
  active boolean NOT NULL DEFAULT true
);

-- Add client seed to user (optional, for user-chosen seeds)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user') THEN
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS clientseed text;
  END IF;
END $$;

-- Add provably fair fields to roulette game table
ALTER TABLE roulettedoublegame ADD COLUMN IF NOT EXISTS serverseedid uuid;
ALTER TABLE roulettedoublegame ADD COLUMN IF NOT EXISTS clientseed text;
ALTER TABLE roulettedoublegame ADD COLUMN IF NOT EXISTS nonce integer;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_roulette_serverseedid ON roulettedoublegame(serverseedid);
