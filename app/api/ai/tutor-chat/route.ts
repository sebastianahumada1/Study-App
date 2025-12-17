import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Use Node.js runtime for longer timeout (necessary for OpenAI API calls)
export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds timeout for Vercel Pro, 10 for Hobby

const tutorChatSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1, 'El mensaje no puede estar vacío'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  isInitialMessage: z.boolean().optional(),
  errorContext: z.object({
    errorType: z.string(),
    errors: z.array(z.object({
      question: z.string(),
      userAnswer: z.string(),
      correctAnswer: z.string(),
      subtopic: z.string(),
    })),
    subtopics: z.array(z.string()),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = tutorChatSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { sessionId, message, conversationHistory = [], isInitialMessage = false, errorContext } = validation.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('tutor_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 501 }
      )
    }

    // Get subtopic/topic content if available for context
    let contentContext = ''
    if (session.subtopic_id) {
      const { data: subtopicData } = await supabase
        .from('study_route_items')
        .select('content, custom_name')
        .eq('id', session.subtopic_id)
        .single()
      
      if (subtopicData?.content) {
        contentContext = `\n\nINFORMACIÓN DEL SUBTEMA "${subtopicData.custom_name}":\n${subtopicData.content}\n\nUsa esta información como referencia, pero NO la repitas directamente. Guía al estudiante para que descubra estos conceptos por sí mismo.`
      }
    } else if (session.topic_id) {
      const { data: topicData } = await supabase
        .from('study_route_items')
        .select('content, custom_name')
        .eq('id', session.topic_id)
        .single()
      
      if (topicData?.content) {
        contentContext = `\n\nINFORMACIÓN DEL TEMA "${topicData.custom_name}":\n${topicData.content}\n\nUsa esta información como referencia, pero NO la repitas directamente. Guía al estudiante para que descubra estos conceptos por sí mismo.`
      }
    }

    // Build error context if provided
    let errorContextSection = ''
    let errorTypeInstructions = ''
    
    if (errorContext) {
      const errorType = errorContext.errorType
      const isConocimiento = errorType === 'Conocimiento' || errorType === 'Errores de conocimiento'
      
      // Build detailed error list
      const errorsList = errorContext.errors.map((err, idx) => 
        `Error ${idx + 1}:\n- Pregunta: ${err.question}\n- Respuesta del estudiante: ${err.userAnswer}\n- Respuesta correcta: ${err.correctAnswer}\n- Subtema: ${err.subtopic}`
      ).join('\n\n')
      
      errorContextSection = `\n\nCONTEXTO DE ERRORES DEL ESTUDIANTE:\nEl estudiante ha cometido errores clasificados como "${errorType}" en los siguientes subtemas: ${errorContext.subtopics.join(', ')}.\n\nDetalles de los errores:\n\n${errorsList}\n\n`
      
      if (isConocimiento) {
        errorTypeInstructions = `\n\nINSTRUCCIONES ESPECÍFICAS PARA ERRORES DE CONOCIMIENTO:\nTu objetivo es REFORZAR directamente los conocimientos que el estudiante no domina. Debes:\n1. Explicar claramente los conceptos que el estudiante no comprende\n2. Proporcionar ejemplos concretos y educativos\n3. Asegurarte de que el estudiante comprenda la información correcta\n4. Sé directo y educativo - NO uses preguntas socráticas, da la información directamente\n5. Refuerza los conceptos clave de manera clara y estructurada\n6. Corrige los errores específicos que el estudiante cometió explicando por qué estaba equivocado`
      } else {
        errorTypeInstructions = `\n\nINSTRUCCIONES ESPECÍFICAS PARA ERRORES DE ANÁLISIS:\nTu objetivo es DESARROLLAR las habilidades de análisis del estudiante mediante preguntas socráticas. Debes:\n1. NO dar las respuestas directamente\n2. Usar preguntas guiadas que lleven al estudiante a descubrir por sí mismo el análisis correcto\n3. Ayudar al estudiante a razonar paso a paso hasta llegar a la conclusión correcta\n4. Ser paciente y guiar el proceso de razonamiento\n5. Hacer que el estudiante identifique sus propios errores de análisis mediante preguntas\n6. Desarrollar su capacidad de pensamiento crítico y análisis lógico`
      }
    }

    // Build system prompt based on session configuration
    let systemPrompt = `Eres un tutor educativo especializado. Tu rol es: ${session.tutor_role}

El usuario es: ${session.user_role}

El contexto en el que te encuentras es: ${session.context}

El objetivo de la conversación debe ser: ${session.objective}${contentContext}${errorContextSection}

INSTRUCCIONES CRÍTICAS:
1. NO debes alucinar - solo basarte en información verificada${errorContext ? '' : '\n2. NO debes dar la respuesta directamente - debes guiar al estudiante a llegar a la respuesta'}
3. Debes dar retroalimentación sobre los vacíos de conocimiento que identifiques
4. Debes aplicar técnicas de estudio como:
   - Interleaving: Mezcla conceptos relacionados
   - Repetición espaciada: Refuerza conceptos clave en momentos estratégicos
   - Elaboración por primeros principios: Ayuda al estudiante a entender desde los fundamentos
   - Codificación por errores: Identifica y corrige errores de comprensión
   - Evocación activa: Haz que el estudiante recuerde y explique conceptos

${errorContext ? '' : '5. Usa el método socrático: Haz preguntas que guíen al estudiante hacia la comprensión'}
6. Proporciona retroalimentación constructiva sobre los vacíos de conocimiento
7. Si detectas que el estudiante ha comprendido el concepto, puedes finalizar la sesión recomendando un anclaje de memoria (ankis, palacios mentales, mnemotecnias, etc.)

${errorTypeInstructions}

Al finalizar una sesión exitosa, SIEMPRE recomienda un anclaje de memoria específico que ayude al estudiante a recordar el concepto aprendido.

Responde de manera clara, empática y pedagógica.`

    // Special instructions for initial message
    if (isInitialMessage) {
      systemPrompt += `\n\nESTE ES EL MENSAJE INICIAL DE LA SESIÓN. Debes:
1. Saludar al estudiante de manera amigable
2. Si hay un subtema seleccionado, menciona que trabajarás en ese subtema
3. Ofrece 2-3 temas relacionados que podrían ser útiles estudiar
4. Pregunta si el estudiante quiere trabajar en alguno de esos temas o si prefiere proponer otro tema
5. Sé entusiasta y motivador`
    }

    // Build messages array for OpenAI
    // For initial message, the "message" is actually a prompt for the tutor to start the conversation
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ]
    
    // For initial message, we don't add a user message - the tutor should initiate
    if (!isInitialMessage) {
      messages.push({ role: 'user', content: message })
    } else {
      // For initial message, add a system instruction to start the conversation
      messages.push({ 
        role: 'system', 
        content: `INICIA LA CONVERSACIÓN. El usuario aún no ha enviado ningún mensaje. Debes ser tú quien inicie saludando y ofreciendo temas. Usa el siguiente contexto: ${message}` 
      })
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
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Tutor Chat: OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to get response from tutor' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Check if the response indicates completion
    // Look for keywords that suggest the student understood
    const completionKeywords = [
      'has comprendido',
      'has entendido',
      'comprendes correctamente',
      'entendiste',
      'sesión completada',
      'has logrado',
      'dominio del concepto',
    ]
    
    const shouldComplete = completionKeywords.some(keyword => 
      aiResponse.toLowerCase().includes(keyword.toLowerCase())
    )

    // Extract anchor recommendation if present
    let anchorRecommendation: string | null = null
    const anchorPatterns = [
      /anclaje[:\s]+(.+?)(?:\.|$)/i,
      /recomend[ao].*?anclaje[:\s]+(.+?)(?:\.|$)/i,
      /suger[eo].*?memoria[:\s]+(.+?)(?:\.|$)/i,
    ]

    for (const pattern of anchorPatterns) {
      const match = aiResponse.match(pattern)
      if (match && match[1]) {
        anchorRecommendation = match[1].trim()
        break
      }
    }

    // Save user message
    await supabase.from('tutor_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    })

    // Save assistant response
    await supabase.from('tutor_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: aiResponse,
    })

    // Update session status if needed
    if (shouldComplete && session.status !== 'completed') {
      await supabase
        .from('tutor_sessions')
        .update({
          status: 'completed',
          anchor_recommendation: anchorRecommendation || session.anchor_recommendation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    } else if (session.status === 'created') {
      // Mark as in_progress when first message is sent
      await supabase
        .from('tutor_sessions')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      response: aiResponse,
      shouldComplete,
      anchorRecommendation: anchorRecommendation || session.anchor_recommendation,
    })
  } catch (error) {
    console.error('Tutor Chat: Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

