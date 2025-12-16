import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportesClient from './ReportesClient'

export default async function ReportesPage() {
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

  // Get ALL simulacro attempts with full question details
  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select(`
      id,
      is_correct,
      created_at,
      questions (
        id,
        topic_name,
        subtopic_name
      )
    `)
    .eq('user_id', user.id)
    .eq('source', 'simulacro')
    .order('created_at', { ascending: false })

  if (attemptsError) {
    console.error('Reportes: Error fetching attempts:', attemptsError)
  }

  // Transform attempts - filter out any with null questions and add route_name
  const transformedAttempts = (attempts || [])
    .filter((attempt: any) => {
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
        id: attempt.id,
        is_correct: attempt.is_correct,
        created_at: attempt.created_at,
        route_name: routeName,
        topic_name: attempt.questions.topic_name || null,
        subtopic_name: attempt.questions.subtopic_name || null,
      }
    })

  return (
    <ReportesClient attempts={transformedAttempts} />
  )
}

