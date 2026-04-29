-- Add global search flag to clips
ALTER TABLE clips ADD COLUMN IF NOT EXISTS is_global_search BOOLEAN NOT NULL DEFAULT false;

-- Allow anyone (including unauthenticated) to read globally shared clips
CREATE POLICY "Public global search clips" ON clips
  FOR SELECT
  USING (is_global_search = true);
