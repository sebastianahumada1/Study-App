'use client'

import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

type ProfileClientProps = {
  userId: string
  email: string
  metadata: Record<string, any>
}

export default function ProfileClient({ userId, email, metadata }: ProfileClientProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Perfil del Estudiante
            </h1>
            <p className="text-gray-600 text-sm md:text-base">Información de tu cuenta</p>
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

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border-l-4 border-indigo-500">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-indigo-500 text-xl">🆔</span> ID de Usuario
              </label>
              <p className="text-gray-900 bg-white p-4 rounded-lg font-mono text-sm border-2 border-gray-200 shadow-sm">
                {userId}
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-l-4 border-blue-500">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-blue-500 text-xl">📧</span> Email
              </label>
              <p className="text-gray-900 bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm font-medium">
                {email}
              </p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-l-4 border-green-500">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-green-500 text-xl">📅</span> Fecha de Registro
              </label>
              <p className="text-gray-900 bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm font-medium">
                {new Date().toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {Object.keys(metadata).length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-l-4 border-purple-500">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-purple-500 text-xl">ℹ️</span> Información Adicional
                </label>
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                  <pre className="text-sm text-gray-900 overflow-x-auto">
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

