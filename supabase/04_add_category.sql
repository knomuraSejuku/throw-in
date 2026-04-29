ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS subcategory text;

CREATE INDEX IF NOT EXISTS clips_category_idx ON clips (user_id, category);
