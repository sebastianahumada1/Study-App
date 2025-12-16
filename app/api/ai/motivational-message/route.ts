import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const motivationalSchema = z.object({
  userId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = motivationalSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const openaiKey = process.env.OPENAI_API_KEY
    const enableAI = process.env.ENABLE_AI_MOTIVATION === 'true'

    if (!openaiKey || !enableAI) {
      // Return default message if AI is not enabled
      return NextResponse.json({
        message: '¡Cada paso que das te acerca más a tus objetivos! Hoy es un gran día para aprender algo nuevo.',
      })
    }

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
            content: 'Eres un coach motivacional educativo. Genera mensajes breves, inspiradores y positivos para estudiantes. El mensaje debe ser de máximo 2 oraciones y en español.',
          },
          {
            role: 'user',
            content: 'Genera un mensaje motivacional para comenzar una sesión de estudio.',
          },
        ],
        temperature: 0.8,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('AI Motivational: OpenAI API error:', errorData)
      return NextResponse.json({
        message: '¡Cada paso que das te acerca más a tus objetivos! Hoy es un gran día para aprender algo nuevo.',
      })
    }

    const data = await response.json()
    const aiMessage = data.choices[0]?.message?.content || '¡Cada paso que das te acerca más a tus objetivos!'

    return NextResponse.json({
      message: aiMessage.trim(),
    })
  } catch (error) {
    console.error('AI Motivational: Error:', error)
    return NextResponse.json({
      message: '¡Cada paso que das te acerca más a tus objetivos! Hoy es un gran día para aprender algo nuevo.',
    })
  }
}

