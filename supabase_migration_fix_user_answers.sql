-- Migration script to fix user_answer format in attempts table
-- This converts user_answer from full option text to letter format (A, B, C, D)

-- Function to convert option text to letter
CREATE OR REPLACE FUNCTION get_option_letter(option_text TEXT, options_array JSONB)
RETURNS TEXT AS $$
DECLARE
  option_index INTEGER;
  letter CHAR(1);
BEGIN
  -- Check if option_text is already a single letter (A-D)
  IF LENGTH(TRIM(option_text)) = 1 AND option_text ~ '^[A-Da-d]$' THEN
    RETURN UPPER(option_text);
  END IF;
  
  -- Find the index of the option in the array
  SELECT INTO option_index
    array_position(
      ARRAY(
        SELECT jsonb_array_elements_text(options_array)
      ),
      option_text
    );
  
  -- If found, convert index to letter (0-based to letter: 0=A, 1=B, 2=C, 3=D)
  IF option_index IS NOT NULL THEN
    letter := CHR(64 + option_index); -- 65 is 'A', so 64 + index gives us the letter
    RETURN letter;
  END IF;
  
  -- If not found, return original (shouldn't happen, but safe fallback)
  RETURN option_text;
END;
$$ LANGUAGE plpgsql;

-- Update attempts where user_answer is not a single letter
-- This will convert the full option text to the corresponding letter
DO $$
DECLARE
  attempt_record RECORD;
  corrected_answer TEXT;
  correct_letter TEXT;
  new_is_correct BOOLEAN;
  updated_count INTEGER := 0;
BEGIN
  -- Loop through attempts where user_answer is not a single letter
  FOR attempt_record IN
    SELECT 
      a.id,
      a.user_answer,
      a.is_correct,
      a.question_id,
      q.answer_key,
      q.options
    FROM attempts a
    JOIN questions q ON a.question_id = q.id
    WHERE LENGTH(TRIM(a.user_answer)) > 1  -- Not a single letter
       OR a.user_answer !~ '^[A-Da-d]$'     -- Not A, B, C, or D
  LOOP
    -- Get the letter corresponding to the user's answer text
    corrected_answer := get_option_letter(attempt_record.user_answer, attempt_record.options);
    
    -- Get the correct answer letter (normalize to uppercase)
    correct_letter := UPPER(TRIM(attempt_record.answer_key));
    
    -- Determine if the answer is correct
    new_is_correct := UPPER(TRIM(corrected_answer)) = correct_letter;
    
    -- Update the attempt
    UPDATE attempts
    SET 
      user_answer = corrected_answer,
      is_correct = new_is_correct
    WHERE id = attempt_record.id;
    
    updated_count := updated_count + 1;
    
    -- Log progress (optional, can be removed)
    RAISE NOTICE 'Updated attempt %: % -> % (correct: %)', 
      attempt_record.id, 
      attempt_record.user_answer, 
      corrected_answer, 
      new_is_correct;
  END LOOP;
  
  RAISE NOTICE 'Total attempts updated: %', updated_count;
END $$;

-- Drop the helper function after migration
DROP FUNCTION IF EXISTS get_option_letter(TEXT, JSONB);

