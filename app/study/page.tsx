import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SimulacroClient from './SimulacroClient'

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

export default async function SimulacroPage() {
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
        order_index
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Transform to hierarchical structure
  const routes: Route[] = (routesData || []).map(route => {
    const items = route.items || []
    type ItemWithChildren = {
      id: string
      parent_id: string | null
      item_type: 'topic' | 'subtopic'
      custom_name: string | null
      order_index: number
      children?: ItemWithChildren[]
    }
    const itemsMap = new Map<string, ItemWithChildren>(
      items.map(item => [item.id, { ...item, children: [] as ItemWithChildren[] }])
    )
    const rootItems: ItemWithChildren[] = []

    items.forEach(item => {
      const mappedItem = itemsMap.get(item.id)
      if (!mappedItem) return

      if (item.parent_id) {
        const parent = itemsMap.get(item.parent_id)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(mappedItem)
        }
      } else {
        rootItems.push(mappedItem)
      }
    })

    return {
      id: route.id,
      name: route.name,
      objective: route.objective,
      created_at: route.created_at,
      items: rootItems.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    }
  })

  return (
    <SimulacroClient
      userId={user.id}
      routes={routes}
    />
  )
}
