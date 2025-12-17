'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { useRouter } from 'next/navigation'

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

type Question = {
  id: string
  prompt: string
  answer_key: string
  explanation: string | null
  options: string[] | null
  topic_name: string | null
  subtopic_name: string | null
}

type SimulacroClientProps = {
  userId: string
  routes: Route[]
}

type SimulacroState = 'selection' | 'running' | 'completed'
type SimulacroMode = 'subtopics' | 'topics' | 'full-route' | 'interleaving'

type ProblematicSubtopic = {
  subtopic_name: string
  topic_name: string
  error_count: number
}

export default function SimulacroClient({ userId, routes }: SimulacroClientProps) {
  const router = useRouter()
  const [state, setState] = useState<SimulacroState>('selection')
  const [mode, setMode] = useState<SimulacroMode>('subtopics')
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]) // Para modo 'topics'
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([])
  const [questionsPerSubtopic, setQuestionsPerSubtopic] = useState<number>(4) // Preguntas por subtema
  const [maxSubtopicsForInterleaving, setMaxSubtopicsForInterleaving] = useState<number>(10) // Máximo de subtemas para interleaving
  const [problematicSubtopics, setProblematicSubtopics] = useState<ProblematicSubtopic[]>([])
  const [loadingProblematicSubtopics, setLoadingProblematicSubtopics] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [timePerQuestion, setTimePerQuestion] = useState<number>(60) // 60 segundos por defecto
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [results, setResults] = useState<Array<{
    questionId: string
    isCorrect: boolean
    userAnswer: string
    timeSpent: number
  }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feynmanEnabled, setFeynmanEnabled] = useState(false)
  const [interleavingEnabled, setInterleavingEnabled] = useState(false)
  const [reasonings, setReasonings] = useState<Record<string, string>>({})
  const [feynmanFeedbacks, setFeynmanFeedbacks] = useState<Record<string, {
    technique1Feedback: string
    technique2Feedback: string
    overallFeedback: string
  }>>({})
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false)
  const [feedbackProgress, setFeedbackProgress] = useState({ completed: 0, total: 0 })
  const [attemptIds, setAttemptIds] = useState<Record<string, string>>({})

  // Get selected route
  const selectedRoute = routes.find(r => r.id === selectedRouteId)
  
  // Get topics from selected route
  const availableTopics = selectedRoute?.items.filter(item => item.item_type === 'topic') || []
  
  // Get subtopics from selected topic
  const selectedTopic = availableTopics.find(t => t.id === selectedTopicId)
  const availableSubtopics = selectedTopic?.children?.filter(item => item.item_type === 'subtopic') || []

  // Load problematic subtopics when interleaving mode is selected
  const loadProblematicSubtopics = async () => {
    setLoadingProblematicSubtopics(true)
    try {
      const supabase = createClient()
      
      // Get incorrect attempts from simulacro
      const { data: incorrectAttempts } = await supabase
        .from('attempts')
        .select(`
          questions (
            subtopic_name,
            topic_name
          )
        `)
        .eq('user_id', userId)
        .eq('source', 'simulacro')
        .eq('is_correct', false)
      
      // Group and count errors by subtopic
      const subtopicErrors = new Map<string, { count: number; topic_name: string }>()
      
      incorrectAttempts?.forEach((attempt: any) => {
        const subtopic = attempt.questions?.subtopic_name
        const topic = attempt.questions?.topic_name
        if (subtopic) {
          const current = subtopicErrors.get(subtopic) || { count: 0, topic_name: topic || '' }
          subtopicErrors.set(subtopic, { 
            count: current.count + 1, 
            topic_name: current.topic_name || topic || '' 
          })
        }
      })
      
      // Sort by error count and get top N
      const problematic: ProblematicSubtopic[] = Array.from(subtopicErrors.entries())
        .map(([subtopic_name, data]) => ({ 
          subtopic_name, 
          topic_name: data.topic_name,
          error_count: data.count 
        }))
        .sort((a, b) => b.error_count - a.error_count)
        .slice(0, maxSubtopicsForInterleaving)
      
      setProblematicSubtopics(problematic)
    } catch (error) {
      console.error('Error loading problematic subtopics:', error)
      setProblematicSubtopics([])
    } finally {
      setLoadingProblematicSubtopics(false)
    }
  }

  useEffect(() => {
    if (mode === 'interleaving') {
      loadProblematicSubtopics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId, maxSubtopicsForInterleaving])

  // Timer effect
  useEffect(() => {
    if (state === 'running' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (state === 'running' && timeLeft === 0) {
      // Time's up, auto-submit
      handleAutoSubmit()
    }
  }, [state, timeLeft])

  const handleStartSimulacro = async () => {
    if (mode === 'interleaving') {
      if (problematicSubtopics.length === 0) {
        alert('No se encontraron subtemas con errores. Realiza algunos simulacros primero.')
        return
      }
    } else {
      if (!selectedRouteId) {
        alert('Selecciona una ruta')
        return
      }

      if (mode === 'subtopics' && (!selectedTopicId || (availableSubtopics.length > 0 && selectedSubtopics.length === 0))) {
        alert('Selecciona un tema y al menos un subtema')
        return
      }

      if (mode === 'topics' && selectedTopicIds.length === 0) {
        alert('Selecciona al menos un tema')
        return
      }
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const allQuestions: Question[] = []

      if (mode === 'subtopics') {
        // Modo 1: Subtemas específicos
        const topicName = selectedTopic?.custom_name
        if (!topicName) {
          alert('Error: No se encontró el tema seleccionado')
          setIsSubmitting(false)
          return
        }

        if (selectedSubtopics.length > 0) {
          const subtopicNames = selectedSubtopics
            .map(id => availableSubtopics.find(s => s.id === id)?.custom_name)
            .filter(Boolean) as string[]

          for (const subtopicName of subtopicNames) {
            const { data: subtopicQuestions } = await supabase
              .from('questions')
              .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
              .eq('topic_name', topicName)
              .eq('subtopic_name', subtopicName)
              .limit(questionsPerSubtopic)

            if (subtopicQuestions) {
              allQuestions.push(...subtopicQuestions)
            }
          }
        } else {
          // Tema sin subtemas
          const { data: topicQuestions } = await supabase
            .from('questions')
            .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
            .eq('topic_name', topicName)
            .is('subtopic_name', null)
            .limit(questionsPerSubtopic)

          if (topicQuestions) {
            allQuestions.push(...topicQuestions)
          }
        }
      } else if (mode === 'topics') {
        // Modo 2: Temas completos (todos los subtemas de los temas seleccionados)
        const selectedTopics = availableTopics.filter(t => selectedTopicIds.includes(t.id))
        
        for (const topic of selectedTopics) {
          const topicName = topic.custom_name
          if (!topicName) continue

          // Get all subtopics for this topic
          const topicSubtopics = topic.children?.filter(c => c.item_type === 'subtopic') || []
          
          if (topicSubtopics.length > 0) {
            // Get questions from all subtopics of this topic
            for (const subtopic of topicSubtopics) {
              const subtopicName = subtopic.custom_name
              if (!subtopicName) continue

              const { data: subtopicQuestions } = await supabase
                .from('questions')
                .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
                .eq('topic_name', topicName)
                .eq('subtopic_name', subtopicName)
                .limit(questionsPerSubtopic)

              if (subtopicQuestions) {
                allQuestions.push(...subtopicQuestions)
              }
            }
          } else {
            // Topic without subtopics
            const { data: topicQuestions } = await supabase
              .from('questions')
              .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
              .eq('topic_name', topicName)
              .is('subtopic_name', null)
              .limit(questionsPerSubtopic)

            if (topicQuestions) {
              allQuestions.push(...topicQuestions)
            }
          }
        }
      } else if (mode === 'full-route') {
        // Modo 3: Ruta completa (todos los temas y subtemas de la ruta)
        const route = routes.find(r => r.id === selectedRouteId)
        if (!route) {
          alert('Error: No se encontró la ruta seleccionada')
          setIsSubmitting(false)
          return
        }

        const routeTopics = route.items.filter(item => item.item_type === 'topic')
        
        for (const topic of routeTopics) {
          const topicName = topic.custom_name
          if (!topicName) continue

          const topicSubtopics = topic.children?.filter(c => c.item_type === 'subtopic') || []
          
          if (topicSubtopics.length > 0) {
            // Get questions from all subtopics
            for (const subtopic of topicSubtopics) {
              const subtopicName = subtopic.custom_name
              if (!subtopicName) continue

              const { data: subtopicQuestions } = await supabase
                .from('questions')
                .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
                .eq('topic_name', topicName)
                .eq('subtopic_name', subtopicName)
                .limit(questionsPerSubtopic)

              if (subtopicQuestions) {
                allQuestions.push(...subtopicQuestions)
              }
            }
          } else {
            // Topic without subtopics
            const { data: topicQuestions } = await supabase
              .from('questions')
              .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
              .eq('topic_name', topicName)
              .is('subtopic_name', null)
              .limit(questionsPerSubtopic)

            if (topicQuestions) {
              allQuestions.push(...topicQuestions)
            }
          }
        }
      } else if (mode === 'interleaving') {
        // Modo 4: Interleaving - Subtemas donde el usuario se ha equivocado
        if (problematicSubtopics.length === 0) {
          alert('No se encontraron subtemas con errores para generar el simulacro')
          setIsSubmitting(false)
          return
        }

        // Get questions from problematic subtopics
        for (const problematic of problematicSubtopics) {
          const { data: subtopicQuestions } = await supabase
            .from('questions')
            .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
            .eq('topic_name', problematic.topic_name)
            .eq('subtopic_name', problematic.subtopic_name)
            .limit(questionsPerSubtopic)

          if (subtopicQuestions) {
            allQuestions.push(...subtopicQuestions)
          }
        }
      }

      if (allQuestions.length === 0) {
        alert('No hay preguntas disponibles para la selección realizada')
        setIsSubmitting(false)
        return
      }

      // Interleave questions by topic/subtopic if interleaving is enabled
      let shuffled: Question[]
      if (interleavingEnabled) {
        // Group questions by topic_name (or subtopic_name if topic is null)
        const questionsByTopic = new Map<string, Question[]>()
        allQuestions.forEach(q => {
          const key = q.topic_name || 'Sin tema'
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

        shuffled = interleaved
      } else {
        // Regular shuffle (completely random)
        shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      }
      
      // Generate session ID
      const newSessionId = crypto.randomUUID()
      setSessionId(newSessionId)
      setQuestions(shuffled)
      setCurrentQuestionIndex(0)
      setTimeLeft(timePerQuestion)
      setState('running')
      setResults([])
      // Reset Feynman states
      setReasonings({})
      setFeynmanFeedbacks({})
      setAttemptIds({})
      setLoadingFeedbacks(false)
      setFeedbackProgress({ completed: 0, total: 0 })
      // Note: interleavingEnabled state persists across simulacros
    } catch (error) {
      console.error('Simulacro: Error starting:', error)
      alert('Error al iniciar el simulacro')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAutoSubmit = async () => {
    if (!questions[currentQuestionIndex]) return

    const currentQuestion = questions[currentQuestionIndex]
    const timeSpent = timePerQuestion - timeLeft
    
    // Normalize both values to uppercase for comparison
    const userAnswerNormalized = selectedOption.toUpperCase().trim()
    const correctAnswerNormalized = currentQuestion.answer_key.toUpperCase().trim()
    
    // Compare: if user_answer is a letter (A-D), compare directly
    // If it's the full option text (legacy format), find the corresponding letter
    let isCorrect = false
    if (userAnswerNormalized.length === 1 && /^[A-D]$/.test(userAnswerNormalized)) {
      // New format: direct letter comparison
      isCorrect = userAnswerNormalized === correctAnswerNormalized
    } else if (currentQuestion.options && Array.isArray(currentQuestion.options)) {
      // Legacy format: find the index of the selected option and convert to letter
      const optionIndex = currentQuestion.options.findIndex(
        opt => opt.toUpperCase().trim() === userAnswerNormalized
      )
      if (optionIndex >= 0) {
        const letter = String.fromCharCode(65 + optionIndex) // A, B, C, D
        isCorrect = letter.toUpperCase() === correctAnswerNormalized
      }
    }

    // Save result
    const newResults = [...results, {
      questionId: currentQuestion.id,
      isCorrect,
      userAnswer: selectedOption || '',
      timeSpent,
    }]
    setResults(newResults)

    // Save to database and collect attempt IDs for feedback generation
    const currentAttemptIds: Record<string, string> = { ...attemptIds }
    if (selectedOption) {
      const attemptId = await saveAttempt(currentQuestion.id, selectedOption, isCorrect, timeSpent)
      // Save attempt ID for later feedback generation
      if (attemptId) {
        currentAttemptIds[currentQuestion.id] = attemptId
        setAttemptIds(prev => ({ ...prev, [currentQuestion.id]: attemptId }))
        // Save reasoning if Feynman is enabled
        if (feynmanEnabled && reasonings[currentQuestion.id]) {
          await saveReasoning(attemptId, reasonings[currentQuestion.id])
        }
      }
    }

    // Move to next question or finish
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedOption('')
      setTimeLeft(timePerQuestion)
    } else {
      setState('completed')
      // Generate feedbacks if Feynman is enabled
      // Pass newResults and currentAttemptIds directly to avoid stale state
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
        source: 'simulacro',
        session_id: sessionId,
        time_spent: timeSpent,
      }).select('id').single()

      if (error) {
        console.error('Simulacro: Error saving attempt:', error)
        return null
      }

      return data?.id || null
    } catch (error) {
      console.error('Simulacro: Error saving attempt:', error)
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
        console.error('Simulacro: Error saving reasoning:', error)
        console.error('Simulacro: Attempt ID:', attemptId)
      } else {
        console.log('Simulacro: Successfully saved reasoning for attempt:', attemptId)
        console.log('Simulacro: Inserted reasoning ID:', data?.[0]?.id)
      }
    } catch (error) {
      console.error('Simulacro: Exception saving reasoning:', error)
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
    console.log('Simulacro: Starting feedback generation...')
    
    // Use provided results or fallback to state
    const resultsToUse = currentResults || results
    const attemptIdsToUse = currentAttemptIdsParam || attemptIds
    
    console.log('Simulacro: Using results:', resultsToUse.length)
    console.log('Simulacro: Using attempt IDs:', Object.keys(attemptIdsToUse).length)
    console.log('Simulacro: Reasonings keys:', Object.keys(reasonings))
    console.log('Simulacro: Reasonings:', reasonings)

    try {
      // Filter results that have reasoning
      const resultsWithReasoning = resultsToUse.filter(result => {
        const question = questions.find(q => q.id === result.questionId)
        const reasoning = reasonings[result.questionId]
        console.log(`Simulacro: Checking result ${result.questionId}:`, {
          hasQuestion: !!question,
          hasReasoning: !!reasoning,
          reasoningLength: reasoning?.length
        })
        return question && reasoning
      })

      console.log('Simulacro: Results with reasoning:', resultsWithReasoning.length)

      if (resultsWithReasoning.length === 0) {
        console.log('Simulacro: No results with reasoning, skipping feedback generation')
        setLoadingFeedbacks(false)
        setFeedbackProgress({ completed: 0, total: 0 })
        return
      }

      // Initialize progress
      setFeedbackProgress({ completed: 0, total: resultsWithReasoning.length })

      // Generate feedback for all questions in parallel
      const feedbackPromises = resultsWithReasoning.map(async (result) => {
        const question = questions.find(q => q.id === result.questionId)!
        const reasoning = reasonings[result.questionId]

        try {
          console.log('Simulacro: Generating feedback for question', result.questionId)
          
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
            const errorText = await response.text()
            console.error('Simulacro: Error generating feedback for question', result.questionId, errorText)
            return { questionId: result.questionId, feedback: null, error: true }
          }

          const feedback = await response.json()
          console.log('Simulacro: Feedback received for question', result.questionId, feedback)

          // Validate feedback structure
          if (!feedback.technique1Feedback || !feedback.technique2Feedback || !feedback.overallFeedback) {
            console.error('Simulacro: Invalid feedback structure received:', feedback)
            return { questionId: result.questionId, feedback: null, error: true }
          }

          // Save feedback to database
          const attemptId = attemptIdsToUse[result.questionId]
          if (attemptId) {
            console.log('Simulacro: Saving feedback to database for attempt:', attemptId)
            try {
              await updateReasoningFeedback(attemptId, feedback)
            } catch (dbError) {
              console.error('Simulacro: Error saving feedback to database:', dbError)
            }
          } else {
            console.warn('Simulacro: No attempt ID found for question:', result.questionId)
            console.warn('Simulacro: Available attempt IDs:', Object.keys(attemptIds))
          }

          // Update state immediately as feedback arrives (using functional update to avoid stale closures)
          setFeynmanFeedbacks(prev => {
            const updated = {
              ...prev,
              [result.questionId]: feedback
            }
            const completedCount = Object.keys(updated).length
            console.log('Simulacro: Updated feynmanFeedbacks state, total feedbacks:', completedCount)
            console.log('Simulacro: Feedback keys:', Object.keys(updated))
            return updated
          })
          
          // Update progress separately
          setFeedbackProgress(prevProgress => {
            const newCompleted = prevProgress.completed + 1
            console.log('Simulacro: Progress updated:', newCompleted, '/', prevProgress.total)
            return {
              ...prevProgress,
              completed: newCompleted
            }
          })

          return { questionId: result.questionId, feedback, error: false }
        } catch (error) {
          console.error('Simulacro: Error generating feedback for question', result.questionId, error)
          return { questionId: result.questionId, feedback: null, error: true }
        }
      })

      // Wait for all feedbacks to complete (use Promise.allSettled to handle errors gracefully)
      const feedbackResults = await Promise.allSettled(feedbackPromises)
      
      const successfulFeedbacks = feedbackResults
        .filter((result): result is PromiseFulfilledResult<{ questionId: string; feedback: any; error: boolean }> => 
          result.status === 'fulfilled' && result.value.feedback !== null
        )
        .map(result => result.value)

      console.log('Simulacro: Successfully generated', successfulFeedbacks.length, 'feedbacks out of', feedbackResults.length)

    } catch (error) {
      console.error('Simulacro: Error generating feedbacks:', error)
    } finally {
      console.log('Simulacro: Feedback generation completed, setting loadingFeedbacks to false')
      setLoadingFeedbacks(false)
      // Ensure progress is at 100% when done
      setFeedbackProgress(prev => ({
        ...prev,
        completed: prev.total
      }))
    }
  }

  const updateReasoningFeedback = async (attemptId: string, feedback: {
    technique1Feedback: string
    technique2Feedback: string
    overallFeedback: string
  }) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('feynman_reasonings')
        .update({
          technique_1_feedback: feedback.technique1Feedback,
          technique_2_feedback: feedback.technique2Feedback,
          ai_feedback: feedback.overallFeedback,
        })
        .eq('attempt_id', attemptId)
        .select()
      
      if (error) {
        console.error('Simulacro: Error updating reasoning feedback:', error)
        console.error('Simulacro: Attempt ID:', attemptId)
        console.error('Simulacro: Feedback data:', feedback)
      } else {
        console.log('Simulacro: Successfully updated reasoning feedback for attempt:', attemptId)
        console.log('Simulacro: Updated rows:', data?.length || 0)
      }
    } catch (error) {
      console.error('Simulacro: Exception updating reasoning feedback:', error)
      console.error('Simulacro: Attempt ID:', attemptId)
    }
  }

  const toggleSubtopic = (subtopicId: string) => {
    setSelectedSubtopics(prev =>
      prev.includes(subtopicId)
        ? prev.filter(id => id !== subtopicId)
        : [...prev, subtopicId]
    )
  }

  const handleRouteChange = (routeId: string) => {
    setSelectedRouteId(routeId)
    setSelectedTopicId('')
    setSelectedTopicIds([])
    setSelectedSubtopics([])
  }

  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId)
    setSelectedSubtopics([])
  }

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    )
  }

  const handleModeChange = (newMode: SimulacroMode) => {
    setMode(newMode)
    setSelectedRouteId('')
    setSelectedTopicId('')
    setSelectedTopicIds([])
    setSelectedSubtopics([])
    if (newMode === 'interleaving') {
      loadProblematicSubtopics()
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const options = currentQuestion?.options || []

  if (state === 'selection') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
                Simulacro
              </h1>
              <p className="text-gray-600 text-sm md:text-base">Examen de práctica con tiempo limitado</p>
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

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                ⚡
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Configura tu Simulacro
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Selecciona el modo de evaluación y configura las opciones
                </p>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-indigo-500 text-xl">🎯</span> Modo de Evaluación *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => handleModeChange('subtopics')}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    mode === 'subtopics'
                      ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold text-gray-900 mb-1">🔖 Por Subtemas</div>
                  <div className="text-xs text-gray-600">Evalúa subtemas específicos</div>
                </button>
                <button
                  onClick={() => handleModeChange('topics')}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    mode === 'topics'
                      ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold text-gray-900 mb-1">📚 Por Temas</div>
                  <div className="text-xs text-gray-600">Evalúa temas completos</div>
                </button>
                <button
                  onClick={() => handleModeChange('full-route')}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    mode === 'full-route'
                      ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold text-gray-900 mb-1">🗺️ Ruta Completa</div>
                  <div className="text-xs text-gray-600">Evalúa toda la ruta</div>
                </button>
                <button
                  onClick={() => handleModeChange('interleaving')}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    mode === 'interleaving'
                      ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 shadow-lg'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold text-gray-900 mb-1">🔄 Interleaving</div>
                  <div className="text-xs text-gray-600">Enfocado en tus errores</div>
                </button>
              </div>
            </div>

            {/* Configuration */}
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
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-5 border-l-4 border-pink-500">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-pink-500 text-xl">📝</span> Preguntas por subtema
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={questionsPerSubtopic}
                  onChange={(e) => setQuestionsPerSubtopic(parseInt(e.target.value) || 4)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all duration-200 bg-white font-bold text-gray-900"
                />
              </div>
            </div>

            {/* Feynman Modificado Toggle */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border-l-4 border-indigo-500 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-indigo-500 text-xl">🧠</span> Feynman Modificado
                  </label>
                  <p className="text-xs text-gray-600">
                    Explica tu razonamiento para cada pregunta y recibe feedback de IA basado en técnicas de estudio avanzadas
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

            {/* Interleaving Toggle */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border-l-4 border-green-500 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-green-600 text-xl">🔄</span> Interleaving
                  </label>
                  <p className="text-xs text-gray-600">
                    Mezcla las preguntas intercalando temas diferentes para mejorar el aprendizaje y la retención
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInterleavingEnabled(!interleavingEnabled)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    interleavingEnabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
                      interleavingEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Route Selection - Not required for interleaving */}
            {mode !== 'interleaving' && (
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-indigo-500 text-xl">📍</span> Ruta de Estudio *
                </label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => handleRouteChange(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-indigo-300 cursor-pointer"
                >
                  <option value="">Selecciona una ruta</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Interleaving Mode - Show problematic subtopics */}
            {mode === 'interleaving' && (
              <>
                <div className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border-l-4 border-orange-500">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      🔄
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Modo Interleaving</h3>
                      <p className="text-sm text-gray-600">Simulacro enfocado en tus áreas problemáticas</p>
                    </div>
                  </div>
                  
                  {loadingProblematicSubtopics ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Analizando tus errores...</p>
                    </div>
                  ) : problematicSubtopics.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-gray-700 font-semibold mb-2">No se encontraron errores previos</p>
                      <p className="text-sm text-gray-600">Realiza algunos simulacros primero para que este modo pueda identificar tus áreas problemáticas.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="text-orange-500">📊</span> Máximo de subtemas a incluir
                        </label>
                        <input
                          type="number"
                          min="3"
                          max="20"
                          value={maxSubtopicsForInterleaving}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 10
                            setMaxSubtopicsForInterleaving(value)
                            loadProblematicSubtopics()
                          }}
                          className="w-32 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all duration-200 bg-white font-bold text-gray-900"
                        />
                      </div>
                      <div className="bg-white rounded-xl p-4 border-2 border-orange-200">
                        <p className="text-sm font-semibold text-gray-700 mb-3">
                          Se incluirán los <span className="text-orange-600 font-bold">{Math.min(problematicSubtopics.length, maxSubtopicsForInterleaving)}</span> subtemas con más errores:
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {problematicSubtopics.slice(0, maxSubtopicsForInterleaving).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg font-bold text-xs">
                                  #{idx + 1}
                                </span>
                                <span className="font-medium text-gray-900">{item.subtopic_name}</span>
                                <span className="text-xs text-gray-500">({item.topic_name})</span>
                              </div>
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg font-bold text-xs">
                                {item.error_count} {item.error_count === 1 ? 'error' : 'errores'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Mode 1: Subtemas */}
            {mode === 'subtopics' && selectedRouteId && (
              <>
                {/* Topic Selection */}
                <div className="mb-6 animate-in fade-in slide-in-from-left duration-300">
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-purple-500 text-xl">📚</span> Tema *
                  </label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-purple-300 cursor-pointer"
                  >
                    <option value="">Selecciona un tema</option>
                    {availableTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.custom_name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subtopic Selection */}
                {selectedTopicId && availableSubtopics.length > 0 && (
                  <div className="mb-6 animate-in fade-in slide-in-from-left duration-300">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-pink-500 text-xl">🔖</span> Subtemas (selecciona uno o más) *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableSubtopics.map((subtopic) => {
                        const isSelected = selectedSubtopics.includes(subtopic.id)
                        return (
                          <label
                            key={subtopic.id}
                            className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-pink-500 bg-gradient-to-r from-pink-50 to-purple-50 shadow-md'
                                : 'border-gray-200 hover:border-pink-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSubtopic(subtopic.id)}
                              className="mr-3 h-6 w-6 text-pink-600 focus:ring-pink-500 rounded cursor-pointer"
                            />
                            <span className={`font-medium ${isSelected ? 'text-pink-900' : 'text-gray-900'}`}>
                              {subtopic.custom_name || 'Sin nombre'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedTopicId && availableSubtopics.length === 0 && (
                  <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-xl">
                    <p className="text-sm text-blue-700 font-medium">
                      Este tema no tiene subtemas. Se mostrarán preguntas directamente del tema.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Mode 2: Temas */}
            {mode === 'topics' && selectedRouteId && (
              <div className="mb-6 animate-in fade-in slide-in-from-left duration-300">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-purple-500 text-xl">📚</span> Temas (selecciona uno o más) *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableTopics.map((topic) => {
                    const isSelected = selectedTopicIds.includes(topic.id)
                    return (
                      <label
                        key={topic.id}
                        className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-md'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTopic(topic.id)}
                          className="mr-3 h-6 w-6 text-purple-600 focus:ring-purple-500 rounded cursor-pointer"
                        />
                        <span className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
                          {topic.custom_name || 'Sin nombre'}
                        </span>
                        {topic.children && topic.children.length > 0 && (
                          <span className="ml-auto text-xs text-gray-500">
                            ({topic.children.length} subtemas)
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Mode 3: Ruta Completa */}
            {mode === 'full-route' && selectedRouteId && (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 rounded-xl">
                <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                  <span className="text-green-600">✅</span>
                  Se evaluará toda la ruta: {selectedRoute?.name}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Incluye todos los temas y subtemas de esta ruta ({availableTopics.length} temas)
                </p>
              </div>
            )}

            <button
              onClick={handleStartSimulacro}
              disabled={
                (mode === 'interleaving' && problematicSubtopics.length === 0) ||
                (mode !== 'interleaving' && !selectedRouteId) || 
                (mode === 'subtopics' && (!selectedTopicId || (availableSubtopics.length > 0 && selectedSubtopics.length === 0))) ||
                (mode === 'topics' && selectedTopicIds.length === 0) ||
                isSubmitting ||
                loadingProblematicSubtopics
              }
              className={`mt-8 w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                mode === 'interleaving'
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              }`}
            >
              {isSubmitting ? '⏳ Cargando...' : mode === 'interleaving' ? '🔄 Iniciar Simulacro Interleaving' : '🚀 Iniciar Simulacro'}
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
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-300 shadow-md"
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
              <span className="inline-block px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold rounded-full shadow-md">
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
                          ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg mr-4 shadow-sm ${
                        isSelected
                          ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white'
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
                        className="mt-1 mr-3 h-5 w-5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className={`flex-1 font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
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
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-8">
              Simulacro Completado
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
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
                <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Precisión</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{accuracy}%</p>
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

          {/* Feynman Feedback Section */}
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
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <p className="text-xs text-gray-400 mt-1">
                      Loading: {loadingFeedbacks ? 'true' : 'false'} | Feedbacks: {Object.keys(feynmanFeedbacks).length}
                    </p>
                  )}
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
                  <p className="text-sm text-gray-500 mt-4">Esto puede tardar unos momentos</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Progress indicator when loading and some feedbacks are ready */}
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
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {feedbackProgress.completed} de {feedbackProgress.total} completados
                      </p>
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

