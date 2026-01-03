'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/client'

type Attempt = {
  id: string
  user_answer: string
  is_correct: boolean
  error_type: string | null
  feedback: string | null
  conclusion: string | null
  created_at: string
  session_id: string | null
  time_spent: number | null
  route_name?: string
  questions: {
    id: string
    prompt: string
    answer_key: string
    explanation: string | null
    options: string[] | null
    topic_name: string | null
    subtopic_name: string | null
  }
  feynman_reasonings?: Array<{
    id: string
    user_reasoning: string
    ai_feedback: string | null
    technique_1_feedback: string | null
    technique_2_feedback: string | null
  }> | null
}

type DashboardErroresClientProps = {
  attempts: Attempt[]
}

export default function DashboardErroresClient({ attempts: initialAttempts }: DashboardErroresClientProps) {
  const [attempts, setAttempts] = useState(initialAttempts || [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  
  // Filter states
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filterRoute, setFilterRoute] = useState<string>('')
  const [filterTopic, setFilterTopic] = useState<string>('')
  const [filterError, setFilterError] = useState<string>('')
  
  // Debug: log attempts on mount and when they change
  useEffect(() => {
    console.log('DashboardErroresClient: Received attempts:', attempts.length)
    console.log('DashboardErroresClient: initialAttempts:', initialAttempts?.length || 0)
    if (attempts.length === 0 && initialAttempts && initialAttempts.length > 0) {
      console.warn('DashboardErroresClient: initialAttempts has data but attempts is empty!')
      setAttempts(initialAttempts)
    }
    // Debug feynman_reasonings
    if (attempts.length > 0) {
      const attemptsWithFeynman = attempts.filter(a => 
        a.feynman_reasonings && Array.isArray(a.feynman_reasonings) && a.feynman_reasonings.length > 0
      )
      console.log('DashboardErroresClient: Attempts with feynman_reasonings:', attemptsWithFeynman.length)
    }
  }, [initialAttempts, attempts])

  // Get unique values for filters
  const uniqueRoutes = Array.from(new Set(attempts.map(a => a.route_name).filter((r): r is string => Boolean(r))))
  const uniqueTopics = Array.from(new Set(attempts.map(a => a.questions?.topic_name).filter((t): t is string => Boolean(t))))
  const uniqueErrors = Array.from(new Set(attempts.map(a => a.error_type).filter((e): e is string => Boolean(e))))

  // Filter attempts
  const filteredAttempts = attempts.filter(attempt => {
    // Date range filter
    if (filterDateFrom) {
      const attemptDate = new Date(attempt.created_at)
      const fromDate = new Date(filterDateFrom)
      if (attemptDate < fromDate) return false
    }
    if (filterDateTo) {
      const attemptDate = new Date(attempt.created_at)
      const toDate = new Date(filterDateTo)
      toDate.setHours(23, 59, 59, 999) // Include the entire day
      if (attemptDate > toDate) return false
    }

    // Route filter
    if (filterRoute && attempt.route_name !== filterRoute) return false

    // Topic filter
    if (filterTopic && attempt.questions?.topic_name !== filterTopic) return false

    // Error filter
    if (filterError && attempt.error_type !== filterError) return false

    return true
  })

  const handleClearFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterRoute('')
    setFilterTopic('')
    setFilterError('')
  }
  const [editForm, setEditForm] = useState({
    error_type: '',
    feedback: '',
    conclusion: '',
  })

  const handleEdit = (attempt: Attempt) => {
    setEditingId(attempt.id)
    // If the attempt is correct, automatically set error_type to "No Aplica"
    const errorType = attempt.is_correct ? 'No Aplica' : (attempt.error_type || '')
    setEditForm({
      error_type: errorType,
      feedback: attempt.feedback || '',
      conclusion: attempt.conclusion || '',
    })
  }

  const handleSave = async (attemptId: string) => {
    try {
      const supabase = createClient()
      
      // Find the attempt to check if it's correct
      const attempt = attempts.find(a => a.id === attemptId)
      if (!attempt) {
        alert('Error: No se encontró el intento')
        return
      }

      // If the attempt is correct, force error_type to "No Aplica"
      const errorType = attempt.is_correct ? 'No Aplica' : (editForm.error_type || null)
      
      const { data, error } = await supabase
        .from('attempts')
        .update({
          error_type: errorType,
          feedback: editForm.feedback || null,
          conclusion: editForm.conclusion || null,
        })
        .eq('id', attemptId)
        .select()

      if (error) {
        console.error('DashboardErrores: Error saving:', error)
        alert(`Error al guardar los cambios: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        console.error('DashboardErrores: No data returned from update')
        alert('Error: No se pudo actualizar el intento')
        return
      }

      // Update local state
      setAttempts(attempts.map(a => 
        a.id === attemptId 
          ? { 
              ...a, 
              error_type: errorType,
              feedback: editForm.feedback || null,
              conclusion: editForm.conclusion || null,
            }
          : a
      ))
      setEditingId(null)
      console.log('DashboardErrores: Successfully saved changes for attempt:', attemptId)
    } catch (error) {
      console.error('DashboardErrores: Exception saving:', error)
      alert(`Error al guardar los cambios: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
  }


  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-[95vw] mx-auto">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-red-600 via-pink-600 to-orange-600 bg-clip-text text-transparent mb-2">
              Dashboard de Errores
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Incluye cada pregunta de práctica. Identifica en qué estás fallando y cómo evitar cometer los mismos errores.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 hover:shadow-md transition-all duration-200 border border-indigo-100"
            >
              🏠 Inicio
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Filters Section */}
        {attempts.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                🔍
              </div>
              <h2 className="text-xl font-bold text-gray-900">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-indigo-500">📅</span> Fecha Desde
                </label>
                <input
                  type="date"
                  value={filterDateFrom || ''}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-indigo-500">📅</span> Fecha Hasta
                </label>
                <input
                  type="date"
                  value={filterDateTo || ''}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium"
                />
              </div>
              {/* Route Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-purple-500">🗺️</span> Ruta
                </label>
                <select
                  value={filterRoute}
                  onChange={(e) => setFilterRoute(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white font-medium cursor-pointer"
                >
                  <option value="">Todas las rutas</option>
                  {uniqueRoutes.map(route => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                </select>
              </div>
              {/* Topic Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-pink-500">📚</span> Tema
                </label>
                <select
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all duration-200 bg-white font-medium cursor-pointer"
                >
                  <option value="">Todos los temas</option>
                  {uniqueTopics.map(topic => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </div>
              {/* Error Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-red-500">⚠️</span> Tipo de Error
                </label>
                <select
                  value={filterError}
                  onChange={(e) => setFilterError(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200 bg-white font-medium cursor-pointer"
                >
                  <option value="">Todos los errores</option>
                  {uniqueErrors.map(error => (
                    <option key={error} value={error}>{error}</option>
                  ))}
                </select>
              </div>
              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full px-4 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl hover:from-gray-500 hover:to-gray-600 font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  🗑️ Limpiar Filtros
                </button>
              </div>
            </div>
            {/* Results count */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Mostrando <span className="font-bold text-indigo-600">{filteredAttempts.length}</span> de <span className="font-bold text-gray-900">{attempts.length}</span> registros
              </p>
            </div>
          </div>
        )}

        {attempts.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Aún no has realizado preguntas
            </h2>
            <p className="text-gray-600 mb-6">
              Comienza a practicar para llenar este dashboard.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/banco-preguntas"
                className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                📝 Banco de Preguntas
              </Link>
              <Link
                href="/study"
                className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                ✍️ Simulacro
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                      📅 Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                      🗺️ Ruta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                      📚 Tema
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                      🔖 Subtema
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                      ✅ Correcta?
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                      Error
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r min-w-[200px] max-w-[250px]">
                      Feedback
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r min-w-[180px] max-w-[220px]">
                      Conclusión
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r w-20">
                      🧠 Razonamiento
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r w-20">
                      🤖 Feedback Feynman
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAttempts.map((attempt) => {
                    const isEditing = editingId === attempt.id
                    const fecha = formatDate(attempt.created_at)
                    const ruta = attempt.route_name || 'Sin ruta'
                    const tema = attempt.questions?.topic_name || 'Sin tema'
                    const subtema = attempt.questions?.subtopic_name || 'Sin subtema'

                    return (
                      <tr key={attempt.id} className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${isEditing ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 border-r font-medium">
                          {fecha}
                        </td>
                        <td className="px-4 py-3 text-gray-900 border-r">
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-medium text-xs">
                            {ruta}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 border-r">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium text-xs">
                            {tema}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 border-r">
                          <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-lg font-medium text-xs">
                            {subtema}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center border-r">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${attempt.is_correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {attempt.is_correct ? '✓' : '✗'}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-r">
                          {isEditing ? (
                            <select
                              value={attempt.is_correct ? 'No Aplica' : editForm.error_type}
                              onChange={(e) => {
                                // If attempt is correct, don't allow changing error_type
                                if (!attempt.is_correct) {
                                  setEditForm({ ...editForm, error_type: e.target.value })
                                }
                              }}
                              disabled={attempt.is_correct}
                              className={`w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 ${
                                attempt.is_correct ? 'bg-gray-100 cursor-not-allowed' : ''
                              }`}
                            >
                              <option value="">Seleccionar...</option>
                              <option value="No Aplica">No Aplica</option>
                              <option value="Conocimiento">Conocimiento</option>
                              <option value="Análisis">Análisis</option>
                              <option value="Errores bobos">Errores bobos</option>
                            </select>
                          ) : (
                            <span className={attempt.error_type ? '' : 'text-gray-400 italic'}>
                              {attempt.is_correct ? 'No Aplica' : (attempt.error_type || 'Sin clasificar')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r min-w-[200px] max-w-[250px]">
                          {isEditing ? (
                            <textarea
                              value={editForm.feedback}
                              onChange={(e) => setEditForm({ ...editForm, feedback: e.target.value })}
                              placeholder={`i. ¿Qué fue lo que pasó?
ii. ¿Cómo te sientes y qué piensas sobre la experiencia?
iii. ¿Qué evaluación haces de la experiencia?
iv. ¿Qué análisis haces para que la situación tenga sentido?
v. ¿Qué conclusiones sacas sobre lo que aprendiste y lo que hubieras podido hacer diferente?
vi. ¿Cuál sería tu plan de acción en un futuro para lidiar con situaciones similares?`}
                              rows={6}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                  const textarea = e.target as HTMLTextAreaElement
                                  const start = textarea.selectionStart
                                  const end = textarea.selectionEnd
                                  const value = textarea.value
                                  textarea.value = value.substring(0, start) + '\n' + value.substring(end)
                                  textarea.selectionStart = textarea.selectionEnd = start + 1
                                  e.preventDefault()
                                }
                              }}
                            />
                          ) : (
                            <div className="max-h-24 overflow-y-auto text-xs">
                              <span className={attempt.feedback ? 'whitespace-pre-wrap break-words' : 'text-gray-400 italic'}>
                                {attempt.feedback || 'Sin feedback'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r min-w-[180px] max-w-[220px]">
                          {isEditing ? (
                            <textarea
                              value={editForm.conclusion}
                              onChange={(e) => setEditForm({ ...editForm, conclusion: e.target.value })}
                              placeholder="Resume en un par de frases lo que la pregunta te enseñó..."
                              rows={3}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                            />
                          ) : (
                            <div className="max-h-20 overflow-y-auto">
                              <span className={`text-xs break-words ${attempt.conclusion ? 'font-medium text-indigo-700' : 'text-gray-400 italic'}`}>
                                {attempt.conclusion || 'Sin conclusión'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 border-r text-center w-20">
                          <span 
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                              attempt.feynman_reasonings && attempt.feynman_reasonings.length > 0 && attempt.feynman_reasonings[0].user_reasoning
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                            title={attempt.feynman_reasonings && attempt.feynman_reasonings.length > 0 && attempt.feynman_reasonings[0].user_reasoning ? 'Tiene razonamiento' : 'Sin razonamiento'}
                          >
                            {attempt.feynman_reasonings && attempt.feynman_reasonings.length > 0 && attempt.feynman_reasonings[0].user_reasoning ? '✓' : '✗'}
                          </span>
                        </td>
                        <td className="px-2 py-3 border-r text-center w-20">
                          <span 
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                              attempt.feynman_reasonings && attempt.feynman_reasonings.length > 0 && attempt.feynman_reasonings[0].ai_feedback
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                            title={attempt.feynman_reasonings && attempt.feynman_reasonings.length > 0 && attempt.feynman_reasonings[0].ai_feedback ? 'Tiene feedback Feynman' : 'Sin feedback Feynman'}
                          >
                            {attempt.feynman_reasonings && attempt.feynman_reasonings.length > 0 && attempt.feynman_reasonings[0].ai_feedback ? '✓' : '✗'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleSave(attempt.id)}
                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              >
                                💾 Guardar
                              </button>
                              <button
                                onClick={handleCancel}
                                className="px-4 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl hover:from-gray-500 hover:to-gray-600 font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              >
                                ✖️ Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  setSelectedAttempt(attempt)
                                  setShowQuestionModal(true)
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:from-blue-600 hover:to-cyan-700 font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              >
                                👁️ Ver Pregunta
                              </button>
                              <button
                                onClick={() => handleEdit(attempt)}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                              >
                                ✏️ Editar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Question Detail Modal */}
        {showQuestionModal && selectedAttempt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    ❓
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Detalles de la Pregunta</h2>
                </div>
                <button
                  onClick={() => {
                    setShowQuestionModal(false)
                    setSelectedAttempt(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  ✕ Cerrar
                </button>
              </div>

              {/* Question Info */}
              <div className="mb-6 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold text-xs">
                    🗺️ {selectedAttempt.route_name || 'Sin ruta'}
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-semibold text-xs">
                    📚 {selectedAttempt.questions?.topic_name || 'Sin tema'}
                  </span>
                  <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-lg font-semibold text-xs">
                    🔖 {selectedAttempt.questions?.subtopic_name || 'Sin subtema'}
                  </span>
                  <span className={`px-3 py-1 rounded-lg font-semibold text-xs ${
                    selectedAttempt.is_correct 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedAttempt.is_correct ? '✅ Correcta' : '❌ Incorrecta'}
                  </span>
                  {selectedAttempt.time_spent && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold text-xs">
                      ⏱️ {selectedAttempt.time_spent}s
                    </span>
                  )}
                </div>
              </div>

              {/* Question Prompt */}
              <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border-l-4 border-indigo-500">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Pregunta:</h3>
                <p className="text-gray-800 leading-relaxed">{selectedAttempt.questions?.prompt}</p>
              </div>

              {/* Options */}
              {selectedAttempt.questions?.options && selectedAttempt.questions.options.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Opciones:</h3>
                  <div className="space-y-3">
                    {selectedAttempt.questions.options.map((option, index) => {
                      const letter = String.fromCharCode(65 + index)
                      // Handle both formats: letter (A, B, C, D) or full option text
                      const userAnswerNormalized = selectedAttempt.user_answer?.toUpperCase().trim() || ''
                      const isUserAnswer = 
                        option === selectedAttempt.user_answer || // Full text match (legacy)
                        (userAnswerNormalized.length === 1 && letter.toUpperCase() === userAnswerNormalized) // Letter match (new format)
                      
                      // Compare answer_key (should be a letter)
                      const correctAnswerNormalized = selectedAttempt.questions?.answer_key?.toUpperCase().trim() || ''
                      const isCorrectAnswer = letter.toUpperCase() === correctAnswerNormalized
                      
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                            isCorrectAnswer
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md'
                              : isUserAnswer && !isCorrectAnswer
                              ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-400 shadow-md'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isCorrectAnswer
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                                : isUserAnswer && !isCorrectAnswer
                                ? 'bg-gradient-to-br from-red-500 to-pink-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {letter}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${
                                isCorrectAnswer || isUserAnswer ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {option}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              {isCorrectAnswer && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-xs">
                                  ✓ Correcta
                                </span>
                              )}
                              {isUserAnswer && !isCorrectAnswer && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-bold text-xs">
                                  Tu respuesta
                                </span>
                              )}
                              {isUserAnswer && isCorrectAnswer && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-xs">
                                  Tu respuesta ✓
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {selectedAttempt.questions?.explanation && (
                <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-l-4 border-blue-500">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Explicación:</h3>
                  <p className="text-gray-800 leading-relaxed">{selectedAttempt.questions.explanation}</p>
                </div>
              )}

              {/* Feynman Reasoning and Feedback */}
              {selectedAttempt.feynman_reasonings && selectedAttempt.feynman_reasonings.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border-l-4 border-indigo-500">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <span>🧠</span> Tu Razonamiento
                    </h3>
                    <p className="text-gray-800 leading-relaxed italic">{selectedAttempt.feynman_reasonings[0].user_reasoning}</p>
                  </div>

                  {selectedAttempt.feynman_reasonings[0].ai_feedback && (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-l-4 border-blue-500">
                        <h3 className="text-lg font-bold text-blue-700 mb-2">Técnica 1: Descarte de Primeros Principios</h3>
                        <p className="text-gray-800 leading-relaxed">{selectedAttempt.feynman_reasonings[0].technique_1_feedback || 'N/A'}</p>
                      </div>
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-l-4 border-purple-500">
                        <h3 className="text-lg font-bold text-purple-700 mb-2">Técnica 2: Reverse Engineering del Error</h3>
                        <p className="text-gray-800 leading-relaxed">{selectedAttempt.feynman_reasonings[0].technique_2_feedback || 'N/A'}</p>
                      </div>
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border-l-4 border-indigo-500">
                        <h3 className="text-lg font-bold text-indigo-700 mb-2">Resumen y Recomendaciones</h3>
                        <p className="text-gray-800 leading-relaxed">{selectedAttempt.feynman_reasonings[0].ai_feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </main>
  )
}
