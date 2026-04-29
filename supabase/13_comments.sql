-- F4: グローバルコメント機能
CREATE TABLE IF NOT EXISTS clip_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clip_id    uuid REFERENCES clips(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  parent_id  uuid REFERENCES clip_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comment_likes (
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES clip_comments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL,
  data       jsonb,
  read       bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE clip_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- clip_comments: anyone can read comments on public clips; authed users can insert their own; delete own
CREATE POLICY "read comments on public clips" ON clip_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM clips WHERE id = clip_id AND is_public = true));

CREATE POLICY "insert own comment" ON clip_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own comment" ON clip_comments FOR DELETE
  USING (auth.uid() = user_id);

-- comment_likes: authed users manage their own
CREATE POLICY "read likes" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "insert own like" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own like" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- notifications: only recipient can read/update their own
CREATE POLICY "own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Index for fast per-clip comment lookup
CREATE INDEX IF NOT EXISTS idx_clip_comments_clip_id ON clip_comments(clip_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read, created_at DESC);
