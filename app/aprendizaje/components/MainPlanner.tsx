'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isToday, parseISO } from 'date-fns'

// Helper functions to handle dates in user's local timezone
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type RouteItem = {
  id: string
  route_id: string
  parent_id: string | null
  item_type: 'topic' | 'subtopic'
  custom_name: string | null
  content: string | null
  estimated_time: number
  priority: number
  difficulty: string
  order_index: number
  children?: RouteItem[]
}

type Route = {
  id: string
  name: string
  objective: string | null
  items: RouteItem[]
}

type PlannerItem = {
  id: string
  route_id: string
  item_id: string
  day_of_week: number
  order_index: number
  scheduled_date: string | null
  is_completed: boolean
  item: RouteItem & { route_name?: string; topic_name?: string }
}

type MainPlannerProps = {
  userId: string
  routes: Route[]
}

const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Get all subtopics from all routes
const getAllSubtopics = (routes: Route[]): (RouteItem & { route_name: string; route_id: string; topic_name: string })[] => {
  const subtopics: (RouteItem & { route_name: string; route_id: string; topic_name: string })[] = []
  
  routes.forEach(route => {
    route.items.forEach(topic => {
      if (topic.item_type === 'topic' && topic.children) {
        topic.children.forEach(subtopic => {
          if (subtopic.item_type === 'subtopic') {
            subtopics.push({
              ...subtopic,
              route_name: route.name,
              route_id: route.id,
              topic_name: topic.custom_name || 'Sin nombre',
            })
          }
        })
      }
    })
  })
  
  return subtopics
}

