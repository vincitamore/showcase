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
import { streamText } from 'ai'
import type { Message, MessageContent, TextContent, AIMessage } from '@/types/chat'
import { AIMessage as AI_SDK_AIMessage, convertToAIMessage } from '@/types/chat'
import { Message as AI_SDK_Message } from '@ai-sdk/ui-utils'

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
    console.log('Starting request processing')
    const { messages } = await req.json()

    // Get system prompt
    const systemPrompt = await getSystemPrompt()
    
    // Convert messages to xAI format and add system prompt
    const xaiMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages.map((message: Message) => convertToAIMessage(message))
    ]

    console.log('Formatted messages:', JSON.stringify(xaiMessages, null, 2))

    try {
      const stream = streamText({
        model: xai('grok-2-vision-latest'),
        messages: xaiMessages
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
                console.log('Stream complete')
                controller.close()
                break
              }
              
              const text = new TextDecoder().decode(value)
              // Parse the SSE format to get the actual message
              const match = text.match(/\d+:"(.+)"/)
              if (match) {
                console.log('Received message:', match[1])
              } else {
                console.log('Received raw chunk:', text)
              }
              controller.enqueue(value)
            }
          } catch (error) {
            console.error('Error in stream:', error)
            controller.error(error)
          }
        }
      })

      return new Response(loggedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    } catch (error) {
      console.error('Error creating stream:', error)
      throw error
    }

  } catch (error) {
    console.error('Error in chat route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 