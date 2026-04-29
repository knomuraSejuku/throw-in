-- Fix: is_global_search policy was ORed with user's own policy,
-- causing authenticated users to see all global clips.
-- Restrict global search visibility to anonymous (unauthenticated) users only.

DROP POLICY IF EXISTS "Public global search clips" ON clips;

CREATE POLICY "Public global search clips" ON clips
  FOR SELECT
  USING (is_global_search = true AND auth.uid() IS NULL);
