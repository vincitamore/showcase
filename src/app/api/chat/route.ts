import { NextRequest } from 'next/server'
import { env } from '@/env'
import { prisma } from '@/lib/db'
import { checkRateLimit, getRateLimitInfo } from '@/lib/rate-limit'
import { 
  CHAT_SETTINGS, 
  getSystemPrompt, 
  extractSkillTags,
  type ChatMessage 
} from '@/lib/chat-config'
import { xai } from '@ai-sdk/xai'
import { streamText } from 'ai'

// Initialize the xAI model
const model = xai('grok-2-1212')

export async function POST(req: NextRequest) {
  try {
    // Get IP address for rate limiting
    const ip = req.ip ?? 'anonymous'
    const userAgent = req.headers.get('user-agent') ?? 'unknown'

    // Check rate limit
    const isAllowed = await checkRateLimit(ip)
    if (!isAllowed) {
      const { remaining, reset } = await getRateLimitInfo(ip)
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          remaining,
          reset: reset.toISOString(),
        }),
        { status: 429 }
      )
    }

    // Parse the request body
    const { messages } = await req.json()

    // Get the active system prompt
    const systemPrompt = await getSystemPrompt()

    // Create a new chat session
    const session = await prisma.chatSession.create({
      data: {
        ipAddress: ip,
        userAgent,
      },
    })

    // Store the user's message in the database
    const userMessage = messages[messages.length - 1]
    await prisma.message.create({
      data: {
        chatSessionId: session.id,
        content: userMessage.content,
        role: userMessage.role,
        tokens: userMessage.content.length / 4, // Rough estimate
        skillTags: [],
      },
    })

    // Prepare messages for the API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content
      }))
    ]

    // Create the stream using the provider-agnostic streamText
    const stream = streamText({
      model,
      messages: apiMessages,
      temperature: CHAT_SETTINGS.temperature,
      maxTokens: CHAT_SETTINGS.maxTokens,
    })

    // Create a new transform stream to intercept the response
    let fullResponse = ''
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Accumulate the response
        fullResponse += chunk
        // Forward the chunk to the client
        controller.enqueue(chunk)
      },
      async flush() {
        // After the stream is complete, store the assistant's response
        await prisma.message.create({
          data: {
            chatSessionId: session.id,
            content: fullResponse,
            role: 'assistant',
            tokens: fullResponse.length / 4, // Rough estimate
            skillTags: extractSkillTags(fullResponse),
          },
        })
      },
    })

    // Get the response stream
    const responseStream = await stream.toDataStream()

    // Chain the streams
    const finalStream = responseStream.pipeThrough(transformStream)

    // Return the streaming response
    return new Response(finalStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
} 