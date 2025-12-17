import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CodificacionErrorClient from './CodificacionErrorClient'

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

type CodificacionErrorPageProps = {
  searchParams: Promise<{ tipo?: string }>
}

export default async function CodificacionErrorPage({ searchParams }: CodificacionErrorPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Get tipo from query params, default to 'errores-bobos'
  const resolvedSearchParams = await searchParams
  const tipo = resolvedSearchParams.tipo || 'errores-bobos'

  // Handle "Errores bobos" - return questions directly
  if (tipo === 'errores-bobos') {
    const { data: attempts, error: attemptsError } = await supabase
      .from('attempts')
      .select(`
        question_id,
        questions (
          id,
          prompt,
          answer_key,
          explanation,
          options,
          topic_name,
          subtopic_name
        )
      `)
      .eq('user_id', user.id)
      .eq('error_type', 'Errores bobos')
      .eq('is_correct', false)
      .eq('source', 'simulacro')

    if (attemptsError) {
      console.error('CodificacionError: Error fetching attempts:', attemptsError)
    }

    // Extract unique question IDs
    const uniqueQuestionIds = new Set<string>()
    attempts?.forEach((attempt: any) => {
      if (attempt.question_id && attempt.questions) {
        uniqueQuestionIds.add(attempt.question_id)
      }
    })

    // Fetch full question details for unique IDs
    const questionIdsArray = Array.from(uniqueQuestionIds)
    let questions: Question[] = []

    if (questionIdsArray.length > 0) {
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('id, prompt, answer_key, explanation, options, topic_name, subtopic_name')
        .in('id', questionIdsArray)

      if (questionsError) {
        console.error('CodificacionError: Error fetching questions:', questionsError)
      } else {
        questions = (questionsData || []) as Question[]
      }
    }

    return (
      <CodificacionErrorClient userId={user.id} initialQuestions={questions} tipo={tipo} />
    )
  }

  // Handle "Errores de conocimiento" and "Errores de análisis"
  if (tipo === 'errores-conocimiento' || tipo === 'errores-analisis') {
    const errorType = tipo === 'errores-conocimiento' ? 'Conocimiento' : 'Análisis'

    const { data: attempts, error: attemptsError } = await supabase
      .from('attempts')
      .select(`
        question_id,
        user_answer,
        questions (
          id,
          prompt,
          answer_key,
          explanation,
          options,
          topic_name,
          subtopic_name
        )
      `)
      .eq('user_id', user.id)
      .eq('error_type', errorType)
      .eq('is_correct', false)
      .eq('source', 'simulacro')

    if (attemptsError) {
      console.error('CodificacionError: Error fetching attempts:', attemptsError)
    }

    // Group questions by subtopic
    const subtopicMap = new Map<string, { questions: Question[], userAnswers: Map<string, string> }>()
    
    attempts?.forEach((attempt: any) => {
      if (attempt.questions && attempt.question_id) {
        const subtopic = attempt.questions.subtopic_name || attempt.questions.topic_name || 'Sin categoría'
        
        if (!subtopicMap.has(subtopic)) {
          subtopicMap.set(subtopic, { questions: [], userAnswers: new Map() })
        }
        
        const group = subtopicMap.get(subtopic)!
        const questionId = attempt.questions.id
        
        // Only add question if not already added
        if (!group.questions.find(q => q.id === questionId)) {
          group.questions.push(attempt.questions)
        }
        
        // Store user answer for this question
        if (attempt.user_answer) {
          group.userAnswers.set(questionId, attempt.user_answer)
        }
      }
    })

    // Convert to array format
    const subtopicGroups: SubtopicGroup[] = Array.from(subtopicMap.entries()).map(([subtopic_name, data]) => ({
      subtopic_name,
      questions: data.questions,
      errorCount: data.questions.length,
      userAnswers: Object.fromEntries(data.userAnswers),
    }))

    return (
      <CodificacionErrorClient 
        userId={user.id} 
        initialQuestions={[]} 
        tipo={tipo}
        subtopicGroups={subtopicGroups}
      />
    )
  }

  // Default fallback to errores-bobos
  redirect('/codificacion-error?tipo=errores-bobos')
}

