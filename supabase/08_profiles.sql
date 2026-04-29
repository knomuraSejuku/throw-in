-- Add display_name and avatar_emoji to users table for global search profiles
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT '🙂';

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow anyone (including anonymous) to read display_name and avatar_emoji for global search
CREATE POLICY "Public can read user profiles"
  ON public.users
  FOR SELECT
  USING (true);