function CalendarDay({ 
  date, 
  isCurrentMonth, 
  plannerItems, 
  onItemClick,
  onToggleComplete 
}: { 
  date: Date
  isCurrentMonth: boolean
  plannerItems: PlannerItem[]
  onItemClick: (item: PlannerItem) => void
  onToggleComplete: (item: PlannerItem) => void
}) {
  const dateString = getLocalDateString(date)
  const dayItems = plannerItems.filter(p => {
    if (!p.scheduled_date) return false
    return p.scheduled_date === dateString
  }).sort((a, b) => a.order_index - b.order_index)

  const dayTotalTime = dayItems.reduce((sum, p) => sum + p.item.estimated_time, 0)

  return (
    <div
      className={`min-h-[120px] border-2 rounded-xl p-3 transition-all duration-200 ${
        !isCurrentMonth 
          ? 'bg-gray-50 opacity-50 border-gray-200' 
          : isToday(date)
          ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-400 ring-2 ring-indigo-300 shadow-md'
          : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${
          isToday(date) ? 'text-indigo-600 font-bold' : 
          isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
        }`}>
          {format(date, 'd')}
        </span>
        {dayTotalTime > 0 && (
          <span className="text-xs text-gray-500">{dayTotalTime} min</span>
        )}
      </div>
      <div className="space-y-1">
        {dayItems.map((plannerItem) => {
          const displayName = plannerItem.item.custom_name || 'Sin nombre'
          return (
            <div
              key={plannerItem.id}
              onClick={() => onItemClick(plannerItem)}
              className={`text-xs p-2 rounded-xl border-2 cursor-pointer hover:shadow-lg transition-all duration-200 ${
                plannerItem.is_completed
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 line-through text-gray-500'
                  : plannerItem.item.content
                  ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 text-gray-900 hover:border-indigo-500'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300 text-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span 
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] flex items-center justify-center font-bold shadow-sm"
                  title={displayName}
                >
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span 
                  className="truncate flex-1 text-xs font-semibold" 
                  title={`${displayName} - ${plannerItem.item.estimated_time} min`}
                >
                  {displayName.length > 12 
                    ? `${displayName.substring(0, 12)}...` 
                    : displayName}
                </span>
                <input
                  type="checkbox"
                  checked={plannerItem.is_completed}
                  onChange={() => onToggleComplete(plannerItem)}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto h-4 w-4 text-indigo-600 flex-shrink-0 rounded cursor-pointer"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MainPlanner({ userId, routes }: MainPlannerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([])
  const [selectedItem, setSelectedItem] = useState<{ type: 'subtopic'; item: RouteItem & { route_name?: string; route_id?: string; topic_name?: string } } | { type: 'planner'; item: PlannerItem } | null>(null)
  const [showDateModal, setShowDateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set())
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())

  // Get all subtopics from all routes
  const allSubtopics = getAllSubtopics(routes)

  // Load planner items from all routes
  const loadPlannerItems = async () => {
    try {
      const supabase = createClient()
      
      // Get all planner items for this user (across all routes)
      const { data, error } = await supabase
        .from('study_planner')
        .select(`
          *,
          item:study_route_items(*),
          route:study_routes(name)
        `)
        .in('route_id', routes.map(r => r.id))
        .order('scheduled_date', { ascending: true })
        .order('order_index', { ascending: true })

      if (error) throw error

      // Enrich items with topic_name by finding parent topic
      const formatted = (data || []).map((pi: any) => {
        let topicName: string | undefined
        if (pi.item?.parent_id) {
          // Find the parent topic in routes
          for (const route of routes) {
            for (const topic of route.items) {
              if (topic.id === pi.item.parent_id && topic.item_type === 'topic') {
                topicName = topic.custom_name || undefined
                break
              }
              // Also check in children
              if (topic.children) {
                for (const child of topic.children) {
                  if (child.id === pi.item.parent_id && child.item_type === 'topic') {
                    topicName = child.custom_name || undefined
                    break
                  }
                }
              }
            }
            if (topicName) break
          }
        }
        
        return {
          ...pi,
          item: {
            ...pi.item,
            route_name: pi.route?.name,
            topic_name: topicName,
          },
        }
      })

      setPlannerItems(formatted)
    } catch (error) {
      console.error('Error loading planner items:', error)
    }
  }

  useEffect(() => {
    loadPlannerItems()
  }, [routes])

  const handleItemClick = (item: RouteItem & { route_name?: string; route_id?: string; topic_name?: string }) => {
    setSelectedItem({ type: 'subtopic', item })
    setShowDateModal(true)
    setSelectedDate('')
  }

  const handlePlannerItemClick = (plannerItem: PlannerItem) => {
    setSelectedItem({ type: 'planner', item: plannerItem })
    setShowDateModal(true)
    setSelectedDate(plannerItem.scheduled_date || '')
  }

  const handleAssignToDate = async () => {
    if (!selectedItem || !selectedDate) return

    setIsSaving(true)
    try {
      const supabase = createClient()
      // Parse date string directly to avoid timezone issues
      // selectedDate is in format YYYY-MM-DD, use it directly
      const dateToSave = selectedDate
      // Parse to get day of week in local timezone
      const [year, month, day] = selectedDate.split('-').map(Number)
      const targetDate = new Date(year, month - 1, day)
      const dayOfWeek = targetDate.getDay()

      if (selectedItem.type === 'subtopic') {
        const routeItem = selectedItem.item
        const routeId = routeItem.route_id || ''
        
        // Check if already scheduled
        const existing = plannerItems.find(p => p.item_id === routeItem.id)
        if (existing) {
          // Update existing
          const existingItems = plannerItems.filter(p => 
            p.scheduled_date === dateToSave && p.id !== existing.id
          )
          const newOrder = existingItems.length

          const { error } = await supabase
            .from('study_planner')
            .update({
              scheduled_date: dateToSave,
              day_of_week: dayOfWeek,
              order_index: newOrder,
            })
            .eq('id', existing.id)

          if (error) throw error
        } else {
          // Create new
          const existingItems = plannerItems.filter(p => p.scheduled_date === dateToSave)
          const newOrder = existingItems.length

          const { data: newPlannerItem, error } = await supabase
            .from('study_planner')
            .insert({
              route_id: routeId,
              item_id: routeItem.id,
              scheduled_date: dateToSave,
              day_of_week: dayOfWeek,
              order_index: newOrder,
              is_completed: false,
            })
            .select(`
              *,
              item:study_route_items(*),
              route:study_routes(name)
            `)
            .single()

          if (error) throw error

          // Find topic name for the item
          let topicName: string | undefined
          if (newPlannerItem.item?.parent_id) {
            for (const route of routes) {
              for (const topic of route.items) {
                if (topic.id === newPlannerItem.item.parent_id && topic.item_type === 'topic') {
                  topicName = topic.custom_name || undefined
                  break
                }
                if (topic.children) {
                  for (const child of topic.children) {
                    if (child.id === newPlannerItem.item.parent_id && child.item_type === 'topic') {
                      topicName = child.custom_name || undefined
                      break
                    }
                  }
                }
              }
              if (topicName) break
            }
          }

          const formatted = {
            ...newPlannerItem,
            item: {
              ...newPlannerItem.item,
              route_name: newPlannerItem.route?.name,
              topic_name: topicName,
            },
          }

          setPlannerItems([...plannerItems, formatted])
        }
      } else {
        // Moving existing planner item
        const plannerItem = selectedItem.item
        
        const existingItems = plannerItems.filter(p => 
          p.scheduled_date === dateToSave && p.id !== plannerItem.id
        )
        const newOrder = existingItems.length

        const { error } = await supabase
          .from('study_planner')
          .update({
            scheduled_date: dateToSave,
            day_of_week: dayOfWeek,
            order_index: newOrder,
          })
          .eq('id', plannerItem.id)

        if (error) throw error
      }

      await loadPlannerItems()
      setShowDateModal(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Error assigning item to date:', error)
      alert('Error al asignar item a la fecha')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleComplete = async (plannerItem: PlannerItem) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('study_planner')
        .update({ is_completed: !plannerItem.is_completed })
        .eq('id', plannerItem.id)

      if (error) throw error

      setPlannerItems(plannerItems.map(p => 
        p.id === plannerItem.id ? { ...p, is_completed: !p.is_completed } : p
      ))
    } catch (error) {
      console.error('Error toggling complete:', error)
    }
  }

  const handleRemoveFromCalendar = async (plannerItemId: string) => {
    if (!confirm('¿Eliminar este item del calendario?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('study_planner')
        .delete()
        .eq('id', plannerItemId)

      if (error) throw error

      setPlannerItems(plannerItems.filter(p => p.id !== plannerItemId))
    } catch (error) {
      console.error('Error removing from calendar:', error)
      alert('Error al eliminar del calendario')
    }
  }

  const handleAutoOrganize = async () => {
    if (!confirm('¿Organizar automáticamente todos los subtemas? Esto distribuirá los subtemas disponibles en los próximos días.')) return

    setIsOrganizing(true)
    try {
      const supabase = createClient()
      
      // Get all unscheduled subtopics
      const scheduledItemIds = new Set(plannerItems.map(p => p.item_id))
      const unscheduledSubtopics = allSubtopics.filter(s => !scheduledItemIds.has(s.id))
      
      if (unscheduledSubtopics.length === 0) {
        alert('No hay subtemas sin programar')
        setIsOrganizing(false)
        return
      }

      // Start from today
      let currentDate = new Date()
      let itemsPerDay = 2 // Default: 2 items per day
      
      // Calculate based on estimated time (aim for ~60-90 min per day)
      const totalTime = unscheduledSubtopics.reduce((sum, s) => sum + s.estimated_time, 0)
      const daysNeeded = Math.ceil(totalTime / 90) // Aim for 90 min per day
      itemsPerDay = Math.max(1, Math.ceil(unscheduledSubtopics.length / daysNeeded))

      let dayIndex = 0
      let itemsInCurrentDay = 0
      let currentDayTotalTime = 0

      for (const subtopic of unscheduledSubtopics) {
        // Move to next day if current day is full
        if (itemsInCurrentDay >= itemsPerDay || currentDayTotalTime + subtopic.estimated_time > 120) {
          dayIndex++
          itemsInCurrentDay = 0
          currentDayTotalTime = 0
          currentDate = new Date()
          currentDate.setDate(currentDate.getDate() + dayIndex)
        }

        const dateToSave = getLocalDateString(currentDate)
        const dayOfWeek = currentDate.getDay()

        // Get existing items for this date
        const existingItems = plannerItems.filter(p => p.scheduled_date === dateToSave)
        const newOrder = existingItems.length

        const { error } = await supabase
          .from('study_planner')
          .insert({
            route_id: subtopic.route_id,
            item_id: subtopic.id,
            scheduled_date: dateToSave,
            day_of_week: dayOfWeek,
            order_index: newOrder,
            is_completed: false,
          })

        if (error) {
          console.error('Error inserting planner item:', error)
          continue
        }

        itemsInCurrentDay++
        currentDayTotalTime += subtopic.estimated_time
      }

      await loadPlannerItems()
      alert(`Se organizaron ${unscheduledSubtopics.length} subtemas automáticamente`)
    } catch (error) {
      console.error('Error auto-organizing:', error)
      alert('Error al organizar automáticamente')
    } finally {
      setIsOrganizing(false)
    }
  }

  // Toggle route expansion
  const toggleRoute = (routeId: string) => {
    const newExpanded = new Set(expandedRoutes)
    if (newExpanded.has(routeId)) {
      newExpanded.delete(routeId)
    } else {
      newExpanded.add(routeId)
    }
    setExpandedRoutes(newExpanded)
  }

  // Toggle topic expansion
  const toggleTopic = (topicKey: string) => {
    const newExpanded = new Set(expandedTopics)
    if (newExpanded.has(topicKey)) {
      newExpanded.delete(topicKey)
    } else {
      newExpanded.add(topicKey)
    }
    setExpandedTopics(newExpanded)
  }

  // Calendar setup
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  return (
    <div className="space-y-6">
      {/* Header with Auto-Organize button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Planificador de Estudio
          </h2>
          <p className="text-gray-600 text-sm">Organiza tus subtemas en el calendario</p>
        </div>
        <button
          onClick={handleAutoOrganize}
          disabled={isOrganizing || allSubtopics.length === 0}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
        >
          {isOrganizing ? '⏳ Organizando...' : '⚡ Organizar Automáticamente'}
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Organized Information */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
            <h3 className="text-xl font-bold text-gray-900">Subtemas Disponibles</h3>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
            {routes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay rutas disponibles</p>
            ) : (
              routes.map((route) => {
                const isRouteExpanded = expandedRoutes.has(route.id)
                const routeTopics = route.items.filter(item => item.item_type === 'topic')
                
                return (
                  <div key={route.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-all duration-200">
                    {/* Route Header */}
                    <button
                      onClick={() => toggleRoute(route.id)}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-lg transition-transform ${isRouteExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <h4 className="font-semibold text-gray-900 text-lg">{route.name}</h4>
                      </div>
                      <span className="text-sm text-gray-500">
                        {routeTopics.length} {routeTopics.length === 1 ? 'tema' : 'temas'}
                      </span>
                    </button>
                    
                    {/* Route Topics */}
                    {isRouteExpanded && (
                      <div className="pl-6 pr-3 pb-3 space-y-2">
                        {routeTopics.length === 0 ? (
                          <p className="text-sm text-gray-500 py-2">No hay temas en esta ruta</p>
                        ) : (
                          routeTopics.map((topic) => {
                            const topicKey = `${route.id}-${topic.id}`
                            const isTopicExpanded = expandedTopics.has(topicKey)
                            const topicSubtopics = topic.children?.filter(item => item.item_type === 'subtopic') || []
                            
                            return (
                              <div key={topic.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-purple-300 transition-all duration-200">
                                {/* Topic Header */}
                                <button
                                  onClick={() => toggleTopic(topicKey)}
                                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all duration-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm transition-transform ${isTopicExpanded ? 'rotate-90' : ''}`}>
                                      ▶
                                    </span>
                                    <h5 className="font-medium text-gray-700 text-sm">
                                      {topic.custom_name || 'Sin nombre'}
                                    </h5>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {topicSubtopics.length} {topicSubtopics.length === 1 ? 'subtema' : 'subtemas'}
                                  </span>
                                </button>
                                
                                {/* Topic Subtopics */}
                                {isTopicExpanded && (
                                  <div className="pl-6 pr-2 pb-2 space-y-1">
                                    {topicSubtopics.length === 0 ? (
                                      <p className="text-xs text-gray-500 py-1">No hay subtemas en este tema</p>
                                    ) : (
                                      topicSubtopics.map((subtopic) => {
                                        const isScheduled = plannerItems.some(p => p.item_id === subtopic.id)
                                        return (
                                          <div
                                            key={subtopic.id}
                                            onClick={() => !isScheduled && handleItemClick({
                                              ...subtopic,
                                              route_name: route.name,
                                              route_id: route.id,
                                              topic_name: topic.custom_name || 'Sin nombre',
                                            })}
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                              isScheduled
                                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-white border-gray-200 hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 shadow-sm hover:shadow-md'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className={`text-sm font-semibold ${isScheduled ? 'text-gray-600' : 'text-gray-900'}`}>
                                                {subtopic.custom_name || 'Sin nombre'}
                                              </span>
                                              <div className="flex items-center gap-2 text-xs">
                                                <span className={`px-2 py-1 rounded-lg font-medium ${
                                                  isScheduled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                  ⏱️ {subtopic.estimated_time} min
                                                </span>
                                                {isScheduled && (
                                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg font-bold">
                                                    ✓ Programado
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Calendar */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-gray-900">Calendario</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl hover:from-gray-200 hover:to-gray-300 font-bold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                ←
              </button>
              <span className="px-6 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl font-bold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl hover:from-gray-200 hover:to-gray-300 font-bold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                →
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {WEEK_DAYS.map(day => (
              <div key={day} className="text-center text-sm font-bold text-gray-700 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, idx) => (
              <CalendarDay
                key={idx}
                date={date}
                isCurrentMonth={isSameMonth(date, currentMonth)}
                plannerItems={plannerItems}
                onItemClick={handlePlannerItemClick}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Date Selection Modal */}
      {showDateModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                📅
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedItem.type === 'subtopic' ? 'Asignar Subtema' : 'Cambiar Fecha'}
              </h3>
            </div>
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-l-4 border-indigo-500">
              <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-indigo-500">📚</span> Subtema:
              </p>
              <p className="text-lg font-bold text-gray-900 mb-3">
                {selectedItem.type === 'subtopic' 
                  ? selectedItem.item.custom_name || 'Sin nombre'
                  : selectedItem.item.item?.custom_name || 'Sin nombre'}
              </p>
              {selectedItem.type === 'planner' && (
                <div className="text-xs text-gray-600 space-y-1">
                  {selectedItem.item.item?.route_name && (
                    <p className="font-semibold">📍 Ruta: {selectedItem.item.item.route_name}</p>
                  )}
                  {selectedItem.item.item?.topic_name && (
                    <p className="font-semibold">📖 Tema: {selectedItem.item.item.topic_name}</p>
                  )}
                </div>
              )}
              {selectedItem.type === 'subtopic' && (
                <div className="text-xs text-gray-600 space-y-1">
                  {selectedItem.item.route_name && (
                    <p className="font-semibold">📍 Ruta: {selectedItem.item.route_name}</p>
                  )}
                  {selectedItem.item.topic_name && (
                    <p className="font-semibold">📖 Tema: {selectedItem.item.topic_name}</p>
                  )}
                </div>
              )}
            </div>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-purple-500">📆</span> Fecha
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getLocalDateString(new Date())}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white font-medium"
              />
            </div>
            {selectedItem.type === 'planner' && (
              <div className="mb-6">
                <button
                  onClick={() => handleRemoveFromCalendar(selectedItem.item.id)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  🗑️ Eliminar del Calendario
                </button>
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDateModal(false)
                  setSelectedItem(null)
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignToDate}
                disabled={!selectedDate || isSaving}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {isSaving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

