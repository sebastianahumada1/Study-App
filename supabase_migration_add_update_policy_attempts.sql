-- Migration: Add UPDATE policy for attempts table
-- This allows users to update their own attempts (error_type, feedback, conclusion)

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Users can update own attempts" ON attempts;

-- Create UPDATE policy for attempts
CREATE POLICY "Users can update own attempts"
  ON attempts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

