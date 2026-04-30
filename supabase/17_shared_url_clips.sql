-- K: Share URL clips by normalized URL instead of copying clip bodies per user.

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS normalized_url text;

UPDATE public.clips
SET normalized_url = url
WHERE normalized_url IS NULL
  AND content_type IN ('article', 'video')
  AND url IS NOT NULL
  AND url <> '';

CREATE INDEX IF NOT EXISTS clips_normalized_url_idx
  ON public.clips(normalized_url)
  WHERE content_type IN ('article', 'video') AND normalized_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.clip_saves (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  clip_id uuid REFERENCES public.clips ON DELETE CASCADE NOT NULL,
  my_note text,
  is_bookmarked boolean DEFAULT false NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, clip_id)
);

ALTER TABLE public.clip_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "自分の保存状態のみ操作可能" ON public.clip_saves;
CREATE POLICY "自分の保存状態のみ操作可能" ON public.clip_saves
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_clip_saves_updated_at ON public.clip_saves;
CREATE TRIGGER set_clip_saves_updated_at
  BEFORE UPDATE ON public.clip_saves
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.clip_saves (user_id, clip_id, my_note, is_bookmarked, is_read, is_archived, created_at, updated_at)
SELECT user_id, id, my_note, COALESCE(is_bookmarked, false), COALESCE(is_read, false), COALESCE(is_archived, false), created_at, updated_at
FROM public.clips
ON CONFLICT (user_id, clip_id) DO NOTHING;

DROP POLICY IF EXISTS "Saved clips are visible to saver" ON public.clips;
CREATE POLICY "Saved clips are visible to saver" ON public.clips
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clip_saves s
      WHERE s.clip_id = clips.id
        AND s.user_id = auth.uid()
    )
  );
