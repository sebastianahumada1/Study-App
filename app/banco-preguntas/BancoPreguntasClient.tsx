'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'

type Question = {
  id: string
  prompt: string
  answer_key: string
  explanation: string | null
  options: string[] | null
  topic_name: string | null
  subtopic_name: string | null
}

type Route = {
  id: string
  name: string
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

type BancoPreguntasClientProps = {
  questions: Question[]
  routes: Route[]
}

export default function BancoPreguntasClient({ questions: initialQuestions, routes }: BancoPreguntasClientProps) {
  const router = useRouter()
  const [questions, setQuestions] = useState(initialQuestions)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    prompt: '',
    answer_key: '',
    explanation: '',
    options: ['', '', '', ''],
    topic_name: '',
    subtopic_name: '',
  })
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Filter states
  const [filterRouteId, setFilterRouteId] = useState<string>('')
  const [filterTopicId, setFilterTopicId] = useState<string>('')
  const [filterSubtopicName, setFilterSubtopicName] = useState<string>('')
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResults, setCsvResults] = useState<{ success: number; errors: Array<{ row: number; error: string }> } | null>(null)
  
  // AI Generation states
  const [showAIModal, setShowAIModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [numberOfQuestions, setNumberOfQuestions] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState<'baja' | 'media' | 'alta'>('media')
  const [generatedQuestions, setGeneratedQuestions] = useState<Array<{
    prompt: string
    options: string[]
    answer_key: string
    explanation: string
  }>>([])

  // Get selected route
  const selectedRoute = routes.find(r => r.id === selectedRouteId)
  
  // Get topics from selected route
  const availableTopics = selectedRoute?.items.filter(item => item.item_type === 'topic') || []
  
  // Get subtopics from selected topic
  const selectedTopic = availableTopics.find(t => t.id === selectedTopicId)
  const availableSubtopics = selectedTopic?.children?.filter(item => item.item_type === 'subtopic') || []

  const handleAddNew = () => {
    setFormData({
      prompt: '',
      answer_key: '',
      explanation: '',
      options: ['', '', '', ''],
      topic_name: '',
      subtopic_name: '',
    })
    setSelectedRouteId('')
    setSelectedTopicId('')
    setShowAddForm(true)
    setEditingId(null)
  }

  const handleEdit = (question: Question) => {
    setFormData({
      prompt: question.prompt,
      answer_key: question.answer_key,
      explanation: question.explanation || '',
      options: question.options || ['', '', '', ''],
      topic_name: question.topic_name || '',
      subtopic_name: question.subtopic_name || '',
    })
    
    // Try to find the route and topic based on topic_name and subtopic_name
    let foundRouteId = ''
    let foundTopicId = ''
    
    if (question.topic_name) {
      for (const route of routes) {
        for (const topic of route.items) {
          if (topic.item_type === 'topic' && topic.custom_name === question.topic_name) {
            foundRouteId = route.id
            foundTopicId = topic.id
            
            // If there's a subtopic, find it
            if (question.subtopic_name && topic.children) {
              const subtopic = topic.children.find(
                (st: any) => st.item_type === 'subtopic' && st.custom_name === question.subtopic_name
              )
              // We'll use foundTopicId to show the subtopics dropdown
            }
            break
          }
        }
        if (foundRouteId) break
      }
    }
    
    setSelectedRouteId(foundRouteId)
    setSelectedTopicId(foundTopicId)
    setEditingId(question.id)
    setShowAddForm(true)
  }

  const handleDelete = async (questionId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta pregunta?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (error) {
        console.error('Error deleting question:', error)
        alert('Error al eliminar la pregunta')
        return
      }

      setQuestions(questions.filter(q => q.id !== questionId))
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar la pregunta')
    }
  }

  // Download CSV template
  const downloadCSVTemplate = () => {
    const headers = ['pregunta', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'respuesta_correcta', 'explicacion', 'ruta', 'tema', 'subtema']
    const example = [
      {
        pregunta: '¿Cuál es la causa más común de hepatitis B?',
        opcion_a: 'Virus',
        opcion_b: 'Bacteria',
        opcion_c: 'Parásito',
        opcion_d: 'Hongos',
        respuesta_correcta: 'A',
        explicacion: 'El virus de la hepatitis B es la causa más común de esta enfermedad.',
        ruta: 'Ruta de Medicina',
        tema: 'Hepatitis B',
        subtema: 'Etiología'
      }
    ]
    
    const csv = Papa.unparse([headers, ...example.map(e => Object.values(e))])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_preguntas.csv'
    link.click()
  }

  // Handle CSV file selection
  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      alert('Por favor selecciona un archivo CSV')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 5MB.')
      return
    }

    setCsvFile(file)
    setCsvResults(null)

    // Parse and preview
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          alert(`Error al parsear CSV: ${results.errors[0].message}`)
          return
        }
        setCsvPreview(results.data.slice(0, 5)) // Show first 5 rows
      },
      error: (error) => {
        alert(`Error al leer el archivo: ${error.message}`)
      }
    })
  }

  // Validate and map CSV row to question
  const validateAndMapRow = (row: any, rowIndex: number): { valid: boolean; question?: any; error?: string } => {
    // Required fields
    if (!row.pregunta || !row.pregunta.trim()) {
      return { valid: false, error: 'Falta la pregunta' }
    }

    // Options validation
    const options = [
      row.opcion_a,
      row.opcion_b,
      row.opcion_c,
      row.opcion_d
    ].filter(opt => opt && opt.trim())

    if (options.length < 2) {
      return { valid: false, error: 'Debe tener al menos 2 opciones' }
    }

    // Answer key validation
    const answerKey = row.respuesta_correcta?.trim().toUpperCase()
    if (!answerKey || !['A', 'B', 'C', 'D'].includes(answerKey)) {
      return { valid: false, error: 'Respuesta correcta debe ser A, B, C o D' }
    }

    // Check if answer key matches available options
    const answerIndex = answerKey.charCodeAt(0) - 65 // A=0, B=1, etc.
    if (answerIndex >= options.length) {
      return { valid: false, error: 'La respuesta correcta no coincide con las opciones disponibles' }
    }

    // Route/Topic validation
    if (!row.ruta || !row.tema) {
      return { valid: false, error: 'Debe especificar ruta y tema' }
    }

    // Find route
    const route = routes.find(r => r.name === row.ruta.trim())
    if (!route) {
      return { valid: false, error: `Ruta "${row.ruta}" no encontrada` }
    }

    // Find topic
    const topic = route.items.find(
      item => item.item_type === 'topic' && item.custom_name === row.tema.trim()
    )
    if (!topic) {
      return { valid: false, error: `Tema "${row.tema}" no encontrado en la ruta "${row.ruta}"` }
    }

    // Find subtopic if provided
    let subtopicName: string | null = null
    if (row.subtema && row.subtema.trim()) {
      const subtopic = topic.children?.find(
        item => item.item_type === 'subtopic' && item.custom_name === row.subtema.trim()
      )
      if (!subtopic) {
        return { valid: false, error: `Subtema "${row.subtema}" no encontrado en el tema "${row.tema}"` }
      }
      subtopicName = row.subtema.trim()
    } else if (topic.children && topic.children.length > 0) {
      // If topic has subtopics but none was provided
      return { valid: false, error: `El tema "${row.tema}" tiene subtemas. Debes especificar uno.` }
    }

    return {
      valid: true,
      question: {
        prompt: row.pregunta.trim(),
        answer_key: answerKey,
        explanation: row.explicacion?.trim() || null,
        options: options,
        topic_name: row.tema.trim(),
        subtopic_name: subtopicName,
      }
    }
  }

  // Upload CSV questions
  const handleCSVUpload = async () => {
    if (!csvFile) return

    setCsvUploading(true)
    setCsvResults(null)

    try {
      const supabase = createClient()
      const results: { success: number; errors: Array<{ row: number; error: string }> } = {
        success: 0,
        errors: []
      }

      // Parse CSV
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (parseResults) => {
          if (parseResults.errors.length > 0) {
            alert(`Error al parsear CSV: ${parseResults.errors[0].message}`)
            setCsvUploading(false)
            return
          }

          const validQuestions: any[] = []
          
          // Validate all rows
          parseResults.data.forEach((row: any, index: number) => {
            const validation = validateAndMapRow(row, index + 2) // +2 because CSV has header and is 1-indexed
            if (validation.valid && validation.question) {
              validQuestions.push(validation.question)
            } else {
              results.errors.push({
                row: index + 2,
                error: validation.error || 'Error desconocido'
              })
            }
          })

          if (validQuestions.length === 0) {
            alert('No hay preguntas válidas para insertar. Revisa los errores.')
            setCsvResults(results)
            setCsvUploading(false)
            return
          }

          // Insert questions in batch
          const { data, error } = await supabase
            .from('questions')
            .insert(validQuestions)
            .select()

          if (error) {
            console.error('Error inserting questions:', error)
            alert(`Error al insertar preguntas: ${error.message}`)
            setCsvUploading(false)
            return
          }

          results.success = data?.length || 0
          setCsvResults(results)
          setCsvUploading(false)

          // Refresh page to show new questions
          if (results.success > 0) {
            router.refresh()
          }
        },
        error: (error) => {
          alert(`Error al leer el archivo: ${error.message}`)
          setCsvUploading(false)
        }
      })
    } catch (error: any) {
      console.error('Error uploading CSV:', error)
      alert(`Error al procesar el archivo: ${error.message}`)
      setCsvUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.prompt || !formData.answer_key) {
      alert('Completa todos los campos requeridos')
      return
    }

    if (!selectedRouteId || !selectedTopicId) {
      alert('Debes seleccionar una ruta y un tema')
      return
    }

    // If the topic has subtopics, subtopic_name is required
    if (availableSubtopics.length > 0 && !formData.subtopic_name) {
      alert('Este tema tiene subtemas. Debes seleccionar un subtema')
      return
    }
    
    // If topic has no subtopics, ensure subtopic_name is empty
    if (availableSubtopics.length === 0) {
      setFormData({ ...formData, subtopic_name: '' })
    }

    if (formData.options.filter(o => o.trim()).length < 2) {
      alert('Debes agregar al menos 2 opciones')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const optionsJson = formData.options.filter(o => o.trim())

      if (editingId) {
        // Update existing question
        const { error } = await supabase
          .from('questions')
          .update({
            prompt: formData.prompt,
            answer_key: formData.answer_key,
            explanation: formData.explanation || null,
            options: optionsJson,
            topic_name: formData.topic_name || null,
            subtopic_name: formData.subtopic_name || null,
          })
          .eq('id', editingId)

        if (error) {
          console.error('Error updating question:', error)
          alert('Error al actualizar la pregunta')
          setIsSubmitting(false)
          return
        }

        // Refresh page to get updated data
        router.refresh()
      } else {
        // Create new question
        const { error } = await supabase
          .from('questions')
          .insert({
            prompt: formData.prompt,
            answer_key: formData.answer_key,
            explanation: formData.explanation || null,
            options: optionsJson,
            topic_name: formData.topic_name || null,
            subtopic_name: formData.subtopic_name || null,
          })

        if (error) {
          console.error('Error creating question:', error)
          alert('Error al crear la pregunta')
          setIsSubmitting(false)
          return
        }

        // Refresh page to get updated data
        router.refresh()
      }

      setShowAddForm(false)
      setEditingId(null)
      setFormData({
        prompt: '',
        answer_key: '',
        explanation: '',
        options: ['', '', '', ''],
        topic_name: '',
        subtopic_name: '',
      })
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la pregunta')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, ''],
    })
  }

  const removeOption = (index: number) => {
    const newOptions = formData.options.filter((_, i) => i !== index)
    setFormData({ ...formData, options: newOptions })
  }

  // Get selected subtopic info from filters
  const getSelectedSubtopicInfo = () => {
    if (!filterRouteId || !filterTopicId || !filterSubtopicName) return null
    
    const route = routes.find(r => r.id === filterRouteId)
    if (!route) return null
    
    const topic = route.items.find(item => item.id === filterTopicId && item.item_type === 'topic')
    if (!topic || !topic.children) return null
    
    const subtopic = topic.children.find(
      (child: any) => child.item_type === 'subtopic' && child.custom_name === filterSubtopicName
    )
    
    if (!subtopic) return null
    
    return {
      routeName: route.name,
      topicName: topic.custom_name || '',
      subtopicName: filterSubtopicName,
    }
  }

  const handleGenerateWithAI = async () => {
    const subtopicInfo = getSelectedSubtopicInfo()
    if (!subtopicInfo) {
      alert('Por favor, selecciona una ruta, tema y subtema en los filtros')
      return
    }

    if (numberOfQuestions < 1 || numberOfQuestions > 20) {
      alert('El número de preguntas debe estar entre 1 y 20')
      return
    }

    setIsGenerating(true)
    setGeneratedQuestions([])

    try {
      const response = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtopicName: subtopicInfo.subtopicName,
          topicName: subtopicInfo.topicName,
          numberOfQuestions,
          difficulty: aiDifficulty,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al generar preguntas')
      }

      const { questions } = await response.json()
      setGeneratedQuestions(questions)
    } catch (error: any) {
      console.error('Error generating questions with AI:', error)
      alert(error.message || 'Error al generar preguntas con IA')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveGeneratedQuestions = async () => {
    const subtopicInfo = getSelectedSubtopicInfo()
    if (!subtopicInfo || generatedQuestions.length === 0) return

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      
      const questionsToInsert = generatedQuestions.map(q => ({
        prompt: q.prompt,
        answer_key: q.answer_key,
        explanation: q.explanation,
        options: q.options,
        topic_name: subtopicInfo.topicName,
        subtopic_name: subtopicInfo.subtopicName,
      }))

      const { error } = await supabase
        .from('questions')
        .insert(questionsToInsert)

      if (error) {
        console.error('Error saving generated questions:', error)
        alert('Error al guardar las preguntas generadas')
        setIsSubmitting(false)
        return
      }

      // Refresh page to get updated data
      router.refresh()
      setShowAIModal(false)
      setGeneratedQuestions([])
      setNumberOfQuestions(5)
      setAiDifficulty('media')
      alert(`Se guardaron ${generatedQuestions.length} preguntas exitosamente`)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar las preguntas')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get unique topic and subtopic names from questions
  // Filter logic
  const filteredRoute = routes.find(r => r.id === filterRouteId)
  const filteredTopics = filteredRoute?.items.filter(item => item.item_type === 'topic') || []
  const filteredTopic = filteredTopics.find(t => t.id === filterTopicId)
  const filteredSubtopics = filteredTopic?.children?.filter(item => item.item_type === 'subtopic') || []

  const filteredQuestions = questions.filter(q => {
    // Filter by route (topic_name must match a topic in the selected route)
    if (filterRouteId) {
      const routeTopics = filteredRoute?.items
        .filter(item => item.item_type === 'topic')
        .map(item => item.custom_name) || []
      
      if (!routeTopics.includes(q.topic_name)) {
        return false
      }
    }

    // Filter by topic
    if (filterTopicId && filteredTopic) {
      if (q.topic_name !== filteredTopic.custom_name) {
        return false
      }
    }

    // Filter by subtopic (only if explicitly selected)
    if (filterSubtopicName) {
      if (q.subtopic_name !== filterSubtopicName) {
        return false
      }
    }

    return true
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Banco de Preguntas
            </h1>
            <p className="text-gray-600 text-sm md:text-base">Gestiona y organiza tus preguntas de estudio</p>
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

        {/* Filter Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
            <h3 className="text-lg font-bold text-gray-800">Filtros de Búsqueda</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Route Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="text-indigo-500">📍</span> Ruta
              </label>
              <select
                value={filterRouteId}
                onChange={(e) => {
                  setFilterRouteId(e.target.value)
                  setFilterTopicId('')
                  setFilterSubtopicName('')
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-indigo-300 cursor-pointer"
              >
                <option value="">Todas las rutas</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Filter */}
            {filterRouteId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left duration-300">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-purple-500">📚</span> Tema
                </label>
                <select
                  value={filterTopicId}
                  onChange={(e) => {
                    setFilterTopicId(e.target.value)
                    setFilterSubtopicName('')
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-purple-300 cursor-pointer"
                >
                  <option value="">Todos los temas</option>
                  {filteredTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.custom_name || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subtopic Filter */}
            {filterTopicId && filteredSubtopics.length > 0 && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left duration-300">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-pink-500">🔖</span> Subtema
                </label>
                <select
                  value={filterSubtopicName}
                  onChange={(e) => setFilterSubtopicName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-pink-300 cursor-pointer"
                >
                  <option value="">Todos los subtemas</option>
                  {filteredSubtopics.map((subtopic) => (
                    <option key={subtopic.id} value={subtopic.custom_name || ''}>
                      {subtopic.custom_name || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters Button */}
            {(filterRouteId || filterTopicId || filterSubtopicName) && (
              <div className="flex items-end animate-in fade-in slide-in-from-right duration-300">
                <button
                  onClick={() => {
                    setFilterRouteId('')
                    setFilterTopicId('')
                    setFilterSubtopicName('')
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg border border-gray-300"
                >
                  🗑️ Limpiar Filtros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 mb-6 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {editingId ? '✏️' : '➕'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? 'Editar Pregunta' : 'Agregar Nueva Pregunta'}
                </h2>
                <p className="text-sm text-gray-500">Completa todos los campos requeridos</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-indigo-500">📍</span> Ruta de Estudio *
                </label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => {
                    setSelectedRouteId(e.target.value)
                    setSelectedTopicId('')
                    setFormData({ ...formData, topic_name: '', subtopic_name: '' })
                  }}
                  required
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

              {selectedRouteId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-purple-500">📚</span> Tema *
                  </label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => {
                      setSelectedTopicId(e.target.value)
                      const selectedTopic = availableTopics.find(t => t.id === e.target.value)
                      setFormData({ 
                        ...formData, 
                        topic_name: selectedTopic?.custom_name || '',
                        subtopic_name: '' 
                      })
                    }}
                    required
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
              )}

              {selectedTopicId && availableSubtopics.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-pink-500">🔖</span> Subtema *
                  </label>
                  <select
                    value={formData.subtopic_name}
                    onChange={(e) => {
                      setFormData({ ...formData, subtopic_name: e.target.value })
                    }}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-pink-300 cursor-pointer"
                  >
                    <option value="">Selecciona un subtema</option>
                    {availableSubtopics.map((subtopic) => (
                      <option key={subtopic.id} value={subtopic.custom_name || ''}>
                        {subtopic.custom_name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {selectedTopicId && availableSubtopics.length === 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Este tema no tiene subtemas. La pregunta se vinculará directamente al tema.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-blue-500">❓</span> Pregunta *
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white font-medium text-gray-700 placeholder-gray-400 resize-none"
                  placeholder="Escribe la pregunta aquí..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-green-500">📝</span> Opciones de Respuesta *
                </label>
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Opción ${String.fromCharCode(65 + index)}`}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 bg-white font-medium text-gray-700"
                      />
                      {formData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="px-4 py-3 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-xl hover:from-green-200 hover:to-emerald-200 font-semibold transition-all duration-200 shadow-md hover:shadow-lg border-2 border-green-200"
                  >
                    ➕ Agregar Opción
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-yellow-500">✅</span> Respuesta Correcta *
                </label>
                <select
                  value={formData.answer_key}
                  onChange={(e) => setFormData({ ...formData, answer_key: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all duration-200 bg-white font-medium text-gray-700 hover:border-yellow-300 cursor-pointer"
                >
                  <option value="">Selecciona la respuesta correcta</option>
                  {formData.options.map((option, index) => {
                    if (!option.trim()) return null
                    return (
                      <option key={index} value={String.fromCharCode(65 + index)}>
                        {String.fromCharCode(65 + index)}) {option}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-cyan-500">💡</span> Explicación
                </label>
                <textarea
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all duration-200 bg-white font-medium text-gray-700 placeholder-gray-400 resize-none"
                  placeholder="Explicación de la respuesta correcta..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {isSubmitting ? '⏳ Guardando...' : editingId ? '💾 Actualizar' : '✨ Agregar Pregunta'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingId(null)
                  }}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Questions List */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-3xl">📋</span>
                Preguntas
                <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full text-sm font-bold shadow-md">
                  {filteredQuestions.length}
                </span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">Gestiona tu banco de preguntas</p>
            </div>
            {!showAddForm && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCSVModal(true)
                    setCsvFile(null)
                    setCsvPreview([])
                    setCsvResults(null)
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  📄 CSV
                </button>
                <button
                  onClick={() => {
                    // Check if subtopic is selected in filters
                    if (!filterRouteId || !filterTopicId || !filterSubtopicName) {
                      alert('Por favor, selecciona una ruta, tema y subtema en los filtros antes de generar preguntas con IA')
                      return
                    }
                    setShowAIModal(true)
                    setGeneratedQuestions([])
                  }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  🤖 IA
                </button>
                <button
                  onClick={handleAddNew}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-5 py-3 rounded-xl font-bold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  ✏️ Manual
                </button>
              </div>
            )}
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">No hay preguntas disponibles</p>
              <p className="text-gray-500 mb-6">Comienza agregando tu primera pregunta</p>
              <button
                onClick={handleAddNew}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                ➕ Agregar Primera Pregunta
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {filteredQuestions.map((question, idx) => {
                const options = question.options || []
                return (
                  <div 
                    key={question.id} 
                    className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-200 p-6 transition-all duration-300 transform hover:-translate-y-1"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Category Badge */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-full shadow-md">
                            {question.subtopic_name || question.topic_name || 'Sin categoría'}
                          </span>
                        </div>
                        
                        {/* Question */}
                        <h3 className="text-lg font-bold text-gray-900 mb-5 leading-relaxed">
                          {question.prompt}
                        </h3>
                        
                        {/* Options */}
                        <div className="space-y-3 mb-5">
                          {options.map((option, index) => {
                            const letter = String.fromCharCode(65 + index)
                            const isCorrect = letter === question.answer_key
                            return (
                              <div
                                key={index}
                                className={`p-4 rounded-xl transition-all duration-200 ${
                                  isCorrect
                                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 shadow-md'
                                    : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm ${
                                    isCorrect
                                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    {letter}
                                  </div>
                                  <span className={`font-medium flex-1 ${
                                    isCorrect ? 'text-green-800' : 'text-gray-700'
                                  }`}>
                                    {option}
                                  </span>
                                  {isCorrect && (
                                    <span className="text-green-600 font-bold text-lg">✓</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        
                        {/* Explanation */}
                        {question.explanation && (
                          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-400 rounded-xl p-4 mb-4 shadow-sm">
                            <p className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                              <span className="text-lg">💡</span> Explicación:
                            </p>
                            <p className="text-sm text-blue-800 leading-relaxed">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleEdit(question)}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(question.id)}
                          className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* CSV Upload Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Cargar Preguntas desde CSV</h2>
              <button
                onClick={() => {
                  setShowCSVModal(false)
                  setCsvFile(null)
                  setCsvPreview([])
                  setCsvResults(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Formato del CSV:</h3>
              <p className="text-sm text-blue-800 mb-2">
                El archivo CSV debe tener las siguientes columnas:
              </p>
              <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                <li><strong>pregunta</strong> - Texto de la pregunta (requerido)</li>
                <li><strong>opcion_a, opcion_b, opcion_c, opcion_d</strong> - Opciones de respuesta (mínimo 2 requeridas)</li>
                <li><strong>respuesta_correcta</strong> - A, B, C o D (requerido)</li>
                <li><strong>explicacion</strong> - Explicación de la respuesta (opcional)</li>
                <li><strong>ruta</strong> - Nombre de la ruta de estudio (requerido)</li>
                <li><strong>tema</strong> - Nombre del tema (requerido)</li>
                <li><strong>subtema</strong> - Nombre del subtema (requerido si el tema tiene subtemas)</li>
              </ul>
              <button
                onClick={downloadCSVTemplate}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                📥 Descargar Template CSV
              </button>
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar archivo CSV
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Preview */}
            {csvPreview.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Vista previa (primeras 5 filas):
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(csvPreview[0] || {}).map((key) => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          {Object.values(row).map((value: any, vIdx) => (
                            <td key={vIdx} className="px-3 py-2 text-gray-900">
                              {String(value || '').substring(0, 50)}
                              {String(value || '').length > 50 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results */}
            {csvResults && (
              <div className={`mb-4 p-4 rounded-lg ${
                csvResults.errors.length === 0 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <h3 className="font-semibold mb-2">
                  {csvResults.errors.length === 0 
                    ? '✅ Carga completada exitosamente' 
                    : '⚠️ Carga completada con errores'}
                </h3>
                <p className="text-sm mb-2">
                  <strong>{csvResults.success}</strong> preguntas insertadas correctamente
                </p>
                {csvResults.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Errores ({csvResults.errors.length}):
                    </p>
                    <div className="max-h-40 overflow-y-auto">
                      {csvResults.errors.slice(0, 10).map((err, idx) => (
                        <p key={idx} className="text-xs text-red-700">
                          Fila {err.row}: {err.error}
                        </p>
                      ))}
                      {csvResults.errors.length > 10 && (
                        <p className="text-xs text-gray-500">
                          ... y {csvResults.errors.length - 10} errores más
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCSVModal(false)
                  setCsvFile(null)
                  setCsvPreview([])
                  setCsvResults(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                {csvResults ? 'Cerrar' : 'Cancelar'}
              </button>
              {csvFile && !csvResults && (
                <button
                  onClick={handleCSVUpload}
                  disabled={csvUploading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {csvUploading ? 'Cargando...' : 'Cargar Preguntas'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Questions Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                🤖
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Generar Preguntas con IA</h3>
                <p className="text-sm text-gray-600">
                  {(() => {
                    const info = getSelectedSubtopicInfo()
                    return info 
                      ? `${info.routeName} > ${info.topicName} > ${info.subtopicName}`
                      : 'Selecciona un subtema en los filtros'
                  })()}
                </p>
              </div>
            </div>

            {generatedQuestions.length === 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de Preguntas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={numberOfQuestions}
                    onChange={(e) => setNumberOfQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Entre 1 y 20 preguntas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dificultad
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as 'baja' | 'media' | 'alta')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleGenerateWithAI}
                    disabled={isGenerating || !getSelectedSubtopicInfo()}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                  >
                    {isGenerating ? '⏳ Generando...' : '✨ Generar Preguntas'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAIModal(false)
                      setGeneratedQuestions([])
                      setNumberOfQuestions(5)
                      setAiDifficulty('media')
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold">
                    ✅ Se generaron {generatedQuestions.length} preguntas exitosamente
                  </p>
                </div>

                {/* Preview of generated questions */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {generatedQuestions.map((q, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">
                          Pregunta {idx + 1}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                          Correcta: {q.answer_key}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 mb-3">{q.prompt}</p>
                      <div className="space-y-2 mb-3">
                        {q.options.map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx)
                          return (
                            <div
                              key={optIdx}
                              className={`p-2 rounded ${
                                letter === q.answer_key
                                  ? 'bg-green-100 border border-green-300'
                                  : 'bg-white border border-gray-200'
                              }`}
                            >
                              <span className="font-bold mr-2">{letter}:</span>
                              {opt}
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-sm text-gray-600 italic">💡 {q.explanation}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4 border-t">
                  <button
                    onClick={handleSaveGeneratedQuestions}
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                  >
                    {isSubmitting ? '⏳ Guardando...' : `💾 Guardar ${generatedQuestions.length} Preguntas`}
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedQuestions([])
                      setNumberOfQuestions(5)
                    }}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    Generar Otras
                  </button>
                  <button
                    onClick={() => {
                      setShowAIModal(false)
                      setGeneratedQuestions([])
                      setNumberOfQuestions(5)
                      setAiDifficulty('media')
                    }}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
