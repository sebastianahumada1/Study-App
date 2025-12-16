-- Migration: Add RLS policies for INSERT, UPDATE, DELETE on questions table
-- Execute this in Supabase SQL Editor to fix "new row violates row-level security policy" error

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can update questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON questions;

-- Questions: Allow authenticated users to insert, update, and delete
CREATE POLICY "Authenticated users can insert questions"
  ON questions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update questions"
  ON questions FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete questions"
  ON questions FOR DELETE
  USING (auth.role() = 'authenticated');

