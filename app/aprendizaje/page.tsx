import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AprendizajeClient from './AprendizajeClient'

export default async function AprendizajePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get user's study routes with items
  const { data: routes, error: routesError } = await supabase
    .from('study_routes')
    .select(`
      id,
      name,
      objective,
      created_at,
      items:study_route_items(
        id,
        route_id,
        parent_id,
        item_type,
        custom_name,
        content,
        estimated_time,
        priority,
        difficulty,
        order_index
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (routesError) {
    console.error('Aprendizaje: Error fetching routes:', routesError)
  }

  // Transform routes and build hierarchy
  const transformedRoutes = (routes || []).map((route: any) => {
    if (!Array.isArray(route.items)) {
      return { ...route, items: [] }
    }

    // Map all items
    type ItemWithChildren = any & { children?: any[] }
    const itemsMap = new Map<string, ItemWithChildren>(
      route.items.map((item: any) => [
        item.id,
        {
          ...item,
          children: [] as any[],
        },
      ])
    )

    // Build hierarchy
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
      items.sort((a, b) => a.order_index - b.order_index)
      items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          sortItems(item.children)
        }
      })
    }
    sortItems(rootItems)

    return { ...route, items: rootItems }
  })

  const enableAIMotivation = process.env.ENABLE_AI_MOTIVATION === 'true'

  return (
    <AprendizajeClient
      userId={user.id}
      routes={transformedRoutes}
      enableAIMotivation={enableAIMotivation}
    />
  )
}
