import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const generateQuestionsSchema = z.object({
  subtopicName: z.string().min(1, 'El nombre del subtema es requerido'),
  topicName: z.string().min(1, 'El nombre del tema es requerido'),
  numberOfQuestions: z.number().min(1).max(20),
  difficulty: z.enum(['baja', 'media', 'alta']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = generateQuestionsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { subtopicName, topicName, numberOfQuestions, difficulty = 'media' } = validation.data

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

    const systemPrompt = `Eres un experto en crear preguntas de opción múltiple educativas de alta calidad para estudiantes de medicina.

Genera ${numberOfQuestions} preguntas sobre el subtema: "${subtopicName}" del tema "${topicName}".

REQUISITOS ESTRICTOS:
- Cada pregunta debe tener EXACTAMENTE 4 opciones
- Una sola opción debe ser correcta
- Las opciones incorrectas deben ser plausibles pero claramente incorrectas
- Incluye una explicación breve y educativa (2-3 oraciones) para cada respuesta correcta
- Las preguntas deben ser claras, específicas y evaluar comprensión real del tema
- Dificultad: ${difficulty}
- Las preguntas deben ser relevantes al subtema específico
- Evita preguntas demasiado generales o vagas
- Usa terminología médica apropiada

CRÍTICO - FORMATO DE OPCIONES:
- Las opciones NO deben incluir las letras A, B, C, D al inicio
- Las opciones deben ser solo el texto de la respuesta, sin prefijos
- Ejemplo CORRECTO: ["Virus", "Bacteria", "Parásito", "Hongos"]
- Ejemplo INCORRECTO: ["A. Virus", "B. Bacteria", "C. Parásito", "D. Hongos"]

Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "questions": [
    {
      "prompt": "Pregunta clara y específica sobre el subtema",
      "options": ["Texto de opción 1", "Texto de opción 2", "Texto de opción 3", "Texto de opción 4"],
      "answer_key": "A",
      "explanation": "Explicación educativa de 2-3 oraciones sobre por qué esta es la respuesta correcta"
    }
  ]
}

IMPORTANTE:
- answer_key debe ser exactamente "A", "B", "C" o "D" (indica la posición: A=primera, B=segunda, C=tercera, D=cuarta)
- Las opciones en el array "options" NO deben incluir letras, solo el texto de la respuesta
- Todas las preguntas deben estar relacionadas directamente con "${subtopicName}"
- Las explicaciones deben ser educativas y ayudar al estudiante a entender el concepto`

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
            content: `Genera ${numberOfQuestions} preguntas de opción múltiple sobre "${subtopicName}" (subtema del tema "${topicName}"). Dificultad: ${difficulty}.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('AI Generate Questions: OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate questions with AI' },
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
      console.error('AI Generate Questions: JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      )
    }

    // Validate structure
    if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
      return NextResponse.json(
        { error: 'Invalid response structure from AI - expected questions array' },
        { status: 500 }
      )
    }

    // Validate and clean questions
    const validQuestions = parsedResponse.questions
      .filter((q: any) => {
        return (
          q.prompt &&
          q.options &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.answer_key &&
          ['A', 'B', 'C', 'D'].includes(q.answer_key.toUpperCase()) &&
          q.explanation
        )
      })
      .map((q: any) => {
        // Clean options: remove leading letters (A., B., C., D., A), B), etc.) and trim
        const cleanedOptions = q.options.map((opt: string) => {
          let cleaned = opt.trim()
          // Remove patterns like "A.", "A)", "A -", "A:", etc.
          cleaned = cleaned.replace(/^[A-D][\.\)\-\:]\s*/i, '')
          // Remove patterns like "(A)", "[A]", etc.
          cleaned = cleaned.replace(/^[\(\[\{][A-D][\)\]\}]\s*/i, '')
          // Remove standalone "A", "B", "C", "D" at the start followed by space
          cleaned = cleaned.replace(/^[A-D]\s+/i, '')
          return cleaned.trim()
        }).filter(Boolean)
        
        return {
          prompt: q.prompt.trim(),
          options: cleanedOptions,
          answer_key: q.answer_key.toUpperCase(),
          explanation: q.explanation.trim(),
        }
      })
      .slice(0, numberOfQuestions) // Ensure we don't exceed requested number

    if (validQuestions.length === 0) {
      return NextResponse.json(
        { error: 'No valid questions generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      questions: validQuestions,
    })
  } catch (error) {
    console.error('AI Generate Questions: Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

