import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const evaluateFeynmanSchema = z.object({
  questionPrompt: z.string().min(1, 'El prompt de la pregunta es requerido'),
  userAnswer: z.string().min(1, 'La respuesta del usuario es requerida'),
  correctAnswer: z.string().min(1, 'La respuesta correcta es requerida'),
  options: z.array(z.string()).min(1, 'Debe haber al menos una opción'),
  userReasoning: z.string().min(20, 'El razonamiento del usuario debe tener al menos 20 caracteres'),
  isCorrect: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = evaluateFeynmanSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { questionPrompt, userAnswer, correctAnswer, options, userReasoning, isCorrect } = validation.data

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

    const systemPrompt = `Eres un experto tutor de medicina que utiliza técnicas avanzadas de estudio para evaluar el razonamiento de estudiantes.

Tu tarea es evaluar el razonamiento de un estudiante usando DOS técnicas específicas:

TÉCNICA 1: "El Descarte de Primeros Principios"
- Aplica el principio "Why Not" y los criterios de seguridad antes que los criterios de eficacia
- Analiza si el estudiante consideró primero qué opciones son seguras y cuáles podrían ser peligrosas
- Evalúa si el razonamiento sigue un proceso lógico desde principios fundamentales
- Identifica si el estudiante descartó opciones incorrectas basándose en principios básicos

TÉCNICA 2: "Reverse Engineering del Error"
- Parte del fallo o la discrepancia de la pregunta
- Desarma la pregunta para encontrar la "trampa" o el dato de finura
- Analiza qué información clave podría haber sido pasada por alto
- Identifica el punto específico donde el razonamiento del estudiante se desvió (si aplica)

INSTRUCCIONES:
- Si la respuesta es CORRECTA: Usa la Técnica 1 para validar que el razonamiento siguió principios sólidos
- Si la respuesta es INCORRECTA: Usa ambas técnicas para identificar dónde falló el razonamiento
- Sé específico y educativo en tu feedback
- Proporciona retroalimentación constructiva que ayude al estudiante a mejorar
- Usa terminología médica apropiada
- Mantén cada feedback entre 3-5 oraciones

Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "technique1Feedback": "Feedback usando la técnica de Descarte de Primeros Principios",
  "technique2Feedback": "Feedback usando la técnica de Reverse Engineering del Error",
  "overallFeedback": "Resumen general del razonamiento y recomendaciones"
}`

    const userPrompt = `Pregunta: "${questionPrompt}"

Opciones:
A) ${options[0]}
B) ${options[1]}
C) ${options[2]}
D) ${options[3]}

Respuesta correcta: ${correctAnswer}
Respuesta del estudiante: ${userAnswer}
¿Es correcta?: ${isCorrect ? 'Sí' : 'No'}

Razonamiento del estudiante:
"${userReasoning}"

Evalúa el razonamiento del estudiante usando ambas técnicas y proporciona feedback educativo.`

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
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('AI Evaluate Feynman: OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to evaluate reasoning with AI' },
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
      console.error('AI Evaluate Feynman: JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      )
    }

    // Validate structure
    if (!parsedResponse.technique1Feedback || !parsedResponse.technique2Feedback || !parsedResponse.overallFeedback) {
      return NextResponse.json(
        { error: 'Invalid response structure from AI - missing required fields' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      technique1Feedback: parsedResponse.technique1Feedback.trim(),
      technique2Feedback: parsedResponse.technique2Feedback.trim(),
      overallFeedback: parsedResponse.overallFeedback.trim(),
    })
  } catch (error) {
    console.error('AI Evaluate Feynman: Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

