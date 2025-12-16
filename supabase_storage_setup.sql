-- Supabase Storage Setup for Study Content Editor
-- Execute this script in Supabase SQL Editor after creating the bucket

-- Storage Policies for study-content bucket
-- Users can only upload/read/delete files in their own folder: {userId}/

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own study content" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own study content" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own study content" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own study content" ON storage.objects;

-- Allow users to SELECT (read) files in their own folder
CREATE POLICY "Users can view own study content"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-content' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to INSERT (upload) files in their own folder
CREATE POLICY "Users can upload own study content"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-content' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to UPDATE (modify) files in their own folder
CREATE POLICY "Users can update own study content"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'study-content' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'study-content' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to DELETE files in their own folder
CREATE POLICY "Users can delete own study content"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-content' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

