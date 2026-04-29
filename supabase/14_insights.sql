-- insights: AI generated columns from global public clips
CREATE TABLE IF NOT EXISTS insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text NOT NULL,
  type         text NOT NULL DEFAULT 'column', -- 'column' | 'weekly' | 'category'
  category     text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insights_generated_at_idx ON insights(generated_at DESC);

-- Public read access, no RLS needed (global content)
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights_public_read" ON insights FOR SELECT USING (true);
-- Only service role can insert (via API with service key or anon with function)
-- For now allow anon insert (will be protected by API key check in route)
CREATE POLICY "insights_anon_insert" ON insights FOR INSERT WITH CHECK (true);
