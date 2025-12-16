'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Papa from 'papaparse'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Route = {
  id: string
  name: string
  objective: string | null
  created_at: string
  items: RouteItem[]
}

type RouteItem = {
  id: string
  route_id: string
  parent_id: string | null
  item_type: 'topic' | 'subtopic' // Ya no usamos 'class'
  custom_name: string | null
  content: string | null
  estimated_time: number
  priority: number
  difficulty: string
  order_index: number
  children?: RouteItem[]
}

type RouteBuilderProps = {
  userId: string
  routes: Route[]
  onRouteSelect: (routeId: string) => void
}

// Helper function to calculate total time for a topic (sum of all subtopics)
const calculateTopicTime = (item: RouteItem): number => {
  if (item.item_type === 'subtopic') {
    return item.estimated_time
  }
  
  if (item.item_type === 'topic' && item.children && item.children.length > 0) {
    return item.children.reduce((sum, child) => sum + calculateTopicTime(child), 0)
  }
  
  return item.estimated_time
}

function RouteItemTree({ 
  item, 
  level = 0, 
  onEdit, 
  onDelete, 
  onViewClass,
  onAddSubtopic
}: { 
  item: RouteItem
  level?: number
  onEdit: (item: RouteItem) => void
  onDelete: (itemId: string) => void
  onViewClass: (item: RouteItem) => void
  onAddSubtopic: (parentId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(level === 0)
  const displayName = item.custom_name || 'Sin nombre'
  const hasChildren = item.children && item.children.length > 0
  const hasContent = (item.item_type === 'topic' || item.item_type === 'subtopic') && item.content
  
  // Calculate displayed time: for topics, sum of subtopics; for subtopics, use their own time
  const displayedTime = item.item_type === 'topic' && hasChildren 
    ? calculateTopicTime(item)
    : item.estimated_time

  return (
    <div className="mb-3">
      <div className={`bg-gradient-to-r from-white to-gray-50 border-2 rounded-xl p-5 flex items-center justify-between transition-all duration-200 hover:shadow-lg ${
        level === 0 
          ? 'border-indigo-400 hover:border-indigo-500' 
          : level === 1 
          ? 'border-purple-300 hover:border-purple-400' 
          : 'border-gray-200 hover:border-gray-300'
      }`}>
        <div className="flex items-center gap-4 flex-1">
          {hasChildren && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-indigo-600 text-xl transition-colors"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="w-4" />}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className={`font-bold text-gray-900 ${
                level === 0 ? 'text-lg' : level === 1 ? 'text-base' : 'text-sm'
              }`}>
                {displayName}
              </h4>
              <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${
                item.item_type === 'topic' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white' :
                  'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
              }`}>
                {item.item_type === 'topic' ? '📚 Tema' : '🔖 Subtema'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg font-medium">
                ⏱️ {displayedTime} min
                {item.item_type === 'topic' && hasChildren && (
                  <span className="text-xs text-gray-500 ml-1">(suma de subtemas)</span>
                )}
              </span>
              {item.item_type === 'topic' && (
                <>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg font-medium">⭐ {item.priority}/5</span>
                  <span className={`px-2 py-1 rounded-lg font-medium ${
                    item.difficulty === 'baja' ? 'bg-green-100 text-green-700' :
                    item.difficulty === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.difficulty}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {hasContent && (
            <button
              onClick={() => onViewClass(item)}
              className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              👁️ {item.item_type === 'topic' ? 'Intro' : 'Ver'}
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            🗑️
          </button>
        </div>
      </div>
      {item.item_type === 'topic' && (
        <div className="ml-8 mt-2 mb-2">
          <button
            onClick={() => onAddSubtopic(item.id)}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            ➕ Agregar Subtema
          </button>
        </div>
      )}
      {hasChildren && isExpanded && (
        <div className="ml-8 mt-2">
          {item.children!.map((child) => (
            <RouteItemTree
              key={child.id}
              item={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewClass={onViewClass}
              onAddSubtopic={onAddSubtopic}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RouteBuilder({ userId, routes: initialRoutes, onRouteSelect }: RouteBuilderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeIdFromQuery = searchParams.get('routeId')
  const [routes, setRoutes] = useState<Route[]>(initialRoutes)
  
  // Update routes when initialRoutes changes (after server refresh)
  useEffect(() => {
    setRoutes(initialRoutes)
    // If a route was selected, update it with fresh data
    if (selectedRoute) {
      const updatedRoute = initialRoutes.find(r => r.id === selectedRoute.id)
      if (updatedRoute) {
        setSelectedRoute(updatedRoute)
      } else {
        // Route was deleted, clear selection
        setSelectedRoute(null)
      }
    }
  }, [initialRoutes])
  
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  
  // Select route from query parameter if provided
  useEffect(() => {
    if (routeIdFromQuery && routes.length > 0) {
      const routeToSelect = routes.find(r => r.id === routeIdFromQuery)
      if (routeToSelect && (!selectedRoute || selectedRoute.id !== routeIdFromQuery)) {
        setSelectedRoute(routeToSelect)
      }
    }
  }, [routeIdFromQuery, routes, selectedRoute])
  const [showAIModal, setShowAIModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<RouteItem | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [selectedClassItem, setSelectedClassItem] = useState<RouteItem | null>(null)
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResults, setCsvResults] = useState<{ 
    routesCreated: number
    topicsCreated: number
    subtopicsCreated: number
    errors: Array<{ row: number; error: string }> 
  } | null>(null)
  
  const [aiObjective, setAiObjective] = useState('')
  const [routeName, setRouteName] = useState('')
  
  const [itemForm, setItemForm] = useState({
    item_type: 'topic' as 'topic' | 'subtopic',
    parent_id: '',
    custom_name: '',
    content: '',
    estimated_time: 60,
    priority: 3,
    difficulty: 'media' as 'baja' | 'media' | 'alta',
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || !selectedRoute) return

    const oldIndex = selectedRoute.items.findIndex(item => item.id === active.id)
    const newIndex = selectedRoute.items.findIndex(item => item.id === over.id)

    if (oldIndex !== newIndex) {
      const newItems = arrayMove(selectedRoute.items, oldIndex, newIndex)
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order_index: index,
      }))

      setSelectedRoute({ ...selectedRoute, items: updatedItems })
      
      // Save new order
      await saveRouteItems(updatedItems)
    }
  }

  const saveRouteItems = async (items: RouteItem[]) => {
    if (!selectedRoute) return

    try {
      const supabase = createClient()
      
      // Update order_index for all items
      for (const item of items) {
        await supabase
          .from('study_route_items')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
      }
    } catch (error) {
      console.error('Error saving route items order:', error)
    }
  }

  const handleCreateWithAI = async () => {
    if (!aiObjective.trim() || !routeName.trim()) {
      alert('Completa el nombre de la ruta y el objetivo')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai/generate-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: aiObjective,
          userId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al generar ruta')
      }

      const { topics: aiTopics } = await response.json()

      // Create route
      const supabase = createClient()
      const { data: newRoute, error: routeError } = await supabase
        .from('study_routes')
        .insert({
          user_id: userId,
          name: routeName,
          objective: aiObjective,
        })
        .select()
        .single()

      if (routeError) throw routeError

      // Create hierarchical route items: topics -> subtopics -> classes
      const allItems: any[] = []
      let globalOrderIndex = 0

      for (const topic of aiTopics) {
        // Create topic item with intro content
        const topicItem = {
          route_id: newRoute.id,
          parent_id: null,
          item_type: 'topic',
          custom_name: topic.name,
          content: topic.introContent || null, // Contenido introductorio del tema
          estimated_time: topic.estimatedTime,
          priority: topic.priority,
          difficulty: topic.difficulty,
          order_index: globalOrderIndex++,
        }
        allItems.push(topicItem)
      }

      // Insert topics first
      const { data: createdTopics, error: topicsError } = await supabase
        .from('study_route_items')
        .insert(allItems)
        .select('id, order_index, custom_name')

      if (topicsError) throw topicsError

      // Now create subtopics and classes
      const subtopicItems: any[] = []
      const topicMap = new Map(createdTopics.map((t: any, idx: number) => [idx, t.id]))

      for (let topicIdx = 0; topicIdx < aiTopics.length; topicIdx++) {
        const topic = aiTopics[topicIdx]
        const topicItemId = topicMap.get(topicIdx)

        for (let subtopicIdx = 0; subtopicIdx < topic.subtopics.length; subtopicIdx++) {
          const subtopic = topic.subtopics[subtopicIdx]
          
          // Create subtopic item with content
          const subtopicItem = {
            route_id: newRoute.id,
            parent_id: topicItemId,
            item_type: 'subtopic',
            custom_name: subtopic.name,
            content: subtopic.content || null, // Contenido educativo del subtema
            estimated_time: subtopic.estimatedTime,
            priority: subtopic.priority,
            difficulty: topic.difficulty, // Inherit from topic
            order_index: subtopicIdx,
          }
          subtopicItems.push(subtopicItem)
        }
      }

      // Insert subtopics
      let createdSubtopics: any[] = []
      if (subtopicItems.length > 0) {
        const { data: insertedSubtopics, error: subtopicsError } = await supabase
          .from('study_route_items')
          .insert(subtopicItems)
          .select('id, parent_id, order_index')

        if (subtopicsError) throw subtopicsError
        createdSubtopics = insertedSubtopics || []
      }

      // Ya no creamos items de tipo "class" - el contenido está en los subtopics

      // Fetch all items
      const { data: allRouteItems, error: fetchError } = await supabase
        .from('study_route_items')
        .select('*')
        .eq('route_id', newRoute.id)
        .order('order_index', { ascending: true })

      if (fetchError) throw fetchError

      const formattedItems = (allRouteItems || []).map((item: any) => ({
        ...item,
        children: [],
      }))

      // Build hierarchy
      const itemsMap = new Map(formattedItems.map((item: any) => [item.id, item]))
      const rootItems: RouteItem[] = []

      for (const item of formattedItems) {
        if (item.parent_id) {
          const parent = itemsMap.get(item.parent_id)
          if (parent) {
            if (!parent.children) parent.children = []
            parent.children.push(item)
          }
        } else {
          rootItems.push(item)
        }
      }

      const newRouteWithItems: Route = {
        ...newRoute,
        items: rootItems,
      }

      setRoutes([...routes, newRouteWithItems])
      setSelectedRoute(newRouteWithItems)
      setShowAIModal(false)
      setAiObjective('')
      setRouteName('')
      router.refresh() // Refresh to get updated data from server
    } catch (error: any) {
      console.error('Error creating route with AI:', error)
      alert(error.message || 'Error al crear ruta con IA')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateManual = async () => {
    if (!routeName.trim()) {
      alert('Ingresa un nombre para la ruta')
      return
    }

    setIsSaving(true)

    try {
      const supabase = createClient()
      const { data: newRoute, error } = await supabase
        .from('study_routes')
        .insert({
          user_id: userId,
          name: routeName,
        })
        .select()
        .single()

      if (error) throw error

      const newRouteWithItems: Route = {
        ...newRoute,
        items: [],
      }

      setRoutes([...routes, newRouteWithItems])
      setSelectedRoute(newRouteWithItems)
      setShowManualModal(false)
      setRouteName('')
      router.refresh() // Refresh to get updated data from server
    } catch (error) {
      console.error('Error creating manual route:', error)
      alert('Error al crear ruta')
    } finally {
      setIsSaving(false)
    }
  }

  // Helper function to find item by id in tree
  const findItemById = (items: RouteItem[], id: string): RouteItem | null => {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children) {
        const found = findItemById(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  // Quick add item - creates item and redirects to editor immediately
  const handleQuickAddItem = async (itemType: 'topic' | 'subtopic', parentId?: string) => {
    if (!selectedRoute) {
      alert('Por favor selecciona una ruta primero')
      return
    }

    // For subtopics, we need a parent topic
    let finalParentId: string | null = null
    if (itemType === 'subtopic') {
      if (parentId) {
        finalParentId = parentId
      } else {
        // Find first topic as parent (fallback)
        const firstTopic = selectedRoute.items.find(item => item.item_type === 'topic')
        if (!firstTopic) {
          alert('Necesitas crear al menos un tema antes de agregar subtemas')
          return
        }
        finalParentId = firstTopic.id
      }
    }

    setIsSaving(true)

    try {
      const supabase = createClient()
      
      // Calculate order_index based on parent
      let orderIndex = 0
      if (finalParentId) {
        const parentItem = findItemById(selectedRoute.items, finalParentId)
        if (parentItem && parentItem.children) {
          orderIndex = parentItem.children.length
        }
      } else {
        orderIndex = selectedRoute.items.length
      }

      // Create item with default name (user can change it in editor)
      const defaultName = itemType === 'topic' ? 'Nuevo Tema' : 'Nuevo Subtema'
      const insertData = {
        route_id: selectedRoute.id,
        parent_id: finalParentId,
        item_type: itemType,
        custom_name: defaultName,
        content: null, // Content will be added in editor
        estimated_time: 60,
        priority: 3,
        difficulty: 'media',
        order_index: orderIndex,
      }

      console.log('Quick adding item:', insertData)

      const { data: newItem, error } = await supabase
        .from('study_route_items')
        .insert(insertData)
        .select('*')
        .single()

      if (error) {
        console.error('Error adding item:', error)
        alert(`Error al agregar item: ${error.message || 'Error desconocido'}`)
        setIsSaving(false)
        return
      }

      if (!newItem || !newItem.id) {
        console.error('Error: Item created but no ID returned')
        alert('Error: El item se creó pero no se obtuvo un ID válido')
        setIsSaving(false)
        return
      }

      console.log('Item created successfully:', newItem.id)
      setIsSaving(false)
      
      // Redirect directly to editor with routeId
      router.push(`/aprendizaje/editor/${newItem.id}?routeId=${selectedRoute.id}`)
    } catch (error: any) {
      console.error('Error adding item (catch):', error)
      alert(`Error al agregar item: ${error.message || 'Error desconocido'}`)
      setIsSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!selectedRoute) {
      alert('Por favor selecciona una ruta primero')
      return
    }

    // Validation based on item type
    if (itemForm.item_type === 'topic') {
      if (!itemForm.custom_name || !itemForm.custom_name.trim().length) {
        alert('Debes ingresar un nombre para el tema')
        return
      }
    } else if (itemForm.item_type === 'subtopic') {
      if (!itemForm.parent_id) {
        alert('Debes seleccionar un tema padre para el subtema')
        return
      }
      if (!itemForm.custom_name || !itemForm.custom_name.trim().length) {
        alert('Debes ingresar un nombre para el subtema')
        return
      }
    }

    setIsSaving(true)

    try {
      const supabase = createClient()
      
      // Calculate order_index based on parent
      let orderIndex = 0
      if (itemForm.parent_id) {
        const parentItem = findItemById(selectedRoute.items, itemForm.parent_id)
        if (parentItem && parentItem.children) {
          orderIndex = parentItem.children.length
        }
      } else {
        orderIndex = selectedRoute.items.length
      }

      // Create item with basic info (content will be added in editor)
      const insertData = {
        route_id: selectedRoute.id,
        parent_id: itemForm.parent_id || null,
        item_type: itemForm.item_type,
        custom_name: itemForm.custom_name.trim() || null,
        content: null, // Content will be added in editor
        estimated_time: itemForm.estimated_time,
        priority: itemForm.priority,
        difficulty: itemForm.difficulty,
        order_index: orderIndex,
      }

      console.log('Inserting item:', insertData)

      const { data: newItem, error } = await supabase
        .from('study_route_items')
        .insert(insertData)
        .select('*')
        .single()

      if (error) {
        console.error('Error adding item:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        console.error('Error code:', error.code)
        console.error('Error hint:', error.hint)
        alert(`Error al agregar item: ${error.message || 'Error desconocido'}\n\nCódigo: ${error.code || 'N/A'}\n\nPor favor revisa la consola para más detalles.`)
        setIsSaving(false)
        return
      }

      if (!newItem || !newItem.id) {
        console.error('Error: Item created but no ID returned')
        alert('Error: El item se creó pero no se obtuvo un ID válido')
        setIsSaving(false)
        return
      }

      console.log('Item created successfully:', newItem.id)

      // Close modal first
      setShowItemModal(false)
      setEditingItem(null)
      setItemForm({
        item_type: 'topic',
        parent_id: '',
        custom_name: '',
        content: '',
        estimated_time: 60,
        priority: 3,
        difficulty: 'media',
      })
      setIsSaving(false)
      
      // Refresh router to get updated data
      router.refresh()
      
      // Small delay to ensure modal is closed before redirect
      setTimeout(() => {
        // Redirect to editor
        router.push(`/aprendizaje/editor/${newItem.id}`)
      }, 100)
    } catch (error: any) {
      console.error('Error adding item (catch):', error)
      alert(`Error al agregar item: ${error.message || 'Error desconocido'}`)
      setIsSaving(false)
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem || !selectedRoute) return

    setIsSaving(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('study_route_items')
        .update({
          parent_id: itemForm.parent_id || null,
          item_type: itemForm.item_type,
          custom_name: itemForm.custom_name || null,
          content: itemForm.content || null,
          estimated_time: itemForm.estimated_time,
          priority: itemForm.priority,
          difficulty: itemForm.difficulty,
        })
        .eq('id', editingItem.id)

      if (error) {
        console.error('Error updating item:', error)
        throw error
      }

      // Refresh route from database
      const { data: updatedRoute, error: fetchError } = await supabase
        .from('study_routes')
        .select(`
          *,
          items:study_route_items(*)
        `)
        .eq('id', selectedRoute.id)
        .single()

      if (fetchError) {
        console.error('Error fetching updated route:', fetchError)
        throw fetchError
      }

      if (updatedRoute) {
        const formattedItems = (updatedRoute.items || []).map((item: any) => ({
          ...item,
          children: [] as any[],
        }))
        
        // Build hierarchy
        type ItemWithChildren = any & { children?: any[] }
        const itemsMap = new Map<string, ItemWithChildren>(formattedItems.map((item: any) => [item.id, item]))
        const rootItems: any[] = []
        for (const item of formattedItems) {
          if (item.parent_id) {
            const parent = itemsMap.get(item.parent_id)
            if (parent) {
              if (!parent.children) parent.children = []
              parent.children.push(item)
            }
          } else {
            rootItems.push(item)
          }
        }
        
        const routeWithItems = { ...updatedRoute, items: rootItems }
        setSelectedRoute(routeWithItems)
        
        // Update routes list
        setRoutes(routes.map(r => 
          r.id === selectedRoute.id ? routeWithItems : r
        ))
      }

      setShowItemModal(false)
      setEditingItem(null)
      setItemForm({
        item_type: 'topic',
        parent_id: '',
        custom_name: '',
        content: '',
        estimated_time: 60,
        priority: 3,
        difficulty: 'media',
      })
      
      router.refresh() // Refresh to get updated data from server
    } catch (error: any) {
      console.error('Error updating item:', error)
      alert(`Error al actualizar item: ${error.message || 'Error desconocido'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Helper function to recursively remove item and its children from items array
  const removeItemRecursively = (items: RouteItem[], itemId: string): RouteItem[] => {
    return items
      .filter(item => item.id !== itemId)
      .map(item => {
        if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: removeItemRecursively(item.children, itemId)
          }
        }
        return item
      })
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('¿Estás seguro de eliminar este item? Esto eliminará también todos los subtemas asociados.')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('study_route_items')
        .delete()
        .eq('id', itemId)

      if (error) {
        console.error('Error deleting item:', error)
        throw error
      }

      // Update local state immediately for better UX
      if (selectedRoute) {
        const updatedItems = removeItemRecursively(selectedRoute.items, itemId)
        const updatedRoute = {
          ...selectedRoute,
          items: updatedItems,
        }
        setSelectedRoute(updatedRoute)
        
        // Update routes list
        setRoutes(routes.map(r => 
          r.id === selectedRoute.id ? updatedRoute : r
        ))
      }
      
      // Refresh data from server to ensure consistency
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting item:', error)
      alert(`Error al eliminar item: ${error.message || 'Error desconocido'}`)
    }
  }

  const handleEditItem = (item: RouteItem) => {
    // Redirect to editor with routeId as query parameter
    router.push(`/aprendizaje/editor/${item.id}?routeId=${selectedRoute?.id || ''}`)
  }

  const handleDeleteRoute = async (routeId: string, routeName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la ruta "${routeName}"? Esta acción no se puede deshacer y eliminará todos los items asociados.`)) {
      return
    }

    try {
      const supabase = createClient()
      
      // Delete the route (cascade will delete all items and planner entries)
      const { error } = await supabase
        .from('study_routes')
        .delete()
        .eq('id', routeId)

      if (error) {
        console.error('Error deleting route:', error)
        alert(`Error al eliminar la ruta: ${error.message || 'Error desconocido'}`)
        return
      }

      // Refresh data from server to get updated structure
      router.refresh()
      
      // Update local state immediately for better UX
      const updatedRoutes = routes.filter(r => r.id !== routeId)
      setRoutes(updatedRoutes)
      
      // If the deleted route was selected, clear selection
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null)
      }
      
      router.refresh() // Refresh to get updated data from server
    } catch (error: any) {
      console.error('Error deleting route:', error)
      alert(`Error al eliminar la ruta: ${error.message || 'Error desconocido'}`)
    }
  }

  // Helper function to get all items flattened for parent selection
  const getAllItemsFlat = (items: RouteItem[]): RouteItem[] => {
    const result: RouteItem[] = []
    for (const item of items) {
      result.push(item)
      if (item.children) {
        result.push(...getAllItemsFlat(item.children))
      }
    }
    return result
  }

  // CSV Upload Functions
  const downloadCSVTemplate = () => {
    const headers = ['ruta', 'objetivo_ruta', 'tema', 'contenido_intro_tema', 'subtema', 'contenido_subtema', 'tiempo_estimado', 'prioridad', 'dificultad']
    const example = [
      {
        ruta: 'Medicina General',
        objetivo_ruta: 'Estudiar medicina general completa',
        tema: 'Anatomía',
        contenido_intro_tema: '<p>Introducción a la anatomía humana...</p>',
        subtema: 'Sistema Cardiovascular',
        contenido_subtema: '<p>Contenido sobre el corazón y circulación...</p>',
        tiempo_estimado: '60',
        prioridad: '3',
        dificultad: 'media'
      },
      {
        ruta: 'Medicina General',
        objetivo_ruta: 'Estudiar medicina general completa',
        tema: 'Anatomía',
        contenido_intro_tema: '<p>Introducción a la anatomía humana...</p>',
        subtema: 'Sistema Respiratorio',
        contenido_subtema: '<p>Contenido sobre pulmones y respiración...</p>',
        tiempo_estimado: '45',
        prioridad: '4',
        dificultad: 'alta'
      },
      {
        ruta: 'Medicina General',
        objetivo_ruta: 'Estudiar medicina general completa',
        tema: 'Fisiología',
        contenido_intro_tema: '<p>Introducción a la fisiología...</p>',
        subtema: '',
        contenido_subtema: '',
        tiempo_estimado: '30',
        prioridad: '2',
        dificultad: 'baja'
      }
    ]
    
    const csv = Papa.unparse([headers, ...example.map(e => Object.values(e))])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_rutas_estudio.csv'
    link.click()
  }

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      alert('Por favor selecciona un archivo CSV')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 10MB.')
      return
    }

    setCsvFile(file)
    setCsvResults(null)

    // Parse and preview
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          alert(`Error al parsear CSV: ${results.errors[0].message}`)
          return
        }
        setCsvPreview(results.data.slice(0, 5)) // Show first 5 rows
      },
      error: (error) => {
        alert(`Error al leer el archivo: ${error.message}`)
      }
    })
  }

  const validateCSVRow = (row: any, rowIndex: number): { valid: boolean; error?: string; data?: any } => {
    // Required fields
    if (!row.ruta || !row.ruta.trim()) {
      return { valid: false, error: 'Falta el nombre de la ruta' }
    }

    if (!row.tema || !row.tema.trim()) {
      return { valid: false, error: 'Falta el nombre del tema' }
    }

    // If subtema is provided, it must have content
    if (row.subtema && row.subtema.trim() && !row.contenido_subtema) {
      return { valid: false, error: 'Si especificas un subtema, debes incluir su contenido' }
    }

    // Validate tiempo_estimado
    const tiempoEstimado = row.tiempo_estimado ? parseInt(row.tiempo_estimado) : 60
    if (isNaN(tiempoEstimado) || tiempoEstimado < 15 || tiempoEstimado > 480) {
      return { valid: false, error: 'Tiempo estimado debe ser entre 15 y 480 minutos' }
    }

    // Validate prioridad
    const prioridad = row.prioridad ? parseInt(row.prioridad) : 3
    if (isNaN(prioridad) || prioridad < 1 || prioridad > 5) {
      return { valid: false, error: 'Prioridad debe ser entre 1 y 5' }
    }

    // Validate dificultad
    const dificultad = (row.dificultad || 'media').trim().toLowerCase()
    if (!['baja', 'media', 'alta'].includes(dificultad)) {
      return { valid: false, error: 'Dificultad debe ser: baja, media o alta' }
    }

    return {
      valid: true,
      data: {
        ruta: row.ruta.trim(),
        objetivo_ruta: row.objetivo_ruta?.trim() || null,
        tema: row.tema.trim(),
        contenido_intro_tema: row.contenido_intro_tema?.trim() || null,
        subtema: row.subtema?.trim() || null,
        contenido_subtema: row.contenido_subtema?.trim() || null,
        tiempo_estimado: tiempoEstimado,
        prioridad: prioridad,
        dificultad: dificultad
      }
    }
  }

  const handleCSVUpload = async () => {
    if (!csvFile) return

    setCsvUploading(true)
    setCsvResults(null)

    try {
      const supabase = createClient()
      const results = {
        routesCreated: 0,
        topicsCreated: 0,
        subtopicsCreated: 0,
        errors: [] as Array<{ row: number; error: string }>
      }

      // Parse CSV
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (parseResults) => {
          if (parseResults.errors.length > 0) {
            alert(`Error al parsear CSV: ${parseResults.errors[0].message}`)
            setCsvUploading(false)
            return
          }

          // Validate all rows
          const validRows: any[] = []
          parseResults.data.forEach((row: any, index: number) => {
            const validation = validateCSVRow(row, index + 2)
            if (validation.valid && validation.data) {
              validRows.push(validation.data)
            } else {
              results.errors.push({
                row: index + 2,
                error: validation.error || 'Error desconocido'
              })
            }
          })

          if (validRows.length === 0) {
            alert('No hay filas válidas para procesar. Revisa los errores.')
            setCsvResults(results)
            setCsvUploading(false)
            return
          }

          // Group by route
          const routesMap = new Map<string, {
            name: string
            objective: string | null
            topics: Map<string, {
              name: string
              content: string | null
              subtopics: Array<{
                name: string
                content: string | null
                tiempo_estimado: number
                prioridad: number
                dificultad: string
              }>
              tiempo_estimado: number
              prioridad: number
              dificultad: string
            }>
          }>()

          validRows.forEach((row) => {
            if (!routesMap.has(row.ruta)) {
              routesMap.set(row.ruta, {
                name: row.ruta,
                objective: row.objetivo_ruta,
                topics: new Map()
              })
            }

            const route = routesMap.get(row.ruta)!
            if (!route.topics.has(row.tema)) {
              route.topics.set(row.tema, {
                name: row.tema,
                content: row.contenido_intro_tema,
                subtopics: [],
                tiempo_estimado: row.tiempo_estimado,
                prioridad: row.prioridad,
                dificultad: row.dificultad
              })
            }

            // Add subtopic if provided
            if (row.subtema) {
              const topic = route.topics.get(row.tema)!
              topic.subtopics.push({
                name: row.subtema,
                content: row.contenido_subtema,
                tiempo_estimado: row.tiempo_estimado,
                prioridad: row.prioridad,
                dificultad: row.dificultad
              })
            }
          })

          // Process each route
          for (const [routeName, routeData] of Array.from(routesMap.entries())) {
            // Find or create route
            let routeId: string
            const existingRoute = routes.find(r => r.name === routeName)
            
            if (existingRoute) {
              routeId = existingRoute.id
            } else {
              const { data: newRoute, error: routeError } = await supabase
                .from('study_routes')
                .insert({
                  user_id: userId,
                  name: routeData.name,
                  objective: routeData.objective
                })
                .select()
                .single()

              if (routeError) {
                results.errors.push({
                  row: 0,
                  error: `Error al crear ruta "${routeName}": ${routeError.message}`
                })
                continue
              }

              routeId = newRoute.id
              results.routesCreated++
            }

            // Get existing items for this route
            const { data: existingItems } = await supabase
              .from('study_route_items')
              .select('*')
              .eq('route_id', routeId)
              .order('order_index')

            const existingTopics = existingItems?.filter(i => i.item_type === 'topic') || []
            const existingSubtopics = existingItems?.filter(i => i.item_type === 'subtopic') || []

            // Process topics
            let topicOrderIndex = existingTopics.length
            for (const [topicName, topicData] of Array.from(routeData.topics.entries())) {
              // Find or create topic
              let topicId: string
              const existingTopic = existingTopics.find(t => t.custom_name === topicName)

              if (existingTopic) {
                topicId = existingTopic.id
                // Update topic content if provided
                if (topicData.content) {
                  await supabase
                    .from('study_route_items')
                    .update({ content: topicData.content })
                    .eq('id', topicId)
                }
              } else {
                const { data: newTopic, error: topicError } = await supabase
                  .from('study_route_items')
                  .insert({
                    route_id: routeId,
                    parent_id: null,
                    item_type: 'topic',
                    custom_name: topicName,
                    content: topicData.content,
                    estimated_time: topicData.tiempo_estimado,
                    priority: topicData.prioridad,
                    difficulty: topicData.dificultad,
                    order_index: topicOrderIndex++
                  })
                  .select()
                  .single()

                if (topicError) {
                  results.errors.push({
                    row: 0,
                    error: `Error al crear tema "${topicName}" en ruta "${routeName}": ${topicError.message}`
                  })
                  continue
                }

                topicId = newTopic.id
                results.topicsCreated++
              }

              // Process subtopics
              let subtopicOrderIndex = existingSubtopics.filter(s => s.parent_id === topicId).length
              for (const subtopicData of topicData.subtopics) {
                // Check if subtopic already exists
                const existingSubtopic = existingSubtopics.find(
                  s => s.parent_id === topicId && s.custom_name === subtopicData.name
                )

                if (existingSubtopic) {
                  // Update subtopic content if provided
                  if (subtopicData.content) {
                    await supabase
                      .from('study_route_items')
                      .update({ content: subtopicData.content })
                      .eq('id', existingSubtopic.id)
                  }
                } else {
                  const { error: subtopicError } = await supabase
                    .from('study_route_items')
                    .insert({
                      route_id: routeId,
                      parent_id: topicId,
                      item_type: 'subtopic',
                      custom_name: subtopicData.name,
                      content: subtopicData.content,
                      estimated_time: subtopicData.tiempo_estimado,
                      priority: subtopicData.prioridad,
                      difficulty: subtopicData.dificultad,
                      order_index: subtopicOrderIndex++
                    })

                  if (subtopicError) {
                    results.errors.push({
                      row: 0,
                      error: `Error al crear subtema "${subtopicData.name}" en tema "${topicName}": ${subtopicError.message}`
                    })
                    continue
                  }

                  results.subtopicsCreated++
                }
              }
            }
          }

          setCsvResults(results)
          setCsvUploading(false)

          // Refresh to show new routes
          if (results.routesCreated > 0 || results.topicsCreated > 0 || results.subtopicsCreated > 0) {
            router.refresh()
          }
        },
        error: (error) => {
          alert(`Error al leer el archivo: ${error.message}`)
          setCsvUploading(false)
        }
      })
    } catch (error: any) {
      console.error('Error uploading CSV:', error)
      alert(`Error al procesar el archivo: ${error.message}`)
      setCsvUploading(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Routes List */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Mis Rutas de Estudio
            </h2>
            <p className="text-gray-600 text-sm">Gestiona tus rutas de aprendizaje</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowCSVModal(true)
                setCsvFile(null)
                setCsvPreview([])
                setCsvResults(null)
              }}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              📄 CSV
            </button>
            <button
              onClick={() => setShowAIModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              🤖 IA
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              ✏️ Manual
            </button>
          </div>
        </div>

        {routes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-gray-600 text-lg mb-2">No tienes rutas de estudio</p>
            <p className="text-gray-500 text-sm">Crea una nueva para comenzar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => (
              <div
                key={route.id}
                className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-start justify-between gap-3 ${
                  selectedRoute?.id === route.id
                    ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md bg-white'
                }`}
              >
                <button
                  onClick={() => setSelectedRoute(route)}
                  className="flex-1 text-left"
                >
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{route.name}</h3>
                  {route.objective && (
                    <p className="text-sm text-gray-600 mt-1">{route.objective}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span>📋</span> {route.items.length} {route.items.length === 1 ? 'item' : 'items'}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteRoute(route.id, route.name)
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex-shrink-0"
                  title="Eliminar ruta"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Route Items */}
      {selectedRoute && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                {selectedRoute.name}
              </h3>
              {selectedRoute.objective && (
                <p className="text-sm text-gray-600">{selectedRoute.objective}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleQuickAddItem('topic')}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                ➕ Agregar Tema
              </button>
              <button
                onClick={() => onRouteSelect(selectedRoute.id)}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                📅 Ir al Planner
              </button>
            </div>
          </div>

          {selectedRoute.items.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              Esta ruta está vacía. Agrega items para comenzar.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedRoute.items
                .sort((a, b) => a.order_index - b.order_index)
                .map((item) => (
                  <RouteItemTree
                    key={item.id}
                    item={item}
                    level={0}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    onViewClass={(item) => {
                      setSelectedClassItem(item)
                      setShowClassModal(true)
                    }}
                    onAddSubtopic={(parentId) => handleQuickAddItem('subtopic', parentId)}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                🤖
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Crear Ruta con IA</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Ruta *
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ej: Preparación para Examen de Medicina"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objetivo de Estudio *
                </label>
                <textarea
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  placeholder="Describe tu objetivo de estudio. Ej: Quiero prepararme para el examen de Hepatitis B, necesito cubrir etiología, diagnóstico, tratamiento y prevención."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCreateWithAI}
                  disabled={isGenerating || !routeName.trim() || !aiObjective.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                >
                  {isGenerating ? '⏳ Generando...' : '✨ Generar Ruta'}
                </button>
                <button
                  onClick={() => {
                    setShowAIModal(false)
                    setRouteName('')
                    setAiObjective('')
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Route Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                ✏️
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Crear Ruta Manual</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Ruta *
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ej: Mi Ruta Personalizada"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCreateManual}
                  disabled={isSaving || !routeName.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                >
                  {isSaving ? '⏳ Creando...' : '✨ Crear'}
                </button>
                <button
                  onClick={() => {
                    setShowManualModal(false)
                    setRouteName('')
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {editingItem ? '✏️' : '➕'}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {editingItem ? 'Editar Item' : 'Agregar Item'}
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Item *
                </label>
                <select
                  value={itemForm.item_type}
                  onChange={(e) => {
                    const newType = e.target.value as 'topic' | 'subtopic'
                    setItemForm({ 
                      ...itemForm, 
                      item_type: newType,
                      parent_id: newType === 'topic' ? '' : itemForm.parent_id,
                    })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="topic">Tema</option>
                  <option value="subtopic">Subtema</option>
                </select>
              </div>

              {itemForm.item_type === 'subtopic' && selectedRoute && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {itemForm.item_type === 'subtopic' ? 'Tema Padre *' : 'Subtema Padre *'}
                  </label>
                  <select
                    value={itemForm.parent_id}
                    onChange={(e) => {
                      setItemForm({ ...itemForm, parent_id: e.target.value })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecciona un {itemForm.item_type === 'subtopic' ? 'tema' : 'subtema'}</option>
                    {getAllItemsFlat(selectedRoute.items)
                      .filter(item => 
                        itemForm.item_type === 'subtopic' 
                          ? item.item_type === 'topic'
                          : item.item_type === 'subtopic'
                      )
                      .map((item) => {
                        const name = item.custom_name || 'Sin nombre'
                        return (
                          <option key={item.id} value={item.id}>
                            {name}
                          </option>
                        )
                      })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={itemForm.custom_name}
                  onChange={(e) => setItemForm({ ...itemForm, custom_name: e.target.value })}
                  placeholder="Ej: Repaso de Conceptos Clave"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {(itemForm.item_type === 'topic' || itemForm.item_type === 'subtopic') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {itemForm.item_type === 'topic' ? 'Contenido Introductorio' : 'Contenido Educativo'}
                  </label>
                  <textarea
                    value={itemForm.content}
                    onChange={(e) => setItemForm({ ...itemForm, content: e.target.value })}
                    placeholder={itemForm.item_type === 'topic' 
                      ? "Ingresa el contenido introductorio del tema..." 
                      : "Ingresa el contenido educativo del subtema..."}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg min-h-[200px]"
                    rows={10}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiempo Estimado (minutos)
                </label>
                <input
                  type="number"
                  min="15"
                  max="480"
                  value={itemForm.estimated_time}
                  onChange={(e) => setItemForm({ ...itemForm, estimated_time: parseInt(e.target.value) || 60 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridad (1-5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={itemForm.priority}
                  onChange={(e) => setItemForm({ ...itemForm, priority: parseInt(e.target.value) || 3 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dificultad
                </label>
                <select
                  value={itemForm.difficulty}
                  onChange={(e) => setItemForm({ ...itemForm, difficulty: e.target.value as 'baja' | 'media' | 'alta' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={editingItem ? handleUpdateItem : handleAddItem}
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                >
                  {isSaving ? '⏳ Guardando...' : editingItem ? '💾 Actualizar' : '✨ Agregar'}
                </button>
                <button
                  onClick={() => {
                    setShowItemModal(false)
                    setEditingItem(null)
                    setItemForm({
                      item_type: 'topic',
                      parent_id: '',
                      custom_name: '',
                      content: '',
                      estimated_time: 60,
                      priority: 3,
                      difficulty: 'media',
                    })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Content Modal */}
      {showClassModal && selectedClassItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedClassItem.custom_name || 'Clase'}
              </h3>
              <button
                onClick={() => {
                  setShowClassModal(false)
                  setSelectedClassItem(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="prose prose-lg max-w-none mb-4">
              {selectedClassItem.content ? (
                <div 
                  className="text-gray-700"
                  dangerouslySetInnerHTML={{ __html: selectedClassItem.content }}
                />
              ) : (
                <div className="text-gray-500 italic">
                  No hay contenido disponible para esta clase.
                </div>
              )}
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setShowClassModal(false)
                  setSelectedClassItem(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Cargar Rutas desde CSV</h2>
              <button
                onClick={() => {
                  setShowCSVModal(false)
                  setCsvFile(null)
                  setCsvPreview([])
                  setCsvResults(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Formato del CSV:</h3>
              <p className="text-sm text-blue-800 mb-2">
                El archivo CSV debe tener las siguientes columnas:
              </p>
              <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                <li><strong>ruta</strong> - Nombre de la ruta de estudio (requerido)</li>
                <li><strong>objetivo_ruta</strong> - Objetivo de la ruta (opcional, solo se usa al crear nueva ruta)</li>
                <li><strong>tema</strong> - Nombre del tema (requerido)</li>
                <li><strong>contenido_intro_tema</strong> - Contenido HTML introductorio del tema (opcional)</li>
                <li><strong>subtema</strong> - Nombre del subtema (opcional)</li>
                <li><strong>contenido_subtema</strong> - Contenido HTML del subtema (opcional, requerido si hay subtema)</li>
                <li><strong>tiempo_estimado</strong> - Minutos estimados (opcional, default: 60, rango: 15-480)</li>
                <li><strong>prioridad</strong> - Prioridad 1-5 (opcional, default: 3)</li>
                <li><strong>dificultad</strong> - baja/media/alta (opcional, default: media)</li>
              </ul>
              <p className="text-sm text-blue-800 mt-2">
                <strong>Nota:</strong> Si la ruta ya existe, se agregarán los temas/subtemas a esa ruta. 
                Si un tema ya existe, se actualizará su contenido introductorio.
              </p>
              <button
                onClick={downloadCSVTemplate}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                📥 Descargar Template CSV
              </button>
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar archivo CSV
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Preview */}
            {csvPreview.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Vista previa (primeras 5 filas):
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(csvPreview[0] || {}).map((key) => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          {Object.values(row).map((value: any, vIdx) => (
                            <td key={vIdx} className="px-3 py-2 text-gray-900">
                              {String(value || '').substring(0, 50)}
                              {String(value || '').length > 50 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results */}
            {csvResults && (
              <div className={`mb-4 p-4 rounded-lg ${
                csvResults.errors.length === 0 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <h3 className="font-semibold mb-2">
                  {csvResults.errors.length === 0 
                    ? '✅ Carga completada exitosamente' 
                    : '⚠️ Carga completada con errores'}
                </h3>
                <div className="text-sm mb-2 space-y-1">
                  <p><strong>{csvResults.routesCreated}</strong> rutas creadas</p>
                  <p><strong>{csvResults.topicsCreated}</strong> temas creados</p>
                  <p><strong>{csvResults.subtopicsCreated}</strong> subtemas creados</p>
                </div>
                {csvResults.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Errores ({csvResults.errors.length}):
                    </p>
                    <div className="max-h-40 overflow-y-auto">
                      {csvResults.errors.slice(0, 10).map((err, idx) => (
                        <p key={idx} className="text-xs text-red-700">
                          {err.row > 0 ? `Fila ${err.row}: ` : ''}{err.error}
                        </p>
                      ))}
                      {csvResults.errors.length > 10 && (
                        <p className="text-xs text-gray-500">
                          ... y {csvResults.errors.length - 10} errores más
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCSVModal(false)
                  setCsvFile(null)
                  setCsvPreview([])
                  setCsvResults(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                {csvResults ? 'Cerrar' : 'Cancelar'}
              </button>
              {csvFile && !csvResults && (
                <button
                  onClick={handleCSVUpload}
                  disabled={csvUploading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {csvUploading ? 'Cargando...' : 'Cargar Rutas'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

