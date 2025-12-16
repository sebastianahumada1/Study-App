'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

type Question = {
  id: string
  prompt: string
  answer_key: string
  explanation: string | null
  topic_id: string
  options: string[] | null
  topics: {
    id: string
    name: string
  }
}

type Topic = {
  id: string
  name: string
}

type StudyClientProps = {
  userId: string
  questions: Question[]
  topics: Topic[]
}

export default function StudyClient({ userId, questions, topics }: StudyClientProps) {
  const router = useRouter()
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    isCorrect: boolean
    explanation: string | null
  } | null>(null)

  const currentQuestion = questions[selectedQuestionIndex]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOption || !currentQuestion) return

    setIsSubmitting(true)
    setResult(null)

    try {
      // Compare selected option with answer key
      const isCorrect = selectedOption === currentQuestion.answer_key

      // Save attempt to database
      const supabase = createClient()
      const { error: attemptError } = await supabase.from('attempts').insert({
        user_id: userId,
        question_id: currentQuestion.id,
        is_correct: isCorrect,
        user_answer: selectedOption,
      })

      if (attemptError) {
        console.error('Study: Error saving attempt:', attemptError)
        alert('Error al guardar la respuesta. Intenta de nuevo.')
        setIsSubmitting(false)
        return
      }

      setResult({
        isCorrect,
        explanation: currentQuestion.explanation,
      })
    } catch (error) {
      console.error('Study: Error submitting answer:', error)
      alert('Error al guardar la respuesta. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (selectedQuestionIndex < questions.length - 1) {
      setSelectedQuestionIndex(selectedQuestionIndex + 1)
      setSelectedOption('')
      setResult(null)
    }
  }

  const handlePrevious = () => {
    if (selectedQuestionIndex > 0) {
      setSelectedQuestionIndex(selectedQuestionIndex - 1)
      setSelectedOption('')
      setResult(null)
    }
  }

  const handleOptionChange = (option: string) => {
    if (!result) {
      setSelectedOption(option)
    }
  }

  if (!currentQuestion) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">No hay preguntas disponibles.</p>
          </div>
        </div>
      </main>
    )
  }

  const options = currentQuestion.options || []

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Simulacro - Hepatitis B</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Inicio
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {currentQuestion.topics.name}
            </span>
            <span className="text-sm text-gray-600">
              Pregunta {selectedQuestionIndex + 1} de {questions.length}
            </span>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {currentQuestion.prompt}
          </h2>

          {result && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                result.isCorrect
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <p
                className={`font-semibold mb-2 ${
                  result.isCorrect ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {result.isCorrect ? '✓ Correcto' : '✗ Incorrecto'}
              </p>
              {result.explanation && (
                <p
                  className={`text-sm ${
                    result.isCorrect ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {result.explanation}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {options.map((option, index) => {
                const optionLabel = String.fromCharCode(65 + index) + ') ' + option
                const isSelected = selectedOption === option
                const isDisabled = !!result

                return (
                  <label
                    key={index}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? result
                          ? result.isCorrect
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-500 bg-red-50'
                          : 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${isDisabled ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={option}
                      checked={isSelected}
                      onChange={() => handleOptionChange(option)}
                      disabled={isDisabled}
                      className="mt-1 mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex-1 text-gray-900">{optionLabel}</span>
                  </label>
                )
              })}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !selectedOption || !!result}
                className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : result ? 'Ya respondida' : 'Enviar Respuesta'}
              </button>
            </div>
          </form>

          <div className="flex gap-4 mt-6">
            <button
              onClick={handlePrevious}
              disabled={selectedQuestionIndex === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <button
              onClick={handleNext}
              disabled={selectedQuestionIndex === questions.length - 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
