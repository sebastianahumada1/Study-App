-- Migration: Set error_type = 'No Aplica' for all correct attempts
-- This ensures that all correct attempts have error_type set to "No Aplica"

-- Update all attempts where is_correct = true and error_type is NULL or empty
UPDATE attempts
SET error_type = 'No Aplica'
WHERE is_correct = true
  AND (error_type IS NULL OR error_type = '' OR error_type != 'No Aplica');

-- Log the number of updated rows
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Total correct attempts updated with "No Aplica": %', updated_count;
END $$;

