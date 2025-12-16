import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BancoPreguntasClient from './BancoPreguntasClient'

type Props = {
  searchParams: Promise<{ subtopic?: string }>
}

export default async function BancoPreguntasPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get questions
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select(`
      id,
      prompt,
      answer_key,
      explanation,
      options,
      topic_name,
      subtopic_name
    `)
    .order('created_at', { ascending: true })

  if (questionsError) {
    console.error('BancoPreguntas: Error fetching questions:', questionsError)
  }

  // Get user's study routes with items for the selector
  const { data: routes, error: routesError } = await supabase
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
    .order('created_at', { ascending: false })

  if (routesError) {
    console.error('BancoPreguntas: Error fetching routes:', routesError)
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

  // Transform questions
  const transformedQuestions = (questions || []).map((q: any) => ({
    ...q,
  }))

  return (
    <BancoPreguntasClient
      questions={transformedQuestions}
      routes={transformedRoutes}
    />
  )
}
