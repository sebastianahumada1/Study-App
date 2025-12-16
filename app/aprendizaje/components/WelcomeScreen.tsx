'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type WelcomeScreenProps = {
  onStartStudy: () => void
  enableAIMotivation?: boolean
}

const MOTIVATIONAL_MESSAGES = [
  "¡Cada paso que das te acerca más a tus objetivos! Hoy es un gran día para aprender algo nuevo.",
  "El conocimiento es poder, y cada sesión de estudio te hace más fuerte. ¡Vamos a por ello!",
  "Recuerda: los expertos también fueron principiantes. Tu dedicación de hoy construye tu mañana.",
  "Cada pregunta que respondes, cada concepto que dominas, te acerca más a la excelencia. ¡Sigue adelante!",
  "El aprendizaje es un viaje, no un destino. Disfruta cada momento de crecimiento. ¡Tú puedes!",
  "La consistencia supera a la perfección. Pequeños pasos diarios llevan a grandes logros.",
  "Tu futuro yo te agradecerá el esfuerzo de hoy. ¡Invierte en ti mismo!",
]

export default function WelcomeScreen({ onStartStudy, enableAIMotivation = false }: WelcomeScreenProps) {
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (enableAIMotivation) {
      loadAIMessage()
    } else {
      // Rotar mensaje por día de la semana
      const dayOfWeek = new Date().getDay()
      const index = dayOfWeek % MOTIVATIONAL_MESSAGES.length
      setMessage(MOTIVATIONAL_MESSAGES[index])
    }
  }, [enableAIMotivation])

  const loadAIMessage = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      const response = await fetch('/api/ai/motivational-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessage(data.message || MOTIVATIONAL_MESSAGES[0])
      } else {
        // Fallback a mensaje estático si falla IA
        const dayOfWeek = new Date().getDay()
        const index = dayOfWeek % MOTIVATIONAL_MESSAGES.length
        setMessage(MOTIVATIONAL_MESSAGES[index])
      }
    } catch (error) {
      console.error('Error loading AI message:', error)
      // Fallback a mensaje estático
      const dayOfWeek = new Date().getDay()
      const index = dayOfWeek % MOTIVATIONAL_MESSAGES.length
      setMessage(MOTIVATIONAL_MESSAGES[index])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-6">
        <div className="mb-8">
          <div className="text-6xl mb-6">📚</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bienvenido al Módulo de Aprendizaje
          </h1>
          {isLoading ? (
            <div className="text-lg text-gray-600 animate-pulse">
              Generando mensaje motivacional...
            </div>
          ) : (
            <p className="text-xl text-gray-700 leading-relaxed">
              {message}
            </p>
          )}
        </div>
        
        <button
          onClick={onStartStudy}
          className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
        >
          Iniciar Estudio
        </button>
      </div>
    </div>
  )
}

