-- Track AI-organized versions of shared clips.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users ON DELETE CASCADE NOT NULL,
  clip_id uuid REFERENCES public.clips ON DELETE CASCADE,
  action text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'succeeded',
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON public.ai_usage_events(user_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "自分のAI使用履歴のみ参照可能" ON public.ai_usage_events;
CREATE POLICY "自分のAI使用履歴のみ参照可能" ON public.ai_usage_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.clip_versions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  clip_id uuid REFERENCES public.clips ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  source_url text,
  source_hash text,
  title text NOT NULL,
  summary text,
  extracted_content text,
  tags jsonb DEFAULT '[]'::jsonb NOT NULL,
  category text,
  subcategory text,
  key_points text,
  created_by uuid REFERENCES public.users ON DELETE SET NULL,
  created_reason text NOT NULL DEFAULT 'initial',
  ai_model text,
  ai_usage_event_id uuid REFERENCES public.ai_usage_events ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (clip_id, version_number)
);

CREATE INDEX IF NOT EXISTS clip_versions_clip_created_idx
  ON public.clip_versions(clip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clip_versions_clip_hash_idx
  ON public.clip_versions(clip_id, source_hash)
  WHERE source_hash IS NOT NULL;

ALTER TABLE public.clip_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "保存または公開クリップのバージョン参照可能" ON public.clip_versions;
CREATE POLICY "保存または公開クリップのバージョン参照可能" ON public.clip_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clips c
      WHERE c.id = clip_versions.clip_id
        AND (
          c.is_global_search = true
          OR c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.clip_saves s
            WHERE s.clip_id = c.id
              AND s.user_id = auth.uid()
          )
        )
    )
  );

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES public.clip_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamp with time zone;

INSERT INTO public.clip_versions (
  clip_id,
  version_number,
  source_url,
  source_hash,
  title,
  summary,
  extracted_content,
  tags,
  category,
  subcategory,
  key_points,
  created_by,
  created_reason,
  created_at
)
SELECT
  c.id,
  1,
  c.url,
  md5(coalesce(c.extracted_content, '') || '|' || coalesce(c.summary, '') || '|' || c.title),
  c.title,
  c.summary,
  c.extracted_content,
  coalesce(
    (
      SELECT jsonb_agg(DISTINCT t.name)
      FROM public.clip_tags t
      WHERE t.clip_id = c.id
    ),
    '[]'::jsonb
  ),
  c.category,
  c.subcategory,
  c.key_points,
  c.user_id,
  'initial',
  c.created_at
FROM public.clips c
WHERE NOT EXISTS (
  SELECT 1 FROM public.clip_versions v WHERE v.clip_id = c.id
);

UPDATE public.clips c
SET current_version_id = v.id
FROM public.clip_versions v
WHERE v.clip_id = c.id
  AND v.version_number = 1
  AND c.current_version_id IS NULL;
