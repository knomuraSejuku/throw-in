-- Moderation controls for public clips.

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false NOT NULL;

UPDATE public.clips
SET is_hidden = false
WHERE is_hidden IS NULL;

CREATE INDEX IF NOT EXISTS clips_public_visible_idx
  ON public.clips(is_global_search, is_hidden, created_at DESC);

DROP POLICY IF EXISTS "Public global search clips" ON public.clips;
CREATE POLICY "Public global search clips" ON public.clips
  FOR SELECT
  USING (is_global_search = true AND is_hidden = false AND auth.uid() IS NULL);
