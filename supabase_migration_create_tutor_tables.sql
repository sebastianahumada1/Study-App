-- Migration: Create tutor_sessions and tutor_messages tables
-- This migration creates the tables needed for the Tutor module

-- Tutor Sessions Table
CREATE TABLE IF NOT EXISTS tutor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID REFERENCES study_routes(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES study_route_items(id) ON DELETE SET NULL,
  subtopic_id UUID REFERENCES study_route_items(id) ON DELETE SET NULL,
  tutor_role TEXT NOT NULL,
  user_role TEXT NOT NULL,
  context TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed')),
  anchor_recommendation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tutor Messages Table
CREATE TABLE IF NOT EXISTS tutor_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tutor tables
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_id ON tutor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_status ON tutor_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_session_id ON tutor_messages(session_id);

-- Enable RLS
ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own tutor sessions" ON tutor_sessions;
DROP POLICY IF EXISTS "Users can insert own tutor sessions" ON tutor_sessions;
DROP POLICY IF EXISTS "Users can update own tutor sessions" ON tutor_sessions;
DROP POLICY IF EXISTS "Users can delete own tutor sessions" ON tutor_sessions;
DROP POLICY IF EXISTS "Users can view own tutor messages" ON tutor_messages;
DROP POLICY IF EXISTS "Users can insert own tutor messages" ON tutor_messages;
DROP POLICY IF EXISTS "Users can update own tutor messages" ON tutor_messages;
DROP POLICY IF EXISTS "Users can delete own tutor messages" ON tutor_messages;

-- Tutor Sessions: Users can only view/manage their own sessions
CREATE POLICY "Users can view own tutor sessions"
  ON tutor_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutor sessions"
  ON tutor_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tutor sessions"
  ON tutor_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tutor sessions"
  ON tutor_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Tutor Messages: Users can only view/manage messages from their own sessions
CREATE POLICY "Users can view own tutor messages"
  ON tutor_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tutor_sessions 
      WHERE tutor_sessions.id = tutor_messages.session_id 
      AND tutor_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tutor messages"
  ON tutor_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tutor_sessions 
      WHERE tutor_sessions.id = tutor_messages.session_id 
      AND tutor_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tutor messages"
  ON tutor_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tutor_sessions 
      WHERE tutor_sessions.id = tutor_messages.session_id 
      AND tutor_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tutor_sessions 
      WHERE tutor_sessions.id = tutor_messages.session_id 
      AND tutor_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own tutor messages"
  ON tutor_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tutor_sessions 
      WHERE tutor_sessions.id = tutor_messages.session_id 
      AND tutor_sessions.user_id = auth.uid()
    )
  );

