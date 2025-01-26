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
    
    // Log raw request details
    console.log('[Chat API] Request headers:', {
      contentType: req.headers.get('content-type'),
      contentLength: req.headers.get('content-length')
    })
    
    const { messages, data } = await req.json()
    console.log('[Chat API] Parsed request body:', {
      hasImageData: !!data?.imageData,
      imageDataLength: data?.imageData?.length,
      text: data?.text,
      mimeType: data?.mimeType,
      messageCount: messages?.length,
      lastMessageRole: messages?.[messages.length - 1]?.role
    })

    // Get system prompt
    const systemPrompt = await getSystemPrompt()
    console.log('[Chat API] Retrieved system prompt length:', systemPrompt.length)
    
    // Format messages for xAI
    const xaiMessages: XAIMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ]

    // Add previous messages
    messages.slice(0, -1).forEach((msg: Message) => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        xaiMessages.push({
          role: msg.role,
          content: Array.isArray(msg.content) 
            ? msg.content.filter(c => c.type === 'text').map(c => (c as TextContent).text).join('\n')
            : msg.content
        })
      }
    })

    // Format the current message
    const currentMessage = messages[messages.length - 1]
    if (data?.imageData) {
      console.log('[Chat API] Processing image message:', {
        hasText: !!data.text,
        imageDataLength: data.imageData.length,
        mimeType: data.mimeType
      })
      xaiMessages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${data.mimeType};base64,${data.imageData}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: data.text || 'What is in this image?'
          }
        ]
      })
    } else {
      console.log('[Chat API] Processing text-only message')
      xaiMessages.push({
        role: 'user',
        content: currentMessage.content
      })
    }

    console.log('[Chat API] Final formatted messages:', xaiMessages.map(msg => ({
      role: msg.role,
      contentType: Array.isArray(msg.content) ? 'array' : typeof msg.content,
      contentLength: Array.isArray(msg.content) 
        ? msg.content.reduce((acc, curr) => acc + (curr.type === 'text' ? curr.text.length : 0), 0)
        : msg.content?.length
    })))

    console.log('[Chat API] Creating stream with xAI')
    
    try {
      // Convert xAI messages to AI SDK format
      const aiMessages = xaiMessages.map(msg => ({
        id: crypto.randomUUID(),
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        createdAt: new Date()
      })) as AIMessage[]

      console.log('[Chat API] Converted messages for AI SDK:', aiMessages.map(msg => ({
        role: msg.role,
        contentLength: msg.content.length,
        contentPreview: msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : '')
      })))

      console.log('[Chat API] Creating stream with model: grok-2-vision-1212')
      const stream = streamText({
        model: xai('grok-2-vision-1212'),
        messages: aiMessages
      })

      // Log the raw request being sent to xAI
      console.log('[Chat API] Raw request to xAI:', {
        model: 'grok-2-vision-1212',
        messages: aiMessages.map(msg => ({
          role: msg.role,
          content: msg.content.length > 100 
            ? msg.content.slice(0, 100) + '...' 
            : msg.content
        }))
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
      const response = new Response(loggedStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1'
        }
      })
      console.log('[Chat API] Response created with headers:', response.headers)
      return response
    } catch (error) {
      console.error('[Chat API] Error creating stream:', error)
      throw error
    }

  } catch (error: any) {
    console.error('[Chat API] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      requestBody: error.requestBody,
      response: error.response,
      code: error.code
    })
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'UnknownError',
        type: error instanceof Error ? error.constructor.name : 'UnknownType',
        stack: error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    )
  }
} 