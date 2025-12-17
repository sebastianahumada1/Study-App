'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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
    content?: string | null
    children?: Array<{
      id: string
      item_type: 'topic' | 'subtopic'
      custom_name: string | null
      content?: string | null
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
  lastMessage?: {
    content: string
    created_at: string
    role: 'user' | 'assistant'
  }
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type TutorClientProps = {
  userId: string
  routes: Route[]
  sessions: TutorSession[]
}

type ViewState = 'list' | 'create' | 'chat'

export default function TutorClient({ userId, routes: initialRoutes, sessions: initialSessions }: TutorClientProps) {
  const searchParams = useSearchParams()
  const [view, setView] = useState<ViewState>('list')
  const [sessions, setSessions] = useState<TutorSession[]>(initialSessions)
  const [selectedSession, setSelectedSession] = useState<TutorSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Form state
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>('')
  const [tutorRole, setTutorRole] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')
  const [context, setContext] = useState<string>('')
  const [objective, setObjective] = useState<string>('')

  // Get selected route
  const selectedRoute = initialRoutes.find(r => r.id === selectedRouteId)
  const availableTopics = selectedRoute?.items.filter(item => item.item_type === 'topic') || []
  const selectedTopic = availableTopics.find(t => t.id === selectedTopicId)
  const availableSubtopics = selectedTopic?.children?.filter(item => item.item_type === 'subtopic') || []

  // Auto-fill tutor role based on selection
  useEffect(() => {
    if (selectedSubtopicId && selectedTopic) {
      const subtopic = availableSubtopics.find(s => s.id === selectedSubtopicId)
      if (subtopic) {
        setTutorRole(`Especialista en ${selectedRoute?.name || ''} - ${selectedTopic.custom_name || ''} - ${subtopic.custom_name || ''}`)
      }
    } else if (selectedTopicId && selectedTopic) {
      setTutorRole(`Especialista en ${selectedRoute?.name || ''} - ${selectedTopic.custom_name || ''}`)
    } else if (selectedRouteId && selectedRoute) {
      setTutorRole(`Especialista en ${selectedRoute.name}`)
    } else {
      setTutorRole('')
    }
  }, [selectedRouteId, selectedTopicId, selectedSubtopicId, selectedRoute, selectedTopic, availableSubtopics])

  // Load messages when session is selected
  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession.id)
    }
  }, [selectedSession])

  // Auto-select session from query params
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('sessionId')
    if (sessionIdFromUrl) {
      // First check if session exists in current sessions
      let session = sessions.find(s => s.id === sessionIdFromUrl)
      
      if (session) {
        setSelectedSession(session)
        setView('list')
      } else {
        // If not found, try to fetch it from database
        const loadSessionFromDb = async () => {
          try {
            const supabase = createClient()
            const { data: sessionData, error } = await supabase
              .from('tutor_sessions')
              .select('*')
              .eq('id', sessionIdFromUrl)
              .eq('user_id', userId)
              .single()
            
            if (!error && sessionData) {
              // Enrich with route/topic/subtopic names if needed
              const enrichedSession: TutorSession = {
                ...sessionData,
                route_name: sessionData.route_id ? 'Ruta' : undefined,
                topic_name: sessionData.topic_id ? 'Tema' : undefined,
                subtopic_name: sessionData.subtopic_id ? 'Subtema' : undefined,
              }
              
              setSessions(prev => [enrichedSession, ...prev])
              setSelectedSession(enrichedSession)
              setView('list')
            }
          } catch (error) {
            console.error('Error loading session from DB:', error)
          }
        }
        
        loadSessionFromDb()
      }
    }
  }, [searchParams, sessions, userId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load last messages for all sessions on mount and when sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      loadLastMessages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length])

  const loadLastMessages = async () => {
    try {
      const supabase = createClient()
      const sessionIds = sessions.map(s => s.id)
      if (sessionIds.length === 0) return

      const { data: lastMessages, error } = await supabase
        .from('tutor_messages')
        .select('session_id, content, created_at, role')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Tutor: Error loading last messages:', error)
        return
      }

      // Group by session_id and get the most recent for each
      const lastMessageMap = new Map<string, { content: string; created_at: string; role: 'user' | 'assistant' }>()
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.session_id)) {
          lastMessageMap.set(msg.session_id, {
            content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
            created_at: msg.created_at,
            role: msg.role as 'user' | 'assistant'
          })
        }
      })

      // Update sessions with last messages
      setSessions(prev => prev.map(session => ({
        ...session,
        lastMessage: lastMessageMap.get(session.id)
      })))
    } catch (error) {
      console.error('Tutor: Error loading last messages:', error)
    }
  }

  const loadMessages = async (sessionId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tutor_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Tutor: Error loading messages:', error)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.error('Tutor: Error loading messages:', error)
    }
  }

  const getRelativeDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `hace ${diffMins} min`
    if (diffHours < 24) return `hace ${diffHours} h`
    if (diffDays === 1) return 'Ayer'
    if (diffDays < 7) return `hace ${diffDays} d`
    
    // For older dates, show date
    const day = date.getDate()
    const month = date.toLocaleDateString('es-ES', { month: 'short' })
    return `${day} ${month}`
  }

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <span className="w-3 h-3 bg-green-500 rounded-full inline-block mr-2"></span>
      case 'created':
        return <span className="w-3 h-3 bg-yellow-500 rounded-full inline-block mr-2"></span>
      case 'completed':
        return <span className="w-3 h-3 bg-gray-400 rounded-full inline-block mr-2"></span>
      default:
        return <span className="w-3 h-3 bg-gray-400 rounded-full inline-block mr-2"></span>
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'created':
        return 'Creado'
      case 'in_progress':
        return 'En Progreso'
      case 'completed':
        return 'Completado'
      default:
        return status
    }
  }

  const generateInitialMessage = async (session: TutorSession) => {
    try {
      setIsLoading(true)
      
      // Build initial prompt for the tutor
      let initialPrompt = 'Hola! '
      
      if (session.subtopic_name) {
        initialPrompt += `Vamos a trabajar en el subtema "${session.subtopic_name}"`
        if (session.topic_name) {
          initialPrompt += ` del tema "${session.topic_name}"`
        }
        initialPrompt += '. '
      } else if (session.topic_name) {
        initialPrompt += `Vamos a trabajar en el tema "${session.topic_name}". `
      } else if (session.route_name) {
        initialPrompt += `Vamos a trabajar en la ruta "${session.route_name}". `
      }
      
      initialPrompt += '¿Qué tema específico te gustaría estudiar hoy? Puedo sugerirte algunos temas relacionados o puedes proponer el tema que quieras abordar.'

      const response = await fetch('/api/ai/tutor-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          message: initialPrompt,
          conversationHistory: [],
          isInitialMessage: true,
        }),
      })

      if (!response.ok) {
        console.error('Tutor: Error generating initial message')
        return
      }

      const data = await response.json()
      
      // Reload messages to show the initial message
      await loadMessages(session.id)
      await loadLastMessages() // Refresh last messages
    } catch (error) {
      console.error('Tutor: Error generating initial message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSession = async () => {
    if (!tutorRole || !userRole || !context || !objective) {
      alert('Por favor completa todos los campos')
      return
    }

    setIsCreating(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tutor_sessions')
        .insert({
          user_id: userId,
          route_id: selectedRouteId || null,
          topic_id: selectedTopicId || null,
          subtopic_id: selectedSubtopicId || null,
          tutor_role: tutorRole,
          user_role: userRole,
          context: context,
          objective: objective,
          status: 'created',
        })
        .select()
        .single()

      if (error) {
        console.error('Tutor: Error creating session:', error)
        alert('Error al crear la sesión')
        return
      }

      // Enrich session with route/topic/subtopic names
      const enrichedSession: TutorSession = {
        ...data,
        route_name: selectedRoute?.name || 'Sin ruta',
        topic_name: selectedTopic?.custom_name || undefined,
        subtopic_name: availableSubtopics.find(s => s.id === selectedSubtopicId)?.custom_name || undefined,
      }

      setSessions([enrichedSession, ...sessions])
      setSelectedSession(enrichedSession)
      setView('list')
      
      // Generate initial tutor message
      await generateInitialMessage(enrichedSession)
      
      // Reset form
      setSelectedRouteId('')
      setSelectedTopicId('')
      setSelectedSubtopicId('')
      setUserRole('')
      setContext('')
      setObjective('')
    } catch (error) {
      console.error('Tutor: Error creating session:', error)
      alert('Error al crear la sesión')
    } finally {
      setIsCreating(false)
    }
  }

  const handleContinueSession = (session: TutorSession) => {
    setSelectedSession(session)
    setView('list')
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedSession || isLoading) return

    const userMessage = currentMessage.trim()
    setCurrentMessage('')
    setIsLoading(true)

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      // Build conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch('/api/ai/tutor-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          message: userMessage,
          conversationHistory,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al enviar mensaje')
      }

      const data = await response.json()

      // Add assistant response immediately
      const tempAssistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => {
        const withoutTemp = prev.filter(m => !m.id.startsWith('temp'))
        return [...withoutTemp, tempUserMessage, tempAssistantMessage]
      })

      // Reload messages to get real IDs from database
      await loadMessages(selectedSession.id)
      await loadLastMessages() // Refresh last messages

      // Update session if completed
      if (data.shouldComplete) {
        const updatedSessions = sessions.map(s =>
          s.id === selectedSession.id
            ? { ...s, status: 'completed' as const, anchor_recommendation: data.anchorRecommendation }
            : s
        )
        setSessions(updatedSessions)
        setSelectedSession(updatedSessions.find(s => s.id === selectedSession.id) || null)
      } else {
        // Update to in_progress if it was created
        const updatedSessions = sessions.map(s =>
          s.id === selectedSession.id && s.status === 'created'
            ? { ...s, status: 'in_progress' as const }
            : s
        )
        setSessions(updatedSessions)
        setSelectedSession(updatedSessions.find(s => s.id === selectedSession.id) || null)
      }
    } catch (error) {
      console.error('Tutor: Error sending message:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      // Remove temp message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp')))
    } finally {
      setIsLoading(false)
    }
  }

  // Create view
  if (view === 'create') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Crear Sesión de Tutor
              </h1>
              <p className="text-gray-600 text-sm md:text-base">Configura tu sesión de tutoría personalizada</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('list')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:shadow-md transition-all duration-200 border-2 border-indigo-600 shadow-sm"
              >
                ← Volver
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:shadow-md transition-all duration-200 border-2 border-indigo-600 shadow-sm"
              >
                🏠 Inicio
              </Link>
              <LogoutButton />
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
            <div className="space-y-6">
              {/* Route Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-indigo-500 text-xl">📍</span> Ruta de Estudio (Opcional)
                </label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => {
                    setSelectedRouteId(e.target.value)
                    setSelectedTopicId('')
                    setSelectedSubtopicId('')
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-indigo-300 cursor-pointer"
                >
                  <option value="">Selecciona una ruta (opcional)</option>
                  {initialRoutes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Selection */}
              {selectedRouteId && availableTopics.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-purple-500 text-xl">📚</span> Tema (Opcional)
                  </label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => {
                      setSelectedTopicId(e.target.value)
                      setSelectedSubtopicId('')
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-purple-300 cursor-pointer"
                  >
                    <option value="">Selecciona un tema (opcional)</option>
                    {availableTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.custom_name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subtopic Selection */}
              {selectedTopicId && availableSubtopics.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-pink-500 text-xl">🔖</span> Subtema (Opcional)
                  </label>
                  <select
                    value={selectedSubtopicId}
                    onChange={(e) => setSelectedSubtopicId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-pink-300 cursor-pointer"
                  >
                    <option value="">Selecciona un subtema (opcional)</option>
                    {availableSubtopics.map((subtopic) => (
                      <option key={subtopic.id} value={subtopic.id}>
                        {subtopic.custom_name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tutor Role (Auto-filled) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-blue-500 text-xl">👨‍🏫</span> Rol del Tutor *
                </label>
                <input
                  type="text"
                  value={tutorRole}
                  onChange={(e) => setTutorRole(e.target.value)}
                  placeholder="Especialista en..."
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white font-medium text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-2">Se completa automáticamente según tu selección, pero puedes editarlo</p>
              </div>

              {/* User Role */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-indigo-500 text-xl">👤</span> Tu Rol *
                </label>
                <input
                  type="text"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  placeholder="Ej: Estudiante de medicina, Residente de primer año..."
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium text-gray-900"
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-purple-500 text-xl">🌍</span> Contexto *
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Describe el contexto en el que te encuentras. Ej: Estoy estudiando para el examen de residencia médica, necesito entender conceptos de fisiología..."
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white font-medium text-gray-900 resize-none"
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-green-500 text-xl">🎯</span> Objetivo *
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="¿Qué quieres lograr en esta sesión? Ej: Entender cómo funciona el sistema cardiovascular, Aprender a diagnosticar diabetes tipo 2..."
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-white font-medium text-gray-900 resize-none"
                />
              </div>

              <button
                onClick={handleCreateSession}
                disabled={isCreating || !tutorRole || !userRole || !context || !objective}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 border-2 border-blue-700"
              >
                {isCreating ? '⏳ Creando...' : '🚀 Crear Sesión'}
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Main WhatsApp-style layout
  return (
    <main className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Tutor IA</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('create')}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-all duration-200 shadow-sm"
          >
            ➕ Nueva Sesión
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-all duration-200 shadow-sm"
          >
            🏠 Inicio
          </Link>
          <button
            onClick={() => {
              const supabase = createClient()
              supabase.auth.signOut().then(() => {
                window.location.href = '/'
              })
            }}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-all duration-200 shadow-sm"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Sessions list - 30% width */}
        <div className="flex flex-col flex-shrink-0 flex-grow-0 w-full md:w-[30%] border-r border-gray-300 bg-white">
          {/* Sessions list header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-800">Sesiones</h2>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-5xl mb-4">👨‍🏫</div>
                <p className="text-gray-600 font-medium mb-2">No tienes sesiones</p>
                <p className="text-sm text-gray-500 mb-4">Crea tu primera sesión para comenzar</p>
                <button
                  onClick={() => setView('create')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all"
                >
                  Crear Sesión
                </button>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleContinueSession(session)}
                  className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedSession?.id === session.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">👨‍🏫</span>
                        <h3 className="font-bold text-gray-900 truncate">{session.tutor_role}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {getStatusIndicator(session.status)}
                        <span>{getStatusText(session.status)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {getRelativeDate(session.updated_at)}
                    </span>
                  </div>
                  {session.lastMessage && (
                    <p className="text-sm text-gray-600 truncate mt-2">
                      {session.lastMessage.role === 'user' ? 'Tú: ' : ''}
                      {session.lastMessage.content}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Chat or Welcome - 70% width - Always visible */}
        <div className="flex flex-col flex-shrink-0 flex-grow-0 w-full md:w-[70%] bg-gray-50 overflow-hidden">
          {!selectedSession ? (
            // Welcome message
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="text-7xl mb-6">👨‍🏫</div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Bienvenido a Tutor IA</h2>
                <p className="text-gray-600 mb-6">
                  Selecciona una sesión de la lista para comenzar a chatear con tu tutor, o crea una nueva sesión para empezar.
                </p>
                <button
                  onClick={() => setView('create')}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  ➕ Crear Nueva Sesión
                </button>
              </div>
            </div>
          ) : (
            // Chat view
            <>
              {/* Chat header */}
              <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👨‍🏫</span>
                  <div>
                    <h2 className="font-bold text-gray-900">{selectedSession.tutor_role}</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {getStatusIndicator(selectedSession.status)}
                      <span>{getStatusText(selectedSession.status)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedSession(null)
                    setMessages([])
                  }}
                  className="hidden px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Cerrar chat"
                >
                  ←
                </button>
              </div>

              {/* Messages area - scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">👨‍🏫</div>
                    <p className="text-gray-600 font-medium">Comienza la conversación con tu tutor</p>
                    <p className="text-sm text-gray-500 mt-2">El tutor te guiará para que llegues a la respuesta correcta</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl p-3 ${
                          message.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-900 shadow-sm rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-indigo-100' : 'text-gray-500'}`}>
                          {new Date(message.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-900 shadow-sm rounded-2xl rounded-bl-sm p-3">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        <span className="text-sm text-gray-600">El tutor está pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Anchor Recommendation */}
              {selectedSession.status === 'completed' && selectedSession.anchor_recommendation && (
                <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-200 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900 mb-1">🎯 Recomendación de Anclaje:</p>
                  <p className="text-sm text-gray-800">{selectedSession.anchor_recommendation}</p>
                </div>
              )}

              {/* Input area - fixed at bottom */}
              {selectedSession.status !== 'completed' && (
                <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder="Escribe un mensaje..."
                      disabled={isLoading}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-full focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-gray-50 font-medium text-gray-900 disabled:opacity-50 outline-none"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isLoading || !currentMessage.trim()}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <span className="text-xl">➤</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
