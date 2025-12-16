-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_name TEXT,
  subtopic_name TEXT,
  prompt TEXT NOT NULL,
  answer_key TEXT NOT NULL,
  explanation TEXT,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attempts table
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  user_answer TEXT NOT NULL,
  source TEXT DEFAULT 'simulacro',
  session_id UUID,
  time_spent INTEGER,
  especialidad TEXT,
  error_type TEXT,
  feedback TEXT,
  conclusion TEXT,
  añadido_en_diagrama BOOLEAN DEFAULT FALSE,
  imagenes_historias_listas BOOLEAN DEFAULT FALSE,
  reglas_listas BOOLEAN DEFAULT FALSE,
  modelo_mental_1_listo BOOLEAN DEFAULT FALSE,
  modelo_mental_2_listo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to attempts if they don't exist (for migrations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'especialidad'
  ) THEN
    ALTER TABLE attempts ADD COLUMN especialidad TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'error_type'
  ) THEN
    ALTER TABLE attempts ADD COLUMN error_type TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'feedback'
  ) THEN
    ALTER TABLE attempts ADD COLUMN feedback TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'conclusion'
  ) THEN
    ALTER TABLE attempts ADD COLUMN conclusion TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'añadido_en_diagrama'
  ) THEN
    ALTER TABLE attempts ADD COLUMN añadido_en_diagrama BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'imagenes_historias_listas'
  ) THEN
    ALTER TABLE attempts ADD COLUMN imagenes_historias_listas BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'reglas_listas'
  ) THEN
    ALTER TABLE attempts ADD COLUMN reglas_listas BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'modelo_mental_1_listo'
  ) THEN
    ALTER TABLE attempts ADD COLUMN modelo_mental_1_listo BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'modelo_mental_2_listo'
  ) THEN
    ALTER TABLE attempts ADD COLUMN modelo_mental_2_listo BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'source'
  ) THEN
    ALTER TABLE attempts ADD COLUMN source TEXT DEFAULT 'simulacro';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE attempts ADD COLUMN session_id UUID;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attempts' AND column_name = 'time_spent'
  ) THEN
    ALTER TABLE attempts ADD COLUMN time_spent INTEGER;
  END IF;
  
  -- Add options column to questions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'options'
  ) THEN
    ALTER TABLE questions ADD COLUMN options JSONB;
  END IF;
  
  -- Add topic_name and subtopic_name to questions if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'topic_name'
  ) THEN
    ALTER TABLE questions ADD COLUMN topic_name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' AND column_name = 'subtopic_name'
  ) THEN
    ALTER TABLE questions ADD COLUMN subtopic_name TEXT;
  END IF;
END $$;

