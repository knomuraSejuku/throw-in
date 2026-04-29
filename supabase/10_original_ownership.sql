-- original_clip_id: points to the first user who clipped this URL.
-- NULL means this IS the original. Non-null means a duplicate copy.
ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS original_clip_id uuid REFERENCES clips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clips_original_clip_id_idx ON clips(original_clip_id);
CREATE INDEX IF NOT EXISTS clips_url_original_idx ON clips(url) WHERE original_clip_id IS NULL;
