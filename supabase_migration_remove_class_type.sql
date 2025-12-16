-- Migration: Remove 'class' item_type from study_route_items
-- Execute this in Supabase SQL Editor to update the CHECK constraint

-- Drop existing constraint
ALTER TABLE study_route_items 
DROP CONSTRAINT IF EXISTS study_route_items_item_type_check;

-- Add new constraint without 'class'
ALTER TABLE study_route_items 
ADD CONSTRAINT study_route_items_item_type_check 
CHECK (item_type IN ('topic', 'subtopic'));

-- Update any existing 'class' items to 'subtopic' (optional - only if you have existing data)
-- UPDATE study_route_items 
-- SET item_type = 'subtopic' 
-- WHERE item_type = 'class';

SELECT 'Migration completed: item_type now only allows ''topic'' and ''subtopic''.' AS status;

