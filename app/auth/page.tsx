'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type AuthMode = 'login' | 'signup'
type MessageType = 'error' | 'success' | 'info'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; type: MessageType } | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          router.push('/study')
          return
        }
      } catch (error) {
        console.error('Auth: Error checking session:', error)
      } finally {
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    try {
      const validation = authSchema.safeParse({ email, password })
      if (!validation.success) {
        setMessage({
          text: validation.error.errors[0].message,
          type: 'error',
        })
        setLoading(false)
        return
      }

      const supabase = createClient()

      if (mode === 'signup') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: validation.data.email,
          password: validation.data.password,
        })

        if (signUpError) {
          setMessage({
            text: signUpError.message,
            type: 'error',
          })
          setLoading(false)
          return
        }

        // Check if email confirmation is required
        if (signUpData.user && !signUpData.session) {
          // Email confirmation required
          setMessage({
            text: 'Cuenta creada exitosamente. Revisa tu email para confirmar tu cuenta antes de iniciar sesión.',
            type: 'info',
          })
          setEmail('')
          setPassword('')
          setMode('login')
        } else if (signUpData.session) {
          // No email confirmation required, user is logged in
          setMessage({
            text: 'Cuenta creada exitosamente. Redirigiendo...',
            type: 'success',
          })
          // Wait a moment for session to be set
          await new Promise(resolve => setTimeout(resolve, 500))
          router.push('/study')
          router.refresh()
          return
        } else {
          setMessage({
            text: 'Error al crear la cuenta. Intenta de nuevo.',
            type: 'error',
          })
        }
        setLoading(false)
      } else {
        // Login
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: validation.data.email,
          password: validation.data.password,
        })

        if (signInError) {
          setMessage({
            text: signInError.message,
            type: 'error',
          })
          setLoading(false)
          return
        }

        if (signInData.session) {
          setMessage({
            text: 'Iniciando sesión...',
            type: 'success',
          })
          // Wait a moment for session to be set in cookies
          await new Promise(resolve => setTimeout(resolve, 500))
          router.push('/study')
          router.refresh()
          return
        } else {
          setMessage({
            text: 'Error al iniciar sesión. Verifica tus credenciales.',
            type: 'error',
          })
          setLoading(false)
        }
      }
    } catch (err) {
      console.error('Auth: Unexpected error:', err)
      setMessage({
        text: 'Error inesperado. Intenta de nuevo.',
        type: 'error',
      })
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">
            {mode === 'login' ? '🔐' : '✨'}
          </div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h1>
          <p className="text-gray-600 text-sm">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Comienza tu viaje de aprendizaje'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <span className="text-indigo-500">📧</span> Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white font-medium"
              placeholder="tu@email.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <span className="text-indigo-500">🔒</span> Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white font-medium"
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {message && (
            <div
              className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 ${
                message.type === 'error'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : message.type === 'success'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-blue-50 border-blue-300 text-blue-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? '⏳ Procesando...' : mode === 'login' ? '🚀 Iniciar Sesión' : '✨ Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setMessage(null)
              setEmail('')
              setPassword('')
            }}
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm transition-colors"
            disabled={loading}
          >
            {mode === 'login'
              ? '¿No tienes cuenta? Crear una'
              : '¿Ya tienes cuenta? Iniciar sesión'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-gray-600 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    </main>
  )
}