-- Study Routes tables
-- Feynman Reasonings table
CREATE TABLE IF NOT EXISTS feynman_reasonings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  user_reasoning TEXT NOT NULL,
  ai_feedback TEXT,
  technique_1_feedback TEXT,
  technique_2_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_route_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES study_routes(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES study_route_items(id) ON DELETE CASCADE,
  item_type TEXT DEFAULT 'topic' CHECK (item_type IN ('topic', 'subtopic')),
  custom_name TEXT,
  content TEXT,
  estimated_time INTEGER NOT NULL DEFAULT 60,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  difficulty TEXT DEFAULT 'media' CHECK (difficulty IN ('baja', 'media', 'alta')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_planner (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES study_routes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES study_route_items(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  order_index INTEGER NOT NULL DEFAULT 0,
  scheduled_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to study_route_items if they don't exist (for migrations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE study_route_items ADD COLUMN parent_id UUID REFERENCES study_route_items(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_study_route_items_parent_id ON study_route_items(parent_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE study_route_items ADD COLUMN item_type TEXT DEFAULT 'topic' CHECK (item_type IN ('topic', 'subtopic'));
    CREATE INDEX IF NOT EXISTS idx_study_route_items_type ON study_route_items(item_type);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'content'
  ) THEN
    ALTER TABLE study_route_items ADD COLUMN content TEXT;
  END IF;
  
  -- Remove topic_id and subtopic_id if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'topic_id'
  ) THEN
    ALTER TABLE study_route_items DROP CONSTRAINT IF EXISTS study_route_items_topic_id_fkey;
    ALTER TABLE study_route_items DROP COLUMN topic_id;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_route_items' AND column_name = 'subtopic_id'
  ) THEN
    ALTER TABLE study_route_items DROP CONSTRAINT IF EXISTS study_route_items_subtopic_id_fkey;
    ALTER TABLE study_route_items DROP COLUMN subtopic_id;
  END IF;
  
  -- Update item_type constraint if it includes 'class'
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'study_route_items_item_type_check'
  ) THEN
    ALTER TABLE study_route_items DROP CONSTRAINT study_route_items_item_type_check;
    ALTER TABLE study_route_items ADD CONSTRAINT study_route_items_item_type_check 
      CHECK (item_type IN ('topic', 'subtopic'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_topic_name ON questions(topic_name);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic_name ON questions(subtopic_name);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_source ON attempts(source);
CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_feynman_reasonings_attempt_id ON feynman_reasonings(attempt_id);
CREATE INDEX IF NOT EXISTS idx_study_routes_user_id ON study_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_study_route_items_route_id ON study_route_items(route_id);
CREATE INDEX IF NOT EXISTS idx_study_route_items_parent_id ON study_route_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_study_route_items_type ON study_route_items(item_type);
CREATE INDEX IF NOT EXISTS idx_study_planner_route_id ON study_planner(route_id);
CREATE INDEX IF NOT EXISTS idx_study_planner_item_id ON study_planner(item_id);
CREATE INDEX IF NOT EXISTS idx_study_planner_day ON study_planner(day_of_week);

-- Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feynman_reasonings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_route_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_planner ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Questions are viewable by everyone" ON questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can update questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON questions;
DROP POLICY IF EXISTS "Users can view own attempts" ON attempts;
DROP POLICY IF EXISTS "Users can view own feynman reasonings" ON feynman_reasonings;
DROP POLICY IF EXISTS "Users can insert own feynman reasonings" ON feynman_reasonings;
DROP POLICY IF EXISTS "Users can update own feynman reasonings" ON feynman_reasonings;
DROP POLICY IF EXISTS "Users can insert own attempts" ON attempts;
DROP POLICY IF EXISTS "Users can manage own study routes" ON study_routes;
DROP POLICY IF EXISTS "Users can manage own route items" ON study_route_items;
DROP POLICY IF EXISTS "Users can manage own planner" ON study_planner;

-- Questions: Public read access, authenticated users can manage
CREATE POLICY "Questions are viewable by everyone"
  ON questions FOR SELECT
  USING (true);

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

-- Attempts: Users can only see their own attempts
CREATE POLICY "Users can view own attempts"
  ON attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Feynman Reasonings: Users can only view/manage their own reasonings
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

-- Study Routes: Users can only manage their own routes
CREATE POLICY "Users can manage own study routes"
  ON study_routes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Study Route Items: Users can only manage items from their routes
CREATE POLICY "Users can manage own route items"
  ON study_route_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_routes 
      WHERE study_routes.id = study_route_items.route_id 
      AND study_routes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_routes 
      WHERE study_routes.id = study_route_items.route_id 
      AND study_routes.user_id = auth.uid()
    )
  );

-- Study Planner: Users can only manage their own planner
CREATE POLICY "Users can manage own planner"
  ON study_planner FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_routes 
      WHERE study_routes.id = study_planner.route_id 
      AND study_routes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_routes 
      WHERE study_routes.id = study_planner.route_id 
      AND study_routes.user_id = auth.uid()
    )
  );

-- Supabase Storage Configuration for Study Content
-- Note: The bucket 'study-content' must be created manually in Supabase Dashboard:
-- Storage > New Bucket > Name: study-content > Public: Yes (or configure as needed)

-- Storage Policies for study-content bucket
-- Users can only upload/read/delete files in their own folder: {userId}/

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
