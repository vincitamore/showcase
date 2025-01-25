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
    console.log('[Chat API] Received messages:', JSON.stringify(messages, null, 2))
    
    // Get the active system prompt
    let systemPrompt = ''
    try {
      systemPrompt = await getSystemPrompt()
    } catch (error) {
      console.warn('[Chat API] Failed to get system prompt, using fallback')
      systemPrompt = `You are an AI assistant with expertise in full-stack development, particularly in TypeScript, React, Next.js, and modern web technologies. You help answer questions about the developer's skills, experience, and projects.

Key areas of expertise include:
- TypeScript and modern JavaScript
- React and Next.js
- Full-stack development
- System architecture
- Network engineering
- Cybersecurity

Please provide detailed, technical responses while highlighting relevant skills and experience. Don't output code unless asked. Your Latin motto is Qui Vincit, Vincit Amore.`
    }
    console.log('[Chat API] System prompt:', systemPrompt)
    
    // Format messages for xAI
    console.log('[Chat API] Formatting messages for xAI')
    const apiMessages = messages.map((msg: MessageType) => {
      // Skip empty messages
      if (!msg.content) return null

      return {
        role: msg.role,
        content: msg.content
      }
    }).filter(Boolean)

    // Add system prompt
    const messagesWithSystem = [
      {
        role: 'system',
        content: systemPrompt
      },
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