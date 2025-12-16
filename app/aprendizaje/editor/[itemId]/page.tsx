import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ContentEditor from './ContentEditor'

export default async function EditorPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // If itemId is 'new', we need to create a temporary item first
  // But actually, we should handle 'new' in RouteBuilder by creating the item first
  // So if we get 'new' here, it's an error - redirect back
  if (itemId === 'new') {
    redirect('/aprendizaje')
  }

  // Fetch the item with its route information
  const { data: item, error: itemError } = await supabase
    .from('study_route_items')
    .select(`
      id,
      route_id,
      parent_id,
      item_type,
      custom_name,
      content,
      estimated_time,
      priority,
      difficulty,
      order_index,
      study_routes!inner(
        id,
        name,
        user_id
      )
    `)
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    console.error('Editor: Error fetching item:', itemError)
    redirect('/aprendizaje')
  }

  // Verify that the item belongs to the current user
  // study_routes is an array from the join, get the first element
  const route = Array.isArray(item.study_routes) ? item.study_routes[0] : item.study_routes
  if (!route || route.user_id !== user.id) {
    redirect('/aprendizaje')
  }

  return (
    <ContentEditor
      itemId={item.id}
      routeId={item.route_id}
      itemType={item.item_type}
      itemName={item.custom_name || ''}
      initialContent={item.content || ''}
      userId={user.id}
      estimatedTime={item.estimated_time}
      priority={item.priority}
      difficulty={item.difficulty}
    />
  )
}

