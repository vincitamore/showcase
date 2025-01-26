import { NextRequest, NextResponse } from 'next/server'
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
import { streamText, type Message as AIMessage } from 'ai'
import type { Message, MessageContent, TextContent } from '@/types/chat'

// Define xAI specific types
interface XAITextContent {
  type: 'text'
  text: string
}

interface XAIImageContent {
  type: 'image_url'
  image_url: {
    url: string
    detail: 'high' | 'low'
  }
}

type XAIMessageContent = XAITextContent | XAIImageContent
type XAIContent = string | XAIMessageContent[]

interface XAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: XAIContent
}

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

// Add debug logging to track request processing
export async function POST(req: Request) {
  try {
    console.log('----------------------------------------')
    console.log('[Chat API] Starting request processing')
    
    const { messages } = await req.json()
    
    // Get system prompt
    const systemPrompt = await getSystemPrompt()
    
    // Format messages for xAI
    const xaiMessages: XAIMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ]

    // Add all messages
    messages.forEach((msg: Message) => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // If the content is a string, use it directly
        if (typeof msg.content === 'string') {
          xaiMessages.push({
            role: msg.role,
            content: msg.content
          })
        } 
        // If the content is an array (image + text), keep the array structure
        else if (Array.isArray(msg.content)) {
          xaiMessages.push({
            role: msg.role,
            content: msg.content
          })
        }
      }
    })

    console.log('[Chat API] Creating stream with model: grok-2-vision-latest')
    console.log('[Chat API] Final formatted messages:', JSON.stringify(xaiMessages, null, 2))

    try {
      // Convert messages to AI SDK format, preserving array structure for image messages
      const aiMessages = xaiMessages.map(msg => ({
        id: crypto.randomUUID(),
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        createdAt: new Date()
      })) as AIMessage[]

      const stream = streamText({
        model: xai('grok-2-vision-latest'),
        messages: aiMessages
      })

      // Create a new stream that logs chunks as they come in
      const loggedStream = new ReadableStream({
        async start(controller) {
          try {
            const reader = stream.toDataStreamResponse().body?.getReader()
            if (!reader) {
              throw new Error('No reader available')
            }

            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                console.log('[Chat API] Stream complete')
                controller.close()
                break
              }
              
              const text = new TextDecoder().decode(value)
              // Parse the SSE format to get the actual message
              const match = text.match(/\d+:"(.+)"/)
              if (match) {
                console.log('[Chat API] Received message:', match[1])
              } else {
                console.log('[Chat API] Received raw chunk:', text)
              }
              controller.enqueue(value)
            }
          } catch (error) {
            console.error('[Chat API] Error in stream:', error)
            controller.error(error)
          }
        }
      })

      console.log('[Chat API] Stream created, returning response')
      return new Response(loggedStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1'
        }
      })
    } catch (error) {
      console.error('[Chat API] Error creating stream:', error)
      throw error
    }

  } catch (error: any) {
    console.error('[Chat API] Error details:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
} 