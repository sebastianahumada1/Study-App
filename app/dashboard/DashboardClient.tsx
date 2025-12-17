'use client'

import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

type DashboardClientProps = {
  totalAttempts: number
  correctAttempts: number
  incorrectAttempts: number
  accuracy: number
}

export default function DashboardClient({
  totalAttempts,
  correctAttempts,
  incorrectAttempts,
  accuracy,
}: DashboardClientProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Inicio
            </h1>
            <p className="text-gray-600 text-sm md:text-base">Resumen de tu progreso de estudio</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 hover:shadow-md transition-all duration-200 border border-indigo-100"
            >
              👤 Perfil
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* First Row: Aprendizaje, Banco de Preguntas, Simulacro, Tutor IA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Link
            href="/aprendizaje"
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-indigo-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📚</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Aprendizaje</h3>
                <p className="text-sm text-gray-600">Estudia el contenido</p>
              </div>
            </div>
          </Link>

          <Link
            href="/banco-preguntas"
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-green-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📝</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Banco de Preguntas</h3>
                <p className="text-sm text-gray-600">Practica todas las preguntas</p>
              </div>
            </div>
          </Link>

          <Link
            href="/study"
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">✍️</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Simulacro</h3>
                <p className="text-sm text-gray-600">Examen de práctica</p>
              </div>
            </div>
          </Link>

          <Link
            href="/tutor"
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">👨‍🏫</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Tutor IA</h3>
                <p className="text-sm text-gray-600">Aprende con tutoría personalizada</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Second Row: Dashboard de Errores, Codificación del Error */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Link
            href="/dashboard-errores"
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-red-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-red-500 to-pink-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📊</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Dashboard de Errores</h3>
                <p className="text-sm text-gray-600">Revisa tus errores</p>
              </div>
            </div>
          </Link>

          <Link
            href="/codificacion-error"
            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">🔄</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Codificación del Error</h3>
                <p className="text-sm text-gray-600">Refuerza errores bobos</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Third Row: Reportes and Stats Summary (smaller) */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link
            href="/reportes"
            className="flex-1 min-w-[200px] bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 hover:shadow-xl transition-all duration-300 border-l-4 border-indigo-400 hover:border-indigo-500 transform hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">📈</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Reportes</h3>
                <p className="text-xs text-gray-600">Estadísticas de precisión</p>
              </div>
            </div>
          </Link>

          {/* Smaller Stats Cards */}
          <div className="flex-1 min-w-[150px] bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border-l-4 border-gray-400 hover:border-indigo-500 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Total Intentos
              </h3>
              <span className="text-lg">📈</span>
            </div>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">{totalAttempts}</p>
          </div>

          <div className="flex-1 min-w-[150px] bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border-l-4 border-green-400 hover:border-green-500 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Correctas
              </h3>
              <span className="text-lg">✅</span>
            </div>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {correctAttempts}
            </p>
          </div>

          <div className="flex-1 min-w-[150px] bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border-l-4 border-red-400 hover:border-red-500 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Incorrectas
              </h3>
              <span className="text-lg">❌</span>
            </div>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              {incorrectAttempts}
            </p>
          </div>

          <div className="flex-1 min-w-[150px] bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border-l-4 border-indigo-400 hover:border-indigo-500 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Precisión
              </h3>
              <span className="text-lg">🎯</span>
            </div>
            <p className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{accuracy}%</p>
          </div>
        </div>

        {totalAttempts === 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-xl font-semibold text-gray-700 mb-2">
              Aún no has realizado ningún intento
            </p>
            <p className="text-gray-500 mb-6">Comienza a estudiar para ver tus estadísticas</p>
            <Link
              href="/aprendizaje"
              className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              🚀 Comenzar a Estudiar
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
