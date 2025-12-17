import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TutorClient from './TutorClient'

type Route = {
  id: string
  name: string
  objective: string | null
  created_at: string
  items: Array<{
    id: string
    parent_id: string | null
    item_type: 'topic' | 'subtopic'
    custom_name: string | null
    children?: Array<{
      id: string
      item_type: 'topic' | 'subtopic'
      custom_name: string | null
    }>
  }>
}

type TutorSession = {
  id: string
  route_id: string | null
  topic_id: string | null
  subtopic_id: string | null
  tutor_role: string
  user_role: string
  context: string
  objective: string
  status: 'created' | 'in_progress' | 'completed'
  anchor_recommendation: string | null
  created_at: string
  updated_at: string
  route_name?: string
  topic_name?: string
  subtopic_name?: string
}

export default async function TutorPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get user's study routes with hierarchical items
  const { data: routesData } = await supabase
    .from('study_routes')
    .select(`
      id,
      name,
      objective,
      created_at,
      items:study_route_items(
        id,
        parent_id,
        item_type,
        custom_name,
        content,
        order_index
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Transform routes to build hierarchy
  const transformedRoutes: Route[] = (routesData || []).map((route: any) => {
    if (!Array.isArray(route.items)) {
      return { ...route, items: [] }
    }

    const itemsMap = new Map<string, any>(
      route.items.map((item: any) => [
        item.id,
        {
          ...item,
          children: [] as any[],
        },
      ])
    )

    const rootItems: any[] = []
    for (const item of route.items) {
      const mappedItem = itemsMap.get(item.id)
      if (!mappedItem) continue
      
      if (item.parent_id) {
        const parent = itemsMap.get(item.parent_id)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(mappedItem)
        }
      } else {
        rootItems.push(mappedItem)
      }
    }

    // Sort by order_index
    const sortItems = (items: any[]) => {
      items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          sortItems(item.children)
        }
      })
    }
    sortItems(rootItems)

    return { ...route, items: rootItems }
  })

  // Get tutor sessions with related route/topic/subtopic names
  const { data: sessionsData } = await supabase
    .from('tutor_sessions')
    .select(`
      id,
      route_id,
      topic_id,
      subtopic_id,
      tutor_role,
      user_role,
      context,
      objective,
      status,
      anchor_recommendation,
      created_at,
      updated_at
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Enrich sessions with route/topic/subtopic names
  const enrichedSessions: TutorSession[] = (sessionsData || []).map((session: any) => {
    let routeName = 'Sin ruta'
    let topicName: string | undefined
    let subtopicName: string | undefined

    if (session.route_id) {
      const route = transformedRoutes.find(r => r.id === session.route_id)
      if (route) {
        routeName = route.name
      }
    }

    if (session.topic_id || session.subtopic_id) {
      for (const route of transformedRoutes) {
        const findItem = (items: any[], itemId: string): any => {
          for (const item of items) {
            if (item.id === itemId) return item
            if (item.children) {
              const found = findItem(item.children, itemId)
              if (found) return found
            }
          }
          return null
        }

        if (session.topic_id) {
          const topic = findItem(route.items, session.topic_id)
          if (topic) {
            topicName = topic.custom_name || undefined
            break
          }
        }

        if (session.subtopic_id) {
          const subtopic = findItem(route.items, session.subtopic_id)
          if (subtopic) {
            subtopicName = subtopic.custom_name || undefined
            // Find parent topic
            for (const item of route.items) {
              if (item.children) {
                const found = item.children.find((c: any) => c.id === session.subtopic_id)
                if (found) {
                  topicName = item.custom_name || undefined
                  break
                }
              }
            }
            break
          }
        }
      }
    }

    return {
      ...session,
      route_name: routeName,
      topic_name: topicName,
      subtopic_name: subtopicName,
    }
  })

  return (
    <TutorClient userId={user.id} routes={transformedRoutes} sessions={enrichedSessions} />
  )
}

