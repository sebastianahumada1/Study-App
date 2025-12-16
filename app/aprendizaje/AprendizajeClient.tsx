'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import RouteBuilder from './components/RouteBuilder'
import MainPlanner from './components/MainPlanner'

type Route = {
  id: string
  name: string
  objective: string | null
  created_at: string
  items: any[]
}

type AprendizajeClientProps = {
  userId: string
  routes: Route[]
  enableAIMotivation?: boolean
}

type ModuleState = 'route-builder' | 'planner'

export default function AprendizajeClient({ userId, routes, enableAIMotivation = false }: AprendizajeClientProps) {
  const searchParams = useSearchParams()
  const routeIdFromQuery = searchParams.get('routeId')
  const [state, setState] = useState<ModuleState>('route-builder')
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(routeIdFromQuery)

  const selectedRoute = routes.find(r => r.id === selectedRouteId)

  // Update selectedRouteId when routeIdFromQuery changes
  useEffect(() => {
    if (routeIdFromQuery && routes.some(r => r.id === routeIdFromQuery)) {
      setSelectedRouteId(routeIdFromQuery)
    }
  }, [routeIdFromQuery, routes])

  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId)
    setState('planner')
  }

  const handleBackToRoutes = () => {
    setState('route-builder')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Módulo de Aprendizaje
            </h1>
            <p className="text-gray-600 text-sm md:text-base">Crea rutas de estudio y planifica tu aprendizaje</p>
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

        {/* Navigation Tabs */}
        <div className="mb-6 flex gap-2 bg-white/80 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-white/20">
          <button
            onClick={() => setState('route-builder')}
            className={`px-6 py-3 font-bold rounded-lg transition-all duration-200 ${
              state === 'route-builder'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            📚 Ruta de Estudio
          </button>
          <button
            onClick={() => setState('planner')}
            className={`px-6 py-3 font-bold rounded-lg transition-all duration-200 ${
              state === 'planner'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            📅 Planificador
          </button>
        </div>

        {/* Content based on state */}
        {state === 'route-builder' && (
          <RouteBuilder
            userId={userId}
            routes={routes}
            onRouteSelect={handleRouteSelect}
          />
        )}

        {state === 'planner' && (
          <MainPlanner
            userId={userId}
            routes={routes}
          />
        )}
      </div>
    </main>
  )
}
