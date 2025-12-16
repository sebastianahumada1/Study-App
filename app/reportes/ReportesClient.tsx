'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

type Attempt = {
  id: string
  is_correct: boolean
  created_at: string
  route_name: string
  topic_name: string | null
  subtopic_name: string | null
}

type ReportesClientProps = {
  attempts: Attempt[]
}

type ReportType = 'by-date' | 'by-segment'

type DateGroupStats = {
  date: string
  total: number
  correct: number
  incorrect: number
  accuracy: number
}

type SegmentStats = {
  name: string
  total: number
  correct: number
  incorrect: number
  accuracy: number
  children?: SegmentStats[]
}

export default function ReportesClient({ attempts }: ReportesClientProps) {
  const [reportType, setReportType] = useState<ReportType>('by-date')

  // Calculate statistics by date
  const statsByDate = useMemo(() => {
    const dateGroups = new Map<string, { total: number; correct: number }>()

    attempts.forEach(attempt => {
      const date = new Date(attempt.created_at).toISOString().split('T')[0] // YYYY-MM-DD
      const existing = dateGroups.get(date) || { total: 0, correct: 0 }
      dateGroups.set(date, {
        total: existing.total + 1,
        correct: existing.correct + (attempt.is_correct ? 1 : 0),
      })
    })

    const stats: DateGroupStats[] = Array.from(dateGroups.entries())
      .map(([date, data]) => ({
        date,
        total: data.total,
        correct: data.correct,
        incorrect: data.total - data.correct,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return stats
  }, [attempts])

  // Calculate statistics by segment (route -> topic -> subtopic)
  const statsBySegment = useMemo(() => {
    const routeMap = new Map<string, Map<string, Map<string, { total: number; correct: number }>>>()

    attempts.forEach(attempt => {
      const route = attempt.route_name || 'Sin ruta'
      const topic = attempt.topic_name || 'Sin tema'
      const subtopic = attempt.subtopic_name || 'Sin subtema'

      if (!routeMap.has(route)) {
        routeMap.set(route, new Map())
      }
      const topicMap = routeMap.get(route)!

      if (!topicMap.has(topic)) {
        topicMap.set(topic, new Map())
      }
      const subtopicMap = topicMap.get(topic)!

      const existing = subtopicMap.get(subtopic) || { total: 0, correct: 0 }
      subtopicMap.set(subtopic, {
        total: existing.total + 1,
        correct: existing.correct + (attempt.is_correct ? 1 : 0),
      })
    })

    const stats: SegmentStats[] = Array.from(routeMap.entries()).map(([routeName, topicMap]) => {
      const topicStats: SegmentStats[] = Array.from(topicMap.entries()).map(([topicName, subtopicMap]) => {
        const subtopicStats: SegmentStats[] = Array.from(subtopicMap.entries()).map(([subtopicName, data]) => ({
          name: subtopicName,
          total: data.total,
          correct: data.correct,
          incorrect: data.total - data.correct,
          accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        }))

        const topicTotal = subtopicStats.reduce((sum, s) => sum + s.total, 0)
        const topicCorrect = subtopicStats.reduce((sum, s) => sum + s.correct, 0)

        return {
          name: topicName,
          total: topicTotal,
          correct: topicCorrect,
          incorrect: topicTotal - topicCorrect,
          accuracy: topicTotal > 0 ? Math.round((topicCorrect / topicTotal) * 100) : 0,
          children: subtopicStats.length > 0 ? subtopicStats : undefined,
        }
      })

      const routeTotal = topicStats.reduce((sum, t) => sum + t.total, 0)
      const routeCorrect = topicStats.reduce((sum, t) => sum + t.correct, 0)

      return {
        name: routeName,
        total: routeTotal,
        correct: routeCorrect,
        incorrect: routeTotal - routeCorrect,
        accuracy: routeTotal > 0 ? Math.round((routeCorrect / routeTotal) * 100) : 0,
        children: topicStats.length > 0 ? topicStats : undefined,
      }
    })

    return stats.sort((a, b) => b.accuracy - a.accuracy)
  }, [attempts])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'from-green-500 to-emerald-600'
    if (accuracy >= 60) return 'from-yellow-500 to-orange-600'
    return 'from-red-500 to-pink-600'
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Reportes de Precisión
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Analiza tu rendimiento con estadísticas detalladas de precisión
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

        {/* Report Type Selector */}
        <div className="mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-4">
          <div className="flex gap-3">
            <button
              onClick={() => setReportType('by-date')}
              className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                reportType === 'by-date'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Por Fecha
            </button>
            <button
              onClick={() => setReportType('by-segment')}
              className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                reportType === 'by-segment'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Por Segmento
            </button>
          </div>
        </div>

        {/* Report by Date */}
        {reportType === 'by-date' && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                📅
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Estadísticas por Fecha</h2>
                <p className="text-gray-600 text-sm">Precisión agrupada por día</p>
              </div>
            </div>

            {statsByDate.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-gray-600 text-lg">No hay datos disponibles</p>
              </div>
            ) : (
              <div className="space-y-4">
                {statsByDate.map((stat) => (
                  <div
                    key={stat.date}
                    className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border-2 border-gray-200 hover:border-indigo-300 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {formatDate(stat.date)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {stat.total} {stat.total === 1 ? 'pregunta' : 'preguntas'}
                        </p>
                      </div>
                      <div className={`px-6 py-3 rounded-xl bg-gradient-to-r ${getAccuracyColor(stat.accuracy)} text-white font-bold text-2xl shadow-lg`}>
                        {stat.accuracy}%
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                        <p className="text-xs font-semibold text-green-700 mb-1 uppercase">Correctas</p>
                        <p className="text-2xl font-bold text-green-600">{stat.correct}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                        <p className="text-xs font-semibold text-red-700 mb-1 uppercase">Incorrectas</p>
                        <p className="text-2xl font-bold text-red-600">{stat.incorrect}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 mb-1 uppercase">Total</p>
                        <p className="text-2xl font-bold text-blue-600">{stat.total}</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full bg-gradient-to-r ${getAccuracyColor(stat.accuracy)} transition-all duration-300`}
                        style={{ width: `${stat.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report by Segment */}
        {reportType === 'by-segment' && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                📊
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Precisión por Segmento</h2>
                <p className="text-gray-600 text-sm">Ruta → Tema → Subtema</p>
              </div>
            </div>

            {statsBySegment.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-gray-600 text-lg">No hay datos disponibles</p>
              </div>
            ) : (
              <div className="space-y-6">
                {statsBySegment.map((routeStat) => (
                  <RouteSegmentCard key={routeStat.name} stat={routeStat} level={0} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function RouteSegmentCard({ stat, level }: { stat: SegmentStats; level: number }) {
  const [isExpanded, setIsExpanded] = useState(level === 0) // Routes expanded by default

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'from-green-500 to-emerald-600'
    if (accuracy >= 60) return 'from-yellow-500 to-orange-600'
    return 'from-red-500 to-pink-600'
  }

  const getLevelColors = (level: number) => {
    if (level === 0) return 'from-indigo-500 to-purple-600'
    if (level === 1) return 'from-purple-500 to-pink-600'
    return 'from-pink-500 to-red-600'
  }

  const hasChildren = stat.children && stat.children.length > 0

  return (
    <div className={`bg-gradient-to-r ${getLevelColors(level)} rounded-xl p-6 shadow-lg border-2 border-white/20`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          {hasChildren && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white hover:text-gray-200 transition-colors text-xl"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="w-6" />}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">
              {level === 0 && '🗺️'} {level === 1 && '📚'} {level === 2 && '🔖'} {stat.name}
            </h3>
            <p className="text-white/80 text-sm">
              {stat.total} {stat.total === 1 ? 'pregunta' : 'preguntas'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white/80 text-xs mb-1">Precisión</p>
            <p className="text-2xl font-bold text-white">{stat.accuracy}%</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getAccuracyColor(stat.accuracy)} flex items-center justify-center text-white font-bold`}>
              {stat.accuracy}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
          <p className="text-white/80 text-xs font-semibold mb-1">Correctas</p>
          <p className="text-xl font-bold text-white">{stat.correct}</p>
        </div>
        <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
          <p className="text-white/80 text-xs font-semibold mb-1">Incorrectas</p>
          <p className="text-xl font-bold text-white">{stat.incorrect}</p>
        </div>
        <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
          <p className="text-white/80 text-xs font-semibold mb-1">Total</p>
          <p className="text-xl font-bold text-white">{stat.total}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden mb-4">
        <div
          className={`h-2 rounded-full bg-gradient-to-r ${getAccuracyColor(stat.accuracy)} transition-all duration-300`}
          style={{ width: `${stat.accuracy}%` }}
        />
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-4 space-y-3 pl-4 border-l-2 border-white/30">
          {stat.children!.map((childStat) => (
            <RouteSegmentCard key={childStat.name} stat={childStat} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

