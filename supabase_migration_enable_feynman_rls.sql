-- Migration: Enable RLS on feynman_reasonings table
-- Run this in Supabase SQL Editor if the table already exists

-- Enable RLS on feynman_reasonings table
ALTER TABLE feynman_reasonings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make script idempotent)
DROP POLICY IF EXISTS "Users can view own feynman reasonings" ON feynman_reasonings;
DROP POLICY IF EXISTS "Users can insert own feynman reasonings" ON feynman_reasonings;
DROP POLICY IF EXISTS "Users can update own feynman reasonings" ON feynman_reasonings;

-- Create RLS policies for feynman_reasonings
CREATE POLICY "Users can view own feynman reasonings"
  ON feynman_reasonings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attempts 
      WHERE attempts.id = feynman_reasonings.attempt_id 
      AND attempts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own feynman reasonings"
  ON feynman_reasonings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attempts 
      WHERE attempts.id = feynman_reasonings.attempt_id 
      AND attempts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own feynman reasonings"
  ON feynman_reasonings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM attempts 
      WHERE attempts.id = feynman_reasonings.attempt_id 
      AND attempts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attempts 
      WHERE attempts.id = feynman_reasonings.attempt_id 
      AND attempts.user_id = auth.uid()
    )
  );

