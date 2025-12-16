import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardErroresClient from './DashboardErroresClient'

export default async function DashboardErroresPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get user's study routes to map topics/subtopics to routes
  const { data: routesData } = await supabase
    .from('study_routes')
    .select(`
      id,
      name,
      items:study_route_items(
        id,
        parent_id,
        item_type,
        custom_name,
        children:study_route_items(
          id,
          item_type,
          custom_name
        )
      )
    `)
    .eq('user_id', user.id)

  // Build a map of topic_name -> route_name and subtopic_name -> route_name
  const topicToRouteMap = new Map<string, string>()
  const subtopicToRouteMap = new Map<string, string>()

  routesData?.forEach((route: any) => {
    const routeName = route.name
    route.items?.forEach((item: any) => {
      if (item.item_type === 'topic' && item.custom_name) {
        topicToRouteMap.set(item.custom_name, routeName)
        // Also map subtopics
        item.children?.forEach((child: any) => {
          if (child.item_type === 'subtopic' && child.custom_name) {
            subtopicToRouteMap.set(child.custom_name, routeName)
          }
        })
      }
    })
  })

  // Get ONLY simulacro attempts (not banco de preguntas) with full question details
  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select(`
      id,
      user_answer,
      is_correct,
      error_type,
      feedback,
      conclusion,
      session_id,
      time_spent,
      created_at,
      questions (
        id,
        prompt,
        answer_key,
        explanation,
        options,
        topic_name,
        subtopic_name
      )
    `)
    .eq('user_id', user.id)
    .eq('source', 'simulacro')
    .order('created_at', { ascending: false })

  if (attemptsError) {
    console.error('DashboardErrores: Error fetching attempts:', attemptsError)
  }

  // Transform attempts - filter out any with null questions and add route_name
  const transformedAttempts = (attempts || [])
    .filter((attempt: any) => {
      // Only include attempts that have valid questions
      return attempt && 
             attempt.questions !== null && 
             attempt.questions !== undefined &&
             attempt.questions.id
    })
    .map((attempt: any) => {
      // Find route name based on topic_name or subtopic_name
      let routeName = 'Sin ruta'
      if (attempt.questions.subtopic_name) {
        routeName = subtopicToRouteMap.get(attempt.questions.subtopic_name) || 'Sin ruta'
      } else if (attempt.questions.topic_name) {
        routeName = topicToRouteMap.get(attempt.questions.topic_name) || 'Sin ruta'
      }

      return {
        ...attempt,
        route_name: routeName,
        questions: {
          ...attempt.questions,
        },
      }
    })

  console.log('DashboardErrores: Raw attempts count:', attempts?.length || 0)
  console.log('DashboardErrores: Transformed attempts count:', transformedAttempts.length)

  return (
    <DashboardErroresClient attempts={transformedAttempts} />
  )
}

