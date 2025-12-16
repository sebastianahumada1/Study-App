-- Migration: Remove topics and subtopics tables dependencies
-- Execute this in Supabase SQL Editor to remove dependencies on topics/subtopics tables

-- 1. Add content column to study_route_items (for educational content)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'content'
  ) THEN
    ALTER TABLE study_route_items ADD COLUMN content TEXT;
    RAISE NOTICE 'Added content column to study_route_items';
  ELSE
    RAISE NOTICE 'Column content already exists in study_route_items';
  END IF;
END $$;

-- 2. Remove foreign key constraints from study_route_items
ALTER TABLE study_route_items 
DROP CONSTRAINT IF EXISTS study_route_items_topic_id_fkey;

ALTER TABLE study_route_items 
DROP CONSTRAINT IF EXISTS study_route_items_subtopic_id_fkey;

-- 3. Remove foreign key constraints from questions
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_topic_id_fkey;

ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_subtopic_id_fkey;

-- 4. Convert topic_id and subtopic_id in questions to TEXT (store names instead of UUIDs)
DO $$ 
BEGIN
  -- Convert topic_id to topic_name (TEXT)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'topic_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_name TEXT;
    -- Copy topic names if possible (before dropping)
    UPDATE questions q
    SET topic_name = t.name
    FROM topics t
    WHERE q.topic_id = t.id AND q.topic_id IS NOT NULL;
    
    ALTER TABLE questions DROP COLUMN topic_id;
    RAISE NOTICE 'Converted topic_id to topic_name in questions';
  END IF;
  
  -- Convert subtopic_id to subtopic_name (TEXT)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'subtopic_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS subtopic_name TEXT;
    -- Copy subtopic names if possible (before dropping)
    UPDATE questions q
    SET subtopic_name = s.name
    FROM subtopics s
    WHERE q.subtopic_id = s.id AND q.subtopic_id IS NOT NULL;
    
    ALTER TABLE questions DROP COLUMN subtopic_id;
    RAISE NOTICE 'Converted subtopic_id to subtopic_name in questions';
  END IF;
END $$;

-- 5. Remove topic_id and subtopic_id columns from study_route_items (we'll use custom_name and content instead)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'topic_id'
  ) THEN
    ALTER TABLE study_route_items DROP COLUMN topic_id;
    RAISE NOTICE 'Removed topic_id column from study_route_items';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'subtopic_id'
  ) THEN
    ALTER TABLE study_route_items DROP COLUMN subtopic_id;
    RAISE NOTICE 'Removed subtopic_id column from study_route_items';
  END IF;
END $$;

-- 6. Drop indexes related to topics/subtopics
DROP INDEX IF EXISTS idx_subtopics_topic_id;
DROP INDEX IF EXISTS idx_subtopics_user_id;
DROP INDEX IF EXISTS idx_topics_user_id;
DROP INDEX IF EXISTS idx_questions_topic_id;
DROP INDEX IF EXISTS idx_questions_subtopic_id;

-- 7. Drop RLS policies for topics/subtopics (if they exist)
DROP POLICY IF EXISTS "Topics users can manage own" ON topics;
DROP POLICY IF EXISTS "Subtopics users can manage own" ON subtopics;

-- 8. Finally, drop the tables (WARNING: This will delete all data in these tables)
-- Uncomment the following lines if you want to drop the tables:
-- DROP TABLE IF EXISTS subtopics CASCADE;
-- DROP TABLE IF EXISTS topics CASCADE;

-- Verify changes
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('study_route_items', 'questions')
  AND column_name IN ('content', 'topic_name', 'subtopic_name', 'topic_id', 'subtopic_id')
ORDER BY table_name, column_name;

