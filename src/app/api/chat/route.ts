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
import { streamText, type Message } from 'ai'
import type { Message as MessageType } from '@/types/chat'

// Initialize the xAI model with vision capabilities
const model = xai('grok-2-vision-latest')

// Add OPTIONS handler for CORS
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    console.log('[Chat API] Starting request processing')
    const { messages } = await req.json()
    console.log('[Chat API] Received messages:', JSON.stringify(messages, null, 2))
    
    // Get the active system prompt
    const systemPrompt = await getSystemPrompt()
    console.log('[Chat API] System prompt:', systemPrompt)
    
    // Format messages for xAI
    console.log('[Chat API] Formatting messages for xAI')
    const apiMessages = messages.map((msg: MessageType) => {
      const baseMessage = {
        id: msg.id,
        role: msg.role,
      }

      // If the message has array content (image + text), format it for xAI
      if (Array.isArray(msg.content)) {
        console.log('[Chat API] Processing array content message:', msg.id)
        return {
          ...baseMessage,
          content: msg.content.map(item => {
            if (item.type === 'text') {
              return { type: 'text', text: item.text }
            } 
            if (item.type === 'image') {
              console.log('[Chat API] Processing image content, mime_type:', item.image.mime_type)
              return {
                type: 'image',
                image_url: {
                  url: `data:${item.image.mime_type};base64,${item.image.data}`
                }
              }
            }
            // Log unknown type and return null for filtering
            console.log('[Chat API] Unknown content type:', (item as { type: string }).type || 'undefined')
            return null
          }).filter(Boolean)
        }
      }

      // Regular text message
      return {
        ...baseMessage,
        content: msg.content as string
      }
    })

    // Add system prompt
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...apiMessages
    ]

    console.log('[Chat API] Final message structure:', 
      JSON.stringify(messagesWithSystem.map(m => ({
        role: m.role,
        contentType: Array.isArray(m.content) ? 'array' : 'string',
        hasImage: Array.isArray(m.content) && m.content.some((c: { type: string }) => c.type === 'image')
      })), null, 2)
    )

    // Create the stream using xAI
    console.log('[Chat API] Creating stream with xAI')
    const stream = streamText({
      model,
      messages: messagesWithSystem,
      temperature: CHAT_SETTINGS.temperature,
      maxTokens: CHAT_SETTINGS.maxTokens,
    })

    // Return the streaming response
    console.log('[Chat API] Converting stream to data stream')
    const responseStream = await stream.toDataStream()
    console.log('[Chat API] Stream ready, sending response')
    
    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('[Chat API] Error details:', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    })

    // Log the error boundary
    console.error('[Chat API] Error boundary reached with error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'UnknownError',
        type: error instanceof Error ? error.constructor.name : 'UnknownType'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
} 