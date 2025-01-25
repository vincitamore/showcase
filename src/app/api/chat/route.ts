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

async function uploadImage(image: { data: string, mime_type: string }, origin: string) {
  const response = await fetch(`${origin}/api/upload`, {
    method: 'POST',
    body: JSON.stringify({ image }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to upload image')
  }
  
  const { url } = await response.json()
  return url
}

export async function POST(req: Request) {
  try {
    console.log('[Chat API] Starting request processing')
    const { messages } = await req.json()
    const origin = new URL(req.url).origin
    console.log('[Chat API] Received messages:', JSON.stringify(messages, null, 2))
    
    // Get the active system prompt
    const systemPrompt = await getSystemPrompt()
    console.log('[Chat API] System prompt:', systemPrompt)
    
    // Format messages for xAI
    console.log('[Chat API] Formatting messages for xAI')
    const apiMessages = await Promise.all(messages.map(async (msg: MessageType) => {
      // If the message has array content (image + text), format it for xAI
      if (Array.isArray(msg.content)) {
        const textContent = msg.content
          .filter(item => item.type === 'text')
          .map(item => (item as { type: 'text', text: string }).text)
          .join('\n')

        // Upload images and get URLs
        const imageUrls = await Promise.all(
          msg.content
            .filter(item => item.type === 'image')
            .map(async item => {
              const imageData = (item as { type: 'image', image: { mime_type: string, data: string } }).image
              const url = await uploadImage(imageData, origin)
              return {
                type: 'image_url',
                image_url: { url }
              }
            })
        )

        return {
          role: msg.role,
          content: [
            ...(textContent ? [{ type: 'text', text: textContent }] : []),
            ...imageUrls
          ]
        }
      }

      // Regular text message
      return {
        role: msg.role,
        content: msg.content
      }
    }))

    // Add system prompt
    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...apiMessages
    ]

    console.log('[Chat API] Final message structure:', JSON.stringify(messagesWithSystem, null, 2))

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