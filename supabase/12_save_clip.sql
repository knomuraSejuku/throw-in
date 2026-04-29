-- C4: 他ユーザーのクリップを自分のライブラリに保存する機能
ALTER TABLE clips ADD COLUMN IF NOT EXISTS saved_from_clip_id uuid REFERENCES clips(id) ON DELETE SET NULL;
