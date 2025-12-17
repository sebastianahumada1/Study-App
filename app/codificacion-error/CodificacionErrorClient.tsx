'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

type Question = {
  id: string
  prompt: string
  answer_key: string
  explanation: string | null
  options: string[] | null
  topic_name: string | null
  subtopic_name: string | null
}

type SubtopicGroup = {
  subtopic_name: string
  questions: Question[]
  errorCount: number
  userAnswers: Record<string, string>
}

type CodificacionErrorClientProps = {
  userId: string
  initialQuestions: Question[]
  tipo?: string
  subtopicGroups?: SubtopicGroup[]
}

type CodificacionErrorState = 'selection' | 'running' | 'completed'
type ErrorType = 'errores-bobos' | 'errores-conocimiento' | 'errores-analisis'

export default function CodificacionErrorClient({ userId, initialQuestions, tipo = 'errores-bobos', subtopicGroups = [] }: CodificacionErrorClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTipo = (searchParams.get('tipo') || tipo) as ErrorType
  
  const [state, setState] = useState<CodificacionErrorState>('selection')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [timePerQuestion, setTimePerQuestion] = useState<number>(60)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [results, setResults] = useState<Array<{
    questionId: string
    isCorrect: boolean
    userAnswer: string
    timeSpent: number
  }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feynmanEnabled, setFeynmanEnabled] = useState(false)
  const [reasonings, setReasonings] = useState<Record<string, string>>({})
  const [feynmanFeedbacks, setFeynmanFeedbacks] = useState<Record<string, {
    technique1Feedback: string
    technique2Feedback: string
    overallFeedback: string
  }>>({})
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false)
  const [feedbackProgress, setFeedbackProgress] = useState({ completed: 0, total: 0 })
  const [attemptIds, setAttemptIds] = useState<Record<string, string>>({})
  
  // New state for conocimiento/analisis
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set())
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // Timer effect
  useEffect(() => {
    if (state === 'running' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (state === 'running' && timeLeft === 0) {
      handleAutoSubmit()
    }
  }, [state, timeLeft])

  const handleCreateTutorSession = async () => {
    if (selectedSubtopics.size === 0) {
      alert('Por favor selecciona al menos un subtema')
      return
    }

    setIsCreatingSession(true)
    try {
      const supabase = createClient()
      
      // Get selected subtopic groups
      const selectedGroups = subtopicGroups.filter(g => selectedSubtopics.has(g.subtopic_name))
      
      // Collect all questions and errors
      const allQuestions: Question[] = []
      const errorsContext: Array<{
        question: string
        userAnswer: string
        correctAnswer: string
        subtopic: string
      }> = []
      
      selectedGroups.forEach(group => {
        group.questions.forEach(q => {
          allQuestions.push(q)
          errorsContext.push({
            question: q.prompt,
            userAnswer: group.userAnswers[q.id] || 'No respondida',
            correctAnswer: q.answer_key,
            subtopic: group.subtopic_name,
          })
        })
      })

      const subtopicNames = Array.from(selectedSubtopics).join(', ')
      const errorType = currentTipo === 'errores-conocimiento' ? 'Conocimiento' : 'Análisis'
      const tutorRoleSuffix = currentTipo === 'errores-conocimiento' 
        ? 'Refuerzo de conocimientos' 
        : 'Desarrollo de análisis'
      
      const objective = currentTipo === 'errores-conocimiento'
        ? `Reforzar conocimientos específicos en ${subtopicNames} donde se cometieron errores`
        : `Desarrollar habilidades de análisis en ${subtopicNames} mediante preguntas guiadas`

      // Build context with error details
      const contextDetails = errorsContext.map((err, idx) => 
        `Error ${idx + 1}:\n- Pregunta: ${err.question}\n- Respuesta del estudiante: ${err.userAnswer}\n- Respuesta correcta: ${err.correctAnswer}\n- Subtema: ${err.subtopic}`
      ).join('\n\n')

      const context = `El estudiante ha cometido errores clasificados como "${errorType}" en los siguientes subtemas: ${subtopicNames}.\n\nDetalles de los errores:\n\n${contextDetails}\n\nEl estudiante necesita ayuda para ${currentTipo === 'errores-conocimiento' ? 'reforzar estos conocimientos' : 'desarrollar habilidades de análisis'} en estos temas.`

      // Create tutor session
      const { data: session, error: sessionError } = await supabase
        .from('tutor_sessions')
        .insert({
          user_id: userId,
          tutor_role: `Especialista en ${subtopicNames} - ${tutorRoleSuffix}`,
          user_role: 'Estudiante',
          context: context,
          objective: objective,
          status: 'created',
        })
        .select()
        .single()

      if (sessionError || !session) {
        console.error('Error creating tutor session:', sessionError)
        alert('Error al crear la sesión de tutor')
        return
      }

      // Generate initial message with error context
      const initialMessage = `Hola! He identificado que necesitas ${currentTipo === 'errores-conocimiento' ? 'reforzar conocimientos' : 'desarrollar habilidades de análisis'} en los siguientes subtemas: ${subtopicNames}.\n\nHe cometido errores en ${allQuestions.length} pregunta(s) relacionadas con estos temas. ¿Podrías ayudarme a ${currentTipo === 'errores-conocimiento' ? 'entender mejor estos conceptos' : 'mejorar mi capacidad de análisis'}?`

      const response = await fetch('/api/ai/tutor-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          message: initialMessage,
          conversationHistory: [],
          isInitialMessage: true,
          errorContext: {
            errorType: errorType,
            errors: errorsContext,
            subtopics: Array.from(selectedSubtopics),
          },
        }),
      })

      if (!response.ok) {
        console.error('Error generating initial message')
      }

      // Redirect to tutor module
      router.push(`/tutor?sessionId=${session.id}`)
    } catch (error) {
      console.error('Error creating tutor session:', error)
      alert('Error al crear la sesión de tutor')
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleStart = async () => {
    if (initialQuestions.length === 0) {
      alert('No hay preguntas disponibles. Clasifica algunos errores como "Errores bobos" en el Dashboard de Errores primero.')
      return
    }

    setIsSubmitting(true)
    try {
      // Interleave questions by topic/subtopic
      const questionsByTopic = new Map<string, Question[]>()
      initialQuestions.forEach(q => {
        const key = q.topic_name || q.subtopic_name || 'Sin categoría'
        if (!questionsByTopic.has(key)) {
          questionsByTopic.set(key, [])
        }
        questionsByTopic.get(key)!.push(q)
      })

      // Shuffle questions within each topic first
      questionsByTopic.forEach((topicQuestions) => {
        topicQuestions.sort(() => Math.random() - 0.5)
      })

      // Interleave questions from different topics (round-robin style)
      const interleaved: Question[] = []
      const topicArrays = Array.from(questionsByTopic.values())
      const maxLength = Math.max(...topicArrays.map(arr => arr.length))

      for (let i = 0; i < maxLength; i++) {
        topicArrays.forEach(topicQuestions => {
          if (i < topicQuestions.length) {
            interleaved.push(topicQuestions[i])
          }
        })
      }

      // Generate session ID
      const newSessionId = crypto.randomUUID()
      setSessionId(newSessionId)
      setQuestions(interleaved)
      setCurrentQuestionIndex(0)
      setTimeLeft(timePerQuestion)
      setState('running')
      setResults([])
      setReasonings({})
      setFeynmanFeedbacks({})
      setAttemptIds({})
      setLoadingFeedbacks(false)
      setFeedbackProgress({ completed: 0, total: 0 })
    } catch (error) {
      console.error('CodificacionError: Error starting:', error)
      alert('Error al iniciar la codificación del error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAutoSubmit = async () => {
    if (!questions[currentQuestionIndex]) return

    const currentQuestion = questions[currentQuestionIndex]
    const timeSpent = timePerQuestion - timeLeft
    
    const userAnswerNormalized = selectedOption.toUpperCase().trim()
    const correctAnswerNormalized = currentQuestion.answer_key.toUpperCase().trim()
    
    let isCorrect = false
    if (userAnswerNormalized.length === 1 && /^[A-D]$/.test(userAnswerNormalized)) {
      isCorrect = userAnswerNormalized === correctAnswerNormalized
    } else if (currentQuestion.options && Array.isArray(currentQuestion.options)) {
      const optionIndex = currentQuestion.options.findIndex(
        opt => opt.toUpperCase().trim() === userAnswerNormalized
      )
      if (optionIndex >= 0) {
        const letter = String.fromCharCode(65 + optionIndex)
        isCorrect = letter.toUpperCase() === correctAnswerNormalized
      }
    }

    const newResults = [...results, {
      questionId: currentQuestion.id,
      isCorrect,
      userAnswer: selectedOption || '',
      timeSpent,
    }]
    setResults(newResults)

    const currentAttemptIds: Record<string, string> = { ...attemptIds }
    if (selectedOption) {
      const attemptId = await saveAttempt(currentQuestion.id, selectedOption, isCorrect, timeSpent)
      if (attemptId) {
        currentAttemptIds[currentQuestion.id] = attemptId
        setAttemptIds(prev => ({ ...prev, [currentQuestion.id]: attemptId }))
        if (feynmanEnabled && reasonings[currentQuestion.id]) {
          await saveReasoning(attemptId, reasonings[currentQuestion.id])
        }
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedOption('')
      setTimeLeft(timePerQuestion)
    } else {
      setState('completed')
      if (feynmanEnabled) {
        await generateFeedbacks(newResults, currentAttemptIds)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOption || !questions[currentQuestionIndex]) return
    if (feynmanEnabled && (!reasonings[currentQuestion.id] || reasonings[currentQuestion.id].length < 20)) {
      return
    }

    await handleAutoSubmit()
  }

  const saveAttempt = async (questionId: string, userAnswer: string, isCorrect: boolean, timeSpent: number): Promise<string | null> => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('attempts').insert({
        user_id: userId,
        question_id: questionId,
        is_correct: isCorrect,
        user_answer: userAnswer,
        source: 'codificacion-error',
        session_id: sessionId,
        time_spent: timeSpent,
      }).select('id').single()

      if (error) {
        console.error('CodificacionError: Error saving attempt:', error)
        return null
      }

      return data?.id || null
    } catch (error) {
      console.error('CodificacionError: Error saving attempt:', error)
      return null
    }
  }

  const saveReasoning = async (attemptId: string, reasoning: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('feynman_reasonings').insert({
        attempt_id: attemptId,
        user_reasoning: reasoning,
      }).select()
      
      if (error) {
        console.error('CodificacionError: Error saving reasoning:', error)
      }
    } catch (error) {
      console.error('CodificacionError: Exception saving reasoning:', error)
    }
  }

  const generateFeedbacks = async (
    currentResults?: Array<{
      questionId: string
      isCorrect: boolean
      userAnswer: string
      timeSpent: number
    }>,
    currentAttemptIdsParam?: Record<string, string>
  ) => {
    setLoadingFeedbacks(true)
    
    const resultsToUse = currentResults || results
    const attemptIdsToUse = currentAttemptIdsParam || attemptIds

    try {
      const resultsWithReasoning = resultsToUse.filter(result => {
        const question = questions.find(q => q.id === result.questionId)
        const reasoning = reasonings[result.questionId]
        return question && reasoning
      })

      if (resultsWithReasoning.length === 0) {
        setLoadingFeedbacks(false)
        setFeedbackProgress({ completed: 0, total: 0 })
        return
      }

      setFeedbackProgress({ completed: 0, total: resultsWithReasoning.length })

      const feedbackPromises = resultsWithReasoning.map(async (result) => {
        const question = questions.find(q => q.id === result.questionId)!
        const reasoning = reasonings[result.questionId]

        try {
          const response = await fetch('/api/ai/evaluate-feynman', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              questionPrompt: question.prompt,
              userAnswer: result.userAnswer,
              correctAnswer: question.answer_key,
              options: question.options || [],
              userReasoning: reasoning,
              isCorrect: result.isCorrect,
            }),
          })

          if (!response.ok) {
            return { questionId: result.questionId, feedback: null, error: true }
          }

          const feedback = await response.json()

          if (feedback.technique1Feedback && feedback.technique2Feedback && feedback.overallFeedback) {
            return {
              questionId: result.questionId,
              feedback: {
                technique1Feedback: feedback.technique1Feedback,
                technique2Feedback: feedback.technique2Feedback,
                overallFeedback: feedback.overallFeedback,
              },
            }
          }

          return { questionId: result.questionId, feedback: null, error: true }
        } catch (error) {
          console.error('CodificacionError: Error generating feedback:', error)
          return { questionId: result.questionId, feedback: null, error: true }
        }
      })

      const feedbackResults = await Promise.allSettled(feedbackPromises)

      const newFeedbacks: Record<string, {
        technique1Feedback: string
        technique2Feedback: string
        overallFeedback: string
      }> = {}

      let completed = 0
      feedbackResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.feedback) {
          newFeedbacks[result.value.questionId] = result.value.feedback
          completed++
        }
        setFeedbackProgress({ completed, total: resultsWithReasoning.length })
      })

      setFeynmanFeedbacks(prev => ({ ...prev, ...newFeedbacks }))

      // Update feedbacks in database
      for (const [questionId, feedback] of Object.entries(newFeedbacks)) {
        const attemptId = attemptIdsToUse[questionId]
        if (attemptId) {
          const supabase = createClient()
          await supabase
            .from('feynman_reasonings')
            .update({
              ai_feedback: feedback.overallFeedback,
              technique_1_feedback: feedback.technique1Feedback,
              technique_2_feedback: feedback.technique2Feedback,
            })
            .eq('attempt_id', attemptId)
        }
      }
    } catch (error) {
      console.error('CodificacionError: Error in generateFeedbacks:', error)
    } finally {
      setLoadingFeedbacks(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const options = currentQuestion?.options || []

  if (state === 'selection') {
    // Render tabs selector
    const renderTabs = () => (
      <div className="mb-6 flex gap-2 bg-white/80 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-white/20">
        <button
          onClick={() => router.push('/codificacion-error?tipo=errores-bobos')}
          className={`px-6 py-3 font-bold rounded-lg transition-all duration-200 ${
            currentTipo === 'errores-bobos'
              ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          🔄 Errores bobos
        </button>
        <button
          onClick={() => router.push('/codificacion-error?tipo=errores-conocimiento')}
          className={`px-6 py-3 font-bold rounded-lg transition-all duration-200 ${
            currentTipo === 'errores-conocimiento'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          📚 Errores de conocimiento
        </button>
        <button
          onClick={() => router.push('/codificacion-error?tipo=errores-analisis')}
          className={`px-6 py-3 font-bold rounded-lg transition-all duration-200 ${
            currentTipo === 'errores-analisis'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          🧠 Errores de análisis
        </button>
      </div>
    )

    // Render view for conocimiento/analisis
    if (currentTipo === 'errores-conocimiento' || currentTipo === 'errores-analisis') {
      const isConocimiento = currentTipo === 'errores-conocimiento'
      const icon = isConocimiento ? '📚' : '🧠'
      const title = isConocimiento ? 'Errores de conocimiento' : 'Errores de análisis'
      const description = isConocimiento 
        ? 'Refuerza conocimientos faltantes con explicaciones directas del tutor'
        : 'Desarrolla tu capacidad de análisis mediante preguntas guiadas del tutor'
      const gradient = isConocimiento 
        ? 'from-blue-600 via-indigo-600 to-purple-600'
        : 'from-purple-600 via-pink-600 to-rose-600'
      const bgGradient = isConocimiento
        ? 'from-blue-50 to-indigo-50'
        : 'from-purple-50 to-pink-50'
      const borderColor = isConocimiento
        ? 'border-blue-500'
        : 'border-purple-500'

      return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Codificación del Error
                </h1>
                <p className="text-gray-600 text-sm md:text-base">{description}</p>
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

            {renderTabs()}

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 bg-gradient-to-br ${isConocimiento ? 'from-blue-500 to-indigo-600' : 'from-purple-500 to-pink-600'} rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                  {icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {title}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {description}
                  </p>
                </div>
              </div>

              {subtopicGroups.length === 0 ? (
                <div className={`bg-gradient-to-r ${bgGradient} rounded-xl p-6 border-l-4 ${borderColor} mb-6`}>
                  <p className="text-gray-700 font-medium mb-2">
                    No hay errores disponibles
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Clasifica algunos errores como "{title}" en el Dashboard de Errores para comenzar.
                  </p>
                  <Link
                    href="/dashboard-errores"
                    className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    📊 Ir al Dashboard de Errores
                  </Link>
                </div>
              ) : (
                <>
                  <div className={`bg-gradient-to-r ${bgGradient} rounded-xl p-6 border-l-4 ${borderColor} mb-6`}>
                    <p className="text-gray-700 font-medium mb-2">
                      {subtopicGroups.length} {subtopicGroups.length === 1 ? 'subtema con errores' : 'subtemas con errores'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Selecciona los subtemas donde quieres trabajar con el tutor
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {subtopicGroups.map((group) => (
                      <label
                        key={group.subtopic_name}
                        className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          selectedSubtopics.has(group.subtopic_name)
                            ? `border-${isConocimiento ? 'blue' : 'purple'}-500 bg-gradient-to-r ${bgGradient} shadow-lg`
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubtopics.has(group.subtopic_name)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedSubtopics)
                            if (e.target.checked) {
                              newSelected.add(group.subtopic_name)
                            } else {
                              newSelected.delete(group.subtopic_name)
                            }
                            setSelectedSubtopics(newSelected)
                          }}
                          className="mt-1 mr-4 h-5 w-5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-gray-900">{group.subtopic_name}</h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              isConocimiento
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {group.errorCount} {group.errorCount === 1 ? 'error' : 'errores'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {group.questions.length} {group.questions.length === 1 ? 'pregunta' : 'preguntas'} con errores
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleCreateTutorSession}
                    disabled={selectedSubtopics.size === 0 || isCreatingSession}
                    className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r ${gradient} text-white hover:opacity-90`}
                  >
                    {isCreatingSession ? '⏳ Creando sesión...' : `🚀 Crear Sesión con Tutor`}
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      )
    }

    // Render view for errores-bobos (existing logic)
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Codificación del Error
              </h1>
              <p className="text-gray-600 text-sm md:text-base">Refuerza tus errores con la técnica de interleaving</p>
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

          {renderTabs()}

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                🔄
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Configuración
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Las preguntas se mezclarán automáticamente usando la técnica de Interleaving
                </p>
              </div>
            </div>

            {initialQuestions.length === 0 ? (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border-l-4 border-yellow-500 mb-6">
                <p className="text-gray-700 font-medium mb-2">
                  No hay preguntas disponibles
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Clasifica algunos errores como "Errores bobos" en el Dashboard de Errores para comenzar.
                </p>
                <Link
                  href="/dashboard-errores"
                  className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  📊 Ir al Dashboard de Errores
                </Link>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-l-4 border-green-500 mb-6">
                <p className="text-gray-700 font-medium mb-2">
                  {initialQuestions.length} {initialQuestions.length === 1 ? 'pregunta disponible' : 'preguntas disponibles'}
                </p>
                <p className="text-sm text-gray-600">
                  Estas preguntas provienen de errores clasificados como "Errores bobos"
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border-l-4 border-purple-500">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-purple-500 text-xl">⏱️</span> Tiempo por pregunta (segundos)
                </label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={timePerQuestion}
                  onChange={(e) => setTimePerQuestion(parseInt(e.target.value) || 60)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white font-bold text-gray-900"
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border-l-4 border-indigo-500 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-indigo-500 text-xl">🧠</span> Feynman Modificado
                  </label>
                  <p className="text-xs text-gray-600">
                    Explica tu razonamiento para cada pregunta y recibe feedback de IA
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeynmanEnabled(!feynmanEnabled)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    feynmanEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
                      feynmanEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={initialQuestions.length === 0 || isSubmitting}
              className="mt-8 w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700"
            >
              {isSubmitting ? '⏳ Cargando...' : '🚀 Iniciar Codificación del Error'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (state === 'running' && currentQuestion) {
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100
    const timePercentage = (timeLeft / timePerQuestion) * 100

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-4 py-2 rounded-xl">
                Pregunta {currentQuestionIndex + 1} de {questions.length}
              </span>
              <div className={`px-4 py-2 rounded-xl font-bold text-xl ${
                timeLeft < 10 
                  ? 'bg-red-100 text-red-700 border-2 border-red-300' 
                  : 'bg-green-100 text-green-700 border-2 border-green-300'
              }`}>
                ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 to-red-600 h-3 rounded-full transition-all duration-300 shadow-md"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    timePercentage < 20 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-600'
                  }`}
                  style={{ width: `${timePercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
            <div className="mb-6">
              <span className="inline-block px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-bold rounded-full shadow-md">
                📚 {currentQuestion.subtopic_name || currentQuestion.topic_name || 'Sin categoría'}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-8 leading-relaxed">
              {currentQuestion.prompt}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                {options.map((option, index) => {
                  const letter = String.fromCharCode(65 + index)
                  const isSelected = selectedOption === letter

                  return (
                    <label
                      key={index}
                      className={`flex items-start p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 shadow-lg'
                          : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg mr-4 shadow-sm ${
                        isSelected
                          ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {letter}
                      </div>
                      <input
                        type="radio"
                        name="option"
                        value={letter}
                        checked={isSelected}
                        onChange={(e) => setSelectedOption(e.target.value)}
                        className="mt-1 mr-3 h-5 w-5 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span className={`flex-1 font-medium ${isSelected ? 'text-orange-900' : 'text-gray-900'}`}>
                        {option}
                      </span>
                    </label>
                  )
                })}
              </div>

              {feynmanEnabled && (
                <div className="mt-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-indigo-500 text-xl">🧠</span> Explica tu razonamiento <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reasonings[currentQuestion.id] || ''}
                    onChange={(e) => setReasonings(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                    placeholder="Explica por qué seleccionaste esta respuesta. Describe tu proceso de razonamiento..."
                    required={feynmanEnabled}
                    minLength={20}
                    rows={5}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium text-gray-900 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Mínimo 20 caracteres. Sé específico sobre tu razonamiento.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedOption || (feynmanEnabled && (!reasonings[currentQuestion.id] || reasonings[currentQuestion.id].length < 20))}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 px-6 rounded-xl font-bold hover:from-orange-700 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                ✉️ Enviar Respuesta
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  if (state === 'completed') {
    const correctCount = results.filter(r => r.isCorrect).length
    const totalQuestions = results.length
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-12 text-center mb-6">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent mb-8">
              Codificación del Error Completada
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border-2 border-gray-200 shadow-lg">
                <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Total</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">{totalQuestions}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200 shadow-lg">
                <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Correctas</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{correctCount}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border-2 border-orange-200 shadow-lg">
                <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Precisión</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{accuracy}%</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard-errores"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                📊 Ver en Dashboard de Errores
              </Link>
              <Link
                href="/dashboard"
                className="bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 px-8 py-4 rounded-xl font-bold hover:from-gray-300 hover:to-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                🏠 Volver al Inicio
              </Link>
            </div>
          </div>

          {feynmanEnabled && (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  🧠
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Feedback Feynman Modificado
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Análisis de tu razonamiento usando técnicas avanzadas de estudio
                  </p>
                </div>
              </div>

              {loadingFeedbacks && Object.keys(feynmanFeedbacks).length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                  <p className="text-gray-600 font-medium">Generando feedback de IA...</p>
                  {feedbackProgress.total > 0 && (
                    <div className="mt-4 max-w-md mx-auto">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progreso</span>
                        <span className="font-bold text-indigo-600">
                          {Math.round((feedbackProgress.completed / feedbackProgress.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-300 shadow-md"
                          style={{ width: `${Math.min(100, (feedbackProgress.completed / feedbackProgress.total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {feedbackProgress.completed} de {feedbackProgress.total} feedbacks generados
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {loadingFeedbacks && feedbackProgress.total > 0 && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">Generando feedbacks restantes...</span>
                        <span className="text-sm font-bold text-indigo-600">
                          {Math.round((feedbackProgress.completed / feedbackProgress.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (feedbackProgress.completed / feedbackProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {results.map((result, index) => {
                    const question = questions.find(q => q.id === result.questionId)
                    const reasoning = reasonings[result.questionId]
                    const feedback = feynmanFeedbacks[result.questionId]

                    if (!question || !reasoning) return null

                    return (
                      <div
                        key={result.questionId}
                        className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-br from-gray-50 to-white"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold text-sm">
                                Pregunta {index + 1}
                              </span>
                              <span className={`px-3 py-1 rounded-full font-bold text-sm ${
                                result.isCorrect
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {result.isCorrect ? '✓ Correcta' : '✗ Incorrecta'}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                              {question.prompt}
                            </h3>
                            <div className="text-sm text-gray-600 mb-4">
                              <p><strong>Tu respuesta:</strong> {result.userAnswer}</p>
                              <p><strong>Respuesta correcta:</strong> {question.answer_key}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Tu razonamiento:</p>
                          <p className="text-gray-800 italic">{reasoning}</p>
                        </div>

                        {feedback && feedback.technique1Feedback && feedback.technique2Feedback && feedback.overallFeedback ? (
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
                              <p className="text-sm font-bold text-blue-700 mb-2">
                                Técnica 1: Descarte de Primeros Principios
                              </p>
                              <p className="text-gray-800">{feedback.technique1Feedback}</p>
                            </div>
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-l-4 border-purple-500">
                              <p className="text-sm font-bold text-purple-700 mb-2">
                                Técnica 2: Reverse Engineering del Error
                              </p>
                              <p className="text-gray-800">{feedback.technique2Feedback}</p>
                            </div>
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border-l-4 border-indigo-500">
                              <p className="text-sm font-bold text-indigo-700 mb-2">
                                Resumen y Recomendaciones
                              </p>
                              <p className="text-gray-800">{feedback.overallFeedback}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
                            <p className="text-sm">Generando feedback para esta pregunta...</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    )
  }

  return null
}

