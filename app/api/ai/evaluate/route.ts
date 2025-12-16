import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Use Node.js runtime for longer timeout (necessary for OpenAI API calls)
export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds timeout for Vercel Pro, 10 for Hobby

const evaluateSchema = z.object({
  userAnswer: z.string().min(1, 'userAnswer is required'),
  answerKey: z.string().min(1, 'answerKey is required'),
  prompt: z.string().min(1, 'prompt is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = evaluateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { userAnswer, answerKey, prompt } = validation.data

    // Check if OpenAI API key is configured
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

    // Call OpenAI API
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
            content:
              'Eres un evaluador de respuestas educativas. Debes evaluar si la respuesta del estudiante es correcta comparándola con la respuesta clave. Devuelve SOLO un JSON con esta estructura: {"isCorrect": true/false, "reasoning": "breve explicación"}. La respuesta debe ser considerada correcta si expresa el mismo concepto aunque use palabras diferentes.',
          },
          {
            role: 'user',
            content: `Pregunta: ${prompt}\n\nRespuesta clave: ${answerKey}\n\nRespuesta del estudiante: ${userAnswer}\n\nEvalúa si la respuesta del estudiante es correcta y devuelve SOLO el JSON.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('AI Evaluate: OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to evaluate with AI' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || ''

    // Parse AI response (should be JSON)
    try {
      const parsed = JSON.parse(aiResponse)
      return NextResponse.json({
        isCorrect: Boolean(parsed.isCorrect),
        reasoning: parsed.reasoning || '',
      })
    } catch (parseError) {
      // If AI didn't return valid JSON, try to extract boolean from response
      const lowerResponse = aiResponse.toLowerCase()
      const isCorrect =
        lowerResponse.includes('true') ||
        lowerResponse.includes('correct') ||
        lowerResponse.includes('correcto')

      return NextResponse.json({
        isCorrect,
        reasoning: 'Parsed from AI response',
      })
    }
  } catch (error) {
    console.error('AI Evaluate: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

