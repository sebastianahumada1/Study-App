'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isToday, isSameDay, parseISO } from 'date-fns'

// Helper functions to handle dates in user's local timezone
const getLocalDate = (dateString: string): Date => {
  // Parse date string (YYYY-MM-DD) in local timezone
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const getLocalDateString = (date: Date): string => {
  // Format date as YYYY-MM-DD in local timezone
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getTodayLocal = (): string => {
  return getLocalDateString(new Date())
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

type PlannerItem = {
  id: string
  route_id: string
  item_id: string
  day_of_week: number
  order_index: number
  scheduled_date: string | null
  is_completed: boolean
  item: RouteItem
}

type WeeklyPlannerProps = {
  routeId: string
  routeItems: RouteItem[]
}

const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function RouteItemCard({ item, onClick }: { item: RouteItem; onClick: () => void }) {
  const displayName = item.custom_name || 'Sin nombre'

  return (
    <div
      onClick={onClick}
      className="bg-white border-2 border-indigo-300 rounded-lg p-2 mb-2 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all"
    >
      <h4 className="font-semibold text-sm text-gray-900 truncate">{displayName}</h4>
      <div className="flex gap-2 text-xs text-gray-600 mt-1">
        <span>⏱️ {item.estimated_time} min</span>
        <span className={`px-1.5 py-0.5 rounded ${
          item.difficulty === 'baja' ? 'bg-green-100 text-green-700' :
          item.difficulty === 'media' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {item.difficulty}
        </span>
      </div>
    </div>
  )
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
    // Compare date strings directly to avoid timezone issues
    return p.scheduled_date === dateString
  }).sort((a, b) => a.order_index - b.order_index)

  const dayTotalTime = dayItems.reduce((sum, p) => sum + p.item.estimated_time, 0)

  return (
    <div
      className={`min-h-[120px] border border-gray-200 rounded-lg p-2 ${
        !isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white'
      } ${isToday(date) ? 'ring-2 ring-indigo-500' : ''}`}
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
              className={`text-xs p-1.5 rounded border cursor-pointer hover:shadow-md transition-all ${
                plannerItem.is_completed
                  ? 'bg-green-50 border-green-300 line-through text-gray-500'
                  : (plannerItem.item.item_type === 'subtopic' && plannerItem.item.content)
                  ? 'bg-indigo-50 border-indigo-200 text-gray-900 hover:border-indigo-400'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate flex-1">{displayName}</span>
                <input
                  type="checkbox"
                  checked={plannerItem.is_completed}
                  onChange={() => onToggleComplete(plannerItem)}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1 h-3 w-3 text-indigo-600"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WeeklyPlanner({ routeId, routeItems }: WeeklyPlannerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([])
  const [unassignedItems, setUnassignedItems] = useState<RouteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{ type: 'route' | 'planner'; item: RouteItem | PlannerItem } | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedClassItem, setSelectedClassItem] = useState<PlannerItem | null>(null)

  useEffect(() => {
    loadPlannerItems()
  }, [routeId])

  useEffect(() => {
    // Update unassigned items when routeItems or plannerItems change
    const assignedItemIds = new Set(plannerItems.map(p => p.item_id))
    const unassigned = routeItems.filter(item => !assignedItemIds.has(item.id))
    setUnassignedItems(unassigned)
  }, [routeItems, plannerItems])

  const loadPlannerItems = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('study_planner')
        .select(`
          *,
          item:study_route_items(*)
        `)
        .eq('route_id', routeId)

      if (error) throw error

      const formatted = (data || []).map((p: any) => ({
        ...p,
        item: p.item,
      }))

      setPlannerItems(formatted)
    } catch (error) {
      console.error('Error loading planner items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleItemClick = (item: RouteItem | PlannerItem, type: 'route' | 'planner') => {
    // If it's a subtopic or topic with content, show content instead of date modal
    if (type === 'planner' && 'item' in item && (item.item.item_type === 'subtopic' || item.item.item_type === 'topic') && item.item.content) {
      setSelectedClassItem(item as PlannerItem)
      setShowClassModal(true)
      return
    }

    setSelectedItem({ type, item })
    if (type === 'planner' && 'scheduled_date' in item && item.scheduled_date) {
      setSelectedDate(item.scheduled_date)
    } else {
      // Default to today in user's local timezone
      setSelectedDate(getTodayLocal())
    }
    setShowDateModal(true)
  }

  const handleAssignToDate = async () => {
    if (!selectedItem || !selectedDate) return

    setIsSaving(true)

    try {
      const supabase = createClient()
      // Use local date to get correct day of week
      const targetDate = getLocalDate(selectedDate)
      const dayOfWeek = targetDate.getDay()
      
      // Ensure we're using the date string in local timezone
      const dateToSave = getLocalDateString(targetDate)

      if (selectedItem.type === 'route') {
        // Assigning unassigned route item
        const routeItem = selectedItem.item as RouteItem
        
        // Get existing items for this date
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
            item:study_route_items(
              *,
              topic:topics(id, name),
              subtopic:subtopics(id, name)
            )
          `)
          .single()

        if (error) throw error

        const formatted = {
          ...newPlannerItem,
          item: newPlannerItem.item,
        }

        setPlannerItems([...plannerItems, formatted])
      } else {
        // Moving existing planner item
        const plannerItem = selectedItem.item as PlannerItem
        
        // Get existing items for target date
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
      console.error('Error removing item:', error)
      alert('Error al eliminar item')
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
        p.id === plannerItem.id
          ? { ...p, is_completed: !p.is_completed }
          : p
      ))
    } catch (error) {
      console.error('Error toggling complete:', error)
    }
  }

  // Helper to get all subtopic items with content from hierarchical structure
  const getAllClassItems = (items: RouteItem[]): RouteItem[] => {
    const classes: RouteItem[] = []
    for (const item of items) {
      if (item.item_type === 'subtopic' && item.content) {
        classes.push(item)
      }
      if (item.children) {
        classes.push(...getAllClassItems(item.children))
      }
    }
    return classes
  }

  const handleGenerateFromRoute = async () => {
    // Get only class items
    const classItems = getAllClassItems(routeItems)
    
    if (classItems.length === 0) {
      alert('La ruta no tiene clases para planificar. Las clases se crean automáticamente para cada subtema.')
      return
    }

    if (!confirm(`¿Generar planner desde la ruta? Esto distribuirá ${classItems.length} clases en el calendario empezando desde hoy.`)) {
      return
    }

    setIsSaving(true)

    try {
      const supabase = createClient()
      // Get today in user's local timezone
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Delete existing planner items
      await supabase
        .from('study_planner')
        .delete()
        .eq('route_id', routeId)

      // Distribute class items starting from today in local timezone
      const newPlannerItems: any[] = []
      let currentDate = new Date(today)

      for (let i = 0; i < classItems.length; i++) {
        const item = classItems[i]
        const dateStr = getLocalDateString(currentDate)
        const dayOfWeek = currentDate.getDay()

        newPlannerItems.push({
          route_id: routeId,
          item_id: item.id,
          scheduled_date: dateStr,
          day_of_week: dayOfWeek,
          order_index: 0,
          is_completed: false,
        })

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Insert new planner items
      const { data: inserted, error } = await supabase
        .from('study_planner')
        .insert(newPlannerItems)
        .select(`
          *,
          item:study_route_items(
            *,
            topic:topics(id, name),
            subtopic:subtopics(id, name)
          )
        `)

      if (error) throw error

      const formatted = (inserted || []).map((p: any) => ({
        ...p,
        item: p.item,
      }))

      setPlannerItems(formatted)
    } catch (error) {
      console.error('Error generating planner:', error)
      alert('Error al generar planner')
    } finally {
      setIsSaving(false)
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  if (isLoading) {
    return <div className="text-center py-8">Cargando planner...</div>
  }

  const displayName = selectedItem
    ? (selectedItem.type === 'route'
        ? (selectedItem.item as RouteItem).custom_name || 'Sin nombre'
        : ((selectedItem.item as PlannerItem).item.custom_name || 'Sin nombre'))
    : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            →
          </button>
        </div>
        <button
          onClick={handleGenerateFromRoute}
          disabled={isSaving || routeItems.length === 0}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold"
        >
          {isSaving ? 'Guardando...' : 'Distribuir desde Hoy'}
        </button>
      </div>

      {isSaving && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-sm">
          Guardando cambios...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Unassigned Items Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4 sticky top-4">
            <h3 className="font-bold text-gray-900 mb-4">Items sin Asignar</h3>
            {unassignedItems.length === 0 ? (
              <p className="text-sm text-gray-500">Todos los items están asignados</p>
            ) : (
              <div className="space-y-2">
                {unassignedItems.map((item) => (
                  <RouteItemCard
                    key={item.id}
                    item={item}
                    onClick={() => handleItemClick(item, 'route')}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg p-4">
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="text-center font-semibold text-gray-700 text-sm py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((date) => (
                <CalendarDay
                  key={format(date, 'yyyy-MM-dd')}
                  date={date}
                  isCurrentMonth={isSameMonth(date, currentMonth)}
                  plannerItems={plannerItems}
                  onItemClick={(item) => handleItemClick(item, 'planner')}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Date Selection Modal */}
      {showDateModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {selectedItem.type === 'route' ? 'Asignar Item' : 'Mover Item'}
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Item:</strong> {displayName}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona la fecha:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                min={getTodayLocal()}
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleAssignToDate}
                disabled={isSaving || !selectedDate}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold"
              >
                {isSaving ? 'Guardando...' : selectedItem.type === 'route' ? 'Asignar' : 'Mover'}
              </button>
              {selectedItem.type === 'planner' && (
                <button
                  onClick={async () => {
                    if (confirm('¿Eliminar este item del calendario?')) {
                      await handleRemoveFromCalendar((selectedItem.item as PlannerItem).id)
                      setShowDateModal(false)
                      setSelectedItem(null)
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={() => {
                  setShowDateModal(false)
                  setSelectedItem(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
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
                {selectedClassItem.item.custom_name || 'Clase'}
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
              {selectedClassItem.item.content ? (
                <div 
                  className="text-gray-700"
                  dangerouslySetInnerHTML={{ __html: selectedClassItem.item.content }}
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
    </div>
  )
}

