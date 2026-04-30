-- Add notification_prefs column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "follow": true,
    "comment_reply": true,
    "like": true,
    "announcement": true
  }'::jsonb;
