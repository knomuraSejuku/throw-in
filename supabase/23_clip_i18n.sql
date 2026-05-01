-- Add English AI metadata alongside the existing Japanese/default metadata.
-- Existing title/summary/category/subcategory/key_points and clip_tags remain the
-- Japanese/default representation for backward compatibility.

ALTER TABLE public.clips
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS summary_en text,
  ADD COLUMN IF NOT EXISTS category_en text,
  ADD COLUMN IF NOT EXISTS subcategory_en text,
  ADD COLUMN IF NOT EXISTS key_points_en text,
  ADD COLUMN IF NOT EXISTS tags_en jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE public.clip_versions
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS summary_en text,
  ADD COLUMN IF NOT EXISTS tags_en jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS category_en text,
  ADD COLUMN IF NOT EXISTS subcategory_en text,
  ADD COLUMN IF NOT EXISTS key_points_en text;
