import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Use Node.js runtime for longer timeout (necessary for OpenAI API calls)
export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds timeout for Vercel Pro, 10 for Hobby

const generateRouteSchema = z.object({
  objective: z.string().min(10, 'El objetivo debe tener al menos 10 caracteres'),
  userId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = generateRouteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { objective, userId } = validation.data

    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      return NextResponse.json(
        {
          error: 'OpenAI API key not configured',
          message: 'This endpoint requires OPENAI_API_KEY environment variable',
        },
        { status: 501 }
      )
    }

    const systemPrompt = `Eres un asistente educativo que ayuda a crear rutas de estudio personalizadas. 
Basándote en el objetivo del estudiante, genera una estructura jerárquica de temas y subtemas CON CONTENIDO EDUCATIVO.

IMPORTANTE: 
- Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "topics": [
    {
      "name": "Nombre del tema",
      "estimatedTime": 120,
      "priority": 1,
      "difficulty": "media",
      "introContent": "Contenido introductorio del tema principal (mínimo 150 palabras). Debe ser una introducción general al tema.",
      "subtopics": [
        {
          "name": "Nombre del subtema",
          "estimatedTime": 60,
          "priority": 1,
          "content": "Contenido educativo detallado del subtema (mínimo 200 palabras). Debe ser información completa y educativa que el estudiante pueda estudiar directamente."
        }
      ]
    }
  ]
}

- estimatedTime: tiempo en minutos (número entero) - para temas es la suma de sus subtemas
- priority: número del 1 al 5 (1=más importante, 5=menos importante)
- difficulty: "baja", "media" o "alta" - solo para temas
- introContent: contenido introductorio completo para cada tema principal (mínimo 150 palabras). Debe ser una introducción general al tema.
- content: contenido educativo completo y detallado para cada subtema (mínimo 200 palabras). Debe ser información educativa que el estudiante pueda estudiar directamente.
- Genera entre 3 y 8 temas, cada tema con 2-5 subtemas
- Ordena los temas por prioridad (1 primero)
- Cada tema DEBE incluir introContent con información introductoria
- Cada subtema DEBE incluir content con información educativa completa

Genera nombres descriptivos y específicos para cada tema y subtema basándote en el objetivo del estudiante. El contenido educativo debe ser completo, claro y útil para el aprendizaje.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Objetivo del estudiante: ${objective}\n\nGenera una ruta de estudio personalizada.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000, // Aumentado para permitir contenido educativo detallado
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('AI Generate Route: OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate route with AI' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || '{}'

    // Parse AI response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(aiResponse)
    } catch (parseError) {
      console.error('AI Generate Route: JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      )
    }

    // Validate structure
    if (!parsedResponse.topics || !Array.isArray(parsedResponse.topics)) {
      return NextResponse.json(
        { error: 'Invalid response structure from AI - expected topics array' },
        { status: 500 }
      )
    }

    // Validate and clean hierarchical structure
    const validTopics = parsedResponse.topics
      .filter((topic: any) => topic.name && topic.estimatedTime && topic.priority && topic.difficulty)
      .map((topic: any) => ({
        name: topic.name.trim(),
        estimatedTime: Math.max(15, Math.min(480, parseInt(topic.estimatedTime) || 120)),
        priority: Math.max(1, Math.min(5, parseInt(topic.priority) || 3)),
        difficulty: ['baja', 'media', 'alta'].includes(topic.difficulty) ? topic.difficulty : 'media',
        introContent: topic.introContent || '', // Contenido introductorio del tema
        subtopics: (topic.subtopics || [])
          .filter((subtopic: any) => subtopic.name)
          .map((subtopic: any) => ({
            name: subtopic.name.trim(),
            estimatedTime: Math.max(15, Math.min(480, parseInt(subtopic.estimatedTime) || 60)),
            priority: Math.max(1, Math.min(5, parseInt(subtopic.priority) || 3)),
            content: subtopic.content || '', // Contenido educativo del subtema
          })),
      }))

    if (validTopics.length === 0) {
      return NextResponse.json(
        { error: 'No valid topics generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      topics: validTopics,
    })
  } catch (error) {
    console.error('AI Generate Route: Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

