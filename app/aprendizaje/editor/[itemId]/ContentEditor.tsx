'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CodeBlock from '@tiptap/extension-code-block'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import YouTube from '@tiptap/extension-youtube'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type ContentEditorProps = {
  itemId: string
  routeId: string
  itemType: 'topic' | 'subtopic'
  itemName: string
  initialContent: string
  userId: string
  estimatedTime: number
  priority: number
  difficulty: string
}

export default function ContentEditor({
  itemId,
  routeId,
  itemType,
  itemName,
  initialContent,
  userId,
  estimatedTime,
  priority,
  difficulty,
}: ContentEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeIdFromQuery = searchParams.get('routeId') || routeId
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [currentItemName, setCurrentItemName] = useState(itemName)
  const [currentEstimatedTime, setCurrentEstimatedTime] = useState(estimatedTime)
  const [currentPriority, setCurrentPriority] = useState(priority)
  const [currentDifficulty, setCurrentDifficulty] = useState<'baja' | 'media' | 'alta'>(difficulty as 'baja' | 'media' | 'alta')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 p-4 rounded',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      YouTube.configure({
        width: 640,
        height: 480,
      }),
    ],
    content: initialContent || '',
    onUpdate: () => {
      setHasUnsavedChanges(true)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
  })

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return

    setIsUploadingImage(true)
    try {
      const supabase = createClient()
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Máximo 5MB.')
        return
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.')
        return
      }

      // Generate unique filename
      const timestamp = Date.now()
      const fileExt = file.name.split('.').pop()
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${userId}/${itemId}/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('study-content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Error uploading image:', error)
        alert('Error al subir la imagen. Por favor intenta de nuevo.')
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('study-content')
        .getPublicUrl(filePath)

      // Insert image into editor
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run()
    } catch (error) {
      console.error('Error in image upload:', error)
      alert('Error al subir la imagen.')
    } finally {
      setIsUploadingImage(false)
    }
  }, [editor, userId, itemId])

  const handleImageInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleImageUpload(file)
      }
      // Reset input
      e.target.value = ''
    },
    [handleImageUpload]
  )

  const handleSave = async () => {
    if (!editor) return

    setIsSaving(true)
    try {
      const htmlContent = editor.getHTML()
      const supabase = createClient()

      // Save content, name, and metadata
      const { error } = await supabase
        .from('study_route_items')
        .update({ 
          content: htmlContent,
          custom_name: currentItemName.trim() || 'Sin nombre',
          estimated_time: currentEstimatedTime,
          priority: currentPriority,
          difficulty: currentDifficulty,
        })
        .eq('id', itemId)

      if (error) {
        console.error('Error saving content:', error)
        alert('Error al guardar el contenido. Por favor intenta de nuevo.')
        return
      }

      setHasUnsavedChanges(false)
      // Redirect back to route builder, optionally with routeId to select the route
      if (routeIdFromQuery) {
        router.push(`/aprendizaje?routeId=${routeIdFromQuery}`)
      } else {
        router.push('/aprendizaje')
      }
    } catch (error) {
      console.error('Error in save:', error)
      alert('Error al guardar el contenido.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?'
      )
      if (!confirm) return
    }
    // Redirect back to route builder, optionally with routeId to select the route
    if (routeIdFromQuery) {
      router.push(`/aprendizaje?routeId=${routeIdFromQuery}`)
    } else {
      router.push('/aprendizaje')
    }
  }

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Cargando editor...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Editor de Contenido
              </h1>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {itemType === 'topic' ? 'Tema' : 'Subtema'}:
                  </span>
                  <input
                    type="text"
                    value={currentItemName}
                    onChange={(e) => {
                      setCurrentItemName(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="Nombre del item"
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Tiempo estimado (min):</label>
                    <input
                      type="number"
                      min="1"
                      value={currentEstimatedTime}
                      onChange={(e) => {
                        setCurrentEstimatedTime(parseInt(e.target.value) || 60)
                        setHasUnsavedChanges(true)
                      }}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {itemType === 'topic' && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-500">Prioridad:</label>
                        <select
                          value={currentPriority}
                          onChange={(e) => {
                            setCurrentPriority(parseInt(e.target.value))
                            setHasUnsavedChanges(true)
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="1">1 - Muy baja</option>
                          <option value="2">2 - Baja</option>
                          <option value="3">3 - Media</option>
                          <option value="4">4 - Alta</option>
                          <option value="5">5 - Muy alta</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-500">Dificultad:</label>
                        <select
                          value={currentDifficulty}
                          onChange={(e) => {
                            setCurrentDifficulty(e.target.value as 'baja' | 'media' | 'alta')
                            setHasUnsavedChanges(true)
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Text Formatting */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('bold')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Negrita"
              >
                <strong>B</strong>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('italic')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Cursiva"
              >
                <em>I</em>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('underline')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Subrayado"
              >
                <u>U</u>
              </button>
            </div>

            {/* Headings */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={`px-3 py-1 rounded text-sm ${
                  editor.isActive('heading', { level: 1 })
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Título 1"
              >
                H1
              </button>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={`px-3 py-1 rounded text-sm ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Título 2"
              >
                H2
              </button>
              <button
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={`px-3 py-1 rounded text-sm ${
                  editor.isActive('heading', { level: 3 })
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Título 3"
              >
                H3
              </button>
            </div>

            {/* Lists */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('bulletList')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Lista con viñetas"
              >
                • Lista
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('orderedList')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Lista numerada"
              >
                1. Lista
              </button>
            </div>

            {/* Link */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <button
                onClick={() => {
                  const url = window.prompt('Ingresa la URL del enlace:')
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run()
                  }
                }}
                className={`px-3 py-1 rounded ${
                  editor.isActive('link')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Insertar enlace"
              >
                🔗
              </button>
            </div>

            {/* Image */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <label
                className={`px-3 py-1 rounded cursor-pointer ${
                  isUploadingImage
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Subir imagen"
              >
                {isUploadingImage ? '⏳' : '🖼️'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageInput}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* Code Block */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('codeBlock')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Bloque de código"
              >
                {'</>'}
              </button>
            </div>

            {/* Table */}
            <div className="flex gap-1 border-r pr-2 mr-2">
              <button
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
                className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100"
                title="Insertar tabla"
              >
                ⧉ Tabla
              </button>
            </div>

            {/* YouTube */}
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const url = window.prompt('Ingresa la URL de YouTube:')
                  if (url) {
                    // Extract video ID from YouTube URL
                    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
                    if (videoId) {
                      editor.chain().focus().setYoutubeVideo({ src: `https://www.youtube.com/embed/${videoId}` }).run()
                    } else {
                      alert('Por favor ingresa una URL válida de YouTube')
                    }
                  }
                }}
                className="px-3 py-1 rounded text-gray-700 hover:bg-gray-100"
                title="Insertar video de YouTube"
              >
                ▶️ YouTube
              </button>
            </div>

            {/* Blockquote */}
            <div className="flex gap-1 border-l pl-2 ml-2">
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`px-3 py-1 rounded ${
                  editor.isActive('blockquote')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Cita"
              >
                " Cita
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border min-h-[600px]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

