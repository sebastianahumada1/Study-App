import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get user stats
  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select(`
      id,
      is_correct,
      created_at,
      questions (
        topic_name,
        subtopic_name
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (attemptsError) {
    console.error('Dashboard: Error fetching attempts:', attemptsError)
  }

  // Calculate stats
  const totalAttempts = attempts?.length || 0
  const correctAttempts =
    attempts?.filter((a) => a.is_correct).length || 0
  const incorrectAttempts = totalAttempts - correctAttempts
  const accuracy =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

  return (
    <DashboardClient
      totalAttempts={totalAttempts}
      correctAttempts={correctAttempts}
      incorrectAttempts={incorrectAttempts}
      accuracy={accuracy}
    />
  )
}
