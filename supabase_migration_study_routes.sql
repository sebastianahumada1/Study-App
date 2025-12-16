-- Migration: Add Study Routes tables and update existing tables
-- Execute this in Supabase SQL Editor if you get "Could not find table 'study_routes'" error

-- Add columns to topics if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'topics' AND column_name = 'is_user_created'
  ) THEN
    ALTER TABLE topics ADD COLUMN is_user_created BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'topics' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE topics ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add columns to subtopics if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subtopics' AND column_name = 'is_user_created'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN is_user_created BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subtopics' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique indexes for topics
DROP INDEX IF EXISTS idx_topics_default_unique;
DROP INDEX IF EXISTS idx_topics_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_default_unique ON topics(name) WHERE is_user_created = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_user_unique ON topics(name, user_id) WHERE is_user_created = true;

-- Create unique indexes for subtopics
DROP INDEX IF EXISTS idx_subtopics_default_unique;
DROP INDEX IF EXISTS idx_subtopics_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subtopics_default_unique ON subtopics(topic_id, name) WHERE is_user_created = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subtopics_user_unique ON subtopics(topic_id, name, user_id) WHERE is_user_created = true;

-- Study Routes tables
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
  item_type TEXT DEFAULT 'class' CHECK (item_type IN ('topic', 'subtopic', 'class')),
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  subtopic_id UUID REFERENCES subtopics(id) ON DELETE SET NULL,
  custom_name TEXT,
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

-- Indexes for study routes
CREATE INDEX IF NOT EXISTS idx_study_routes_user_id ON study_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_study_route_items_route_id ON study_route_items(route_id);
CREATE INDEX IF NOT EXISTS idx_study_route_items_parent_id ON study_route_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_study_route_items_type ON study_route_items(item_type);
CREATE INDEX IF NOT EXISTS idx_study_planner_route_id ON study_planner(route_id);
CREATE INDEX IF NOT EXISTS idx_study_planner_item_id ON study_planner(item_id);
CREATE INDEX IF NOT EXISTS idx_study_planner_day ON study_planner(day_of_week);

-- Add columns to existing study_route_items if they don't exist
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
    ALTER TABLE study_route_items ADD COLUMN item_type TEXT DEFAULT 'class' CHECK (item_type IN ('topic', 'subtopic', 'class'));
    CREATE INDEX IF NOT EXISTS idx_study_route_items_type ON study_route_items(item_type);
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE study_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_route_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_planner ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own study routes" ON study_routes;
DROP POLICY IF EXISTS "Users can manage own route items" ON study_route_items;
DROP POLICY IF EXISTS "Users can manage own planner" ON study_planner;
DROP POLICY IF EXISTS "Topics users can manage own" ON topics;
DROP POLICY IF EXISTS "Subtopics users can manage own" ON subtopics;

-- Topics: Users can manage their own
CREATE POLICY "Topics users can manage own"
  ON topics FOR ALL
  USING (
    (is_user_created = false) OR 
    (is_user_created = true AND auth.uid() = user_id)
  )
  WITH CHECK (
    (is_user_created = false) OR 
    (is_user_created = true AND auth.uid() = user_id)
  );

-- Subtopics: Users can manage their own
CREATE POLICY "Subtopics users can manage own"
  ON subtopics FOR ALL
  USING (
    (is_user_created = false) OR 
    (is_user_created = true AND auth.uid() = user_id)
  )
  WITH CHECK (
    (is_user_created = false) OR 
    (is_user_created = true AND auth.uid() = user_id)
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

