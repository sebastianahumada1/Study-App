-- Migration: Add hierarchical structure columns to study_route_items
-- Execute this in Supabase SQL Editor if you get "Could not find the 'item_type' column" error

-- Add parent_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE study_route_items 
    ADD COLUMN parent_id UUID REFERENCES study_route_items(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_study_route_items_parent_id 
    ON study_route_items(parent_id);
    
    RAISE NOTICE 'Added parent_id column to study_route_items';
  ELSE
    RAISE NOTICE 'Column parent_id already exists';
  END IF;
END $$;

-- Add item_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE study_route_items 
    ADD COLUMN item_type TEXT DEFAULT 'class' 
    CHECK (item_type IN ('topic', 'subtopic', 'class'));
    
    CREATE INDEX IF NOT EXISTS idx_study_route_items_type 
    ON study_route_items(item_type);
    
    -- Update existing rows to have a default item_type
    UPDATE study_route_items 
    SET item_type = 'class' 
    WHERE item_type IS NULL;
    
    RAISE NOTICE 'Added item_type column to study_route_items';
  ELSE
    RAISE NOTICE 'Column item_type already exists';
  END IF;
END $$;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'study_route_items' 
  AND column_name IN ('parent_id', 'item_type')
ORDER BY column_name;

