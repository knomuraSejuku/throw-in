-- User reports for moderation.

CREATE TABLE IF NOT EXISTS public.clip_reports (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  clip_id uuid REFERENCES public.clips ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users ON DELETE SET NULL,
  reason text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS clip_reports_status_created_idx
  ON public.clip_reports(status, created_at DESC);

DROP TRIGGER IF EXISTS set_clip_reports_updated_at ON public.clip_reports;
CREATE TRIGGER set_clip_reports_updated_at
  BEFORE UPDATE ON public.clip_reports
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.clip_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "自分の通報のみ作成可能" ON public.clip_reports;
CREATE POLICY "自分の通報のみ作成可能" ON public.clip_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "自分の通報のみ参照可能" ON public.clip_reports;
CREATE POLICY "自分の通報のみ参照可能" ON public.clip_reports
  FOR SELECT USING (auth.uid() = user_id);
