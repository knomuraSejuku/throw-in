-- Add key_points column to clips table for AI-generated structured breakdown
ALTER TABLE clips ADD COLUMN IF NOT EXISTS key_points TEXT;
