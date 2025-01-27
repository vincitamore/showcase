import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/env'
import { prisma } from '@/lib/db'
import { checkRateLimit, getRateLimitInfo } from '@/lib/rate-limit'
import { 
  MODEL_CONFIGS,
  getSystemPrompt,
  extractSkillTags,
  type ChatMessage,
  type ModelConfig
} from '@/lib/chat-config'
import { xai } from '@ai-sdk/xai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, type Message as AIMessage } from 'ai'
import type { Message, MessageContent, TextContent } from '@/types/chat'
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: Array<{
    type: 'text' | 'image'
    text?: string
    source?: {
      type: 'url'
      url: string
      media_type: string
    }
  }>
}

// Create Anthropic provider instance with proper configuration
const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  headers: {
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  }
})

// Add debug logging for Anthropic requests
function logAnthropicRequest(messages: AnthropicMessage[], model: string) {
  console.log('[Chat API] Anthropic request details:', {
    model,
    messageCount: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      contentPreview: JSON.stringify(m.content).slice(0, 100)
    })),
    headers: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  })
}

// Helper to parse error chunks
function parseErrorChunk(chunk: string): { error?: any, text?: string } {
  // Remove any numeric prefix (e.g. "3:")
  const cleanChunk = chunk.replace(/^\d+:/, '').trim()
  
  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(cleanChunk)
    return { error: parsed }
  } catch {
    // If not JSON, treat as text
    return { text: cleanChunk }
  }
}

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

// Get the model provider based on the model name
function getModelProvider(model: string): LanguageModelV1 {
  const modelConfig = MODEL_CONFIGS[model]
  if (!modelConfig) {
    throw new Error(`Invalid model: ${model}`)
  }

  switch (modelConfig.provider) {
    case 'grok': {
      return xai(model) as unknown as LanguageModelV1
    }
    case 'anthropic': {
      try {
        // Initialize Anthropic provider
        const provider = anthropic(model)
        
        console.log('[Chat API] Anthropic provider initialized:', {
          model,
          provider: 'anthropic',
          apiKeyLength: env.ANTHROPIC_API_KEY?.length || 0,
          hasHeaders: true,
          timestamp: new Date().toISOString()
        })

        return provider as unknown as LanguageModelV1
      } catch (error: any) {
        console.error('[Chat API] Error initializing Anthropic provider:', {
          error: {
            name: error?.name,
            message: error?.message,
            type: error?.constructor?.name,
            code: error?.code,
            status: error?.status,
            response: error?.response,
          },
          stack: error?.stack,
          timestamp: new Date().toISOString()
        })
        throw error
      }
    }
    default:
      throw new Error(`Unsupported model provider: ${modelConfig.provider}`)
  }
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

// Add function to list available models
async function listAnthropicModels() {
  try {
    console.log('[Chat API] Fetching available Anthropic models')
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    })

    console.log('[Chat API] Models list response status:', response.status)
    const data = await response.json()
    console.log('[Chat API] Available models:', data)
    return data
  } catch (error) {
    console.error('[Chat API] Error fetching models:', error)
    throw error
  }
}

// Add debug logging to track request processing
export async function POST(req: Request) {
  try {
    console.log('----------------------------------------')
    console.log('[Chat API] Starting request processing')
    
    const { messages, data, model = 'grok-2-vision-1212' } = await req.json()
    const modelConfig = MODEL_CONFIGS[model]
    
    console.log('[Chat API] Request details:', {
      model,
      provider: modelConfig?.provider,
      messageCount: messages?.length
    })

    // In the POST handler, before formatting messages:
    console.log('[Chat API] Raw incoming messages:', {
      messages: messages?.map((m: any) => ({
        role: m.role,
        contentType: Array.isArray(m.content) ? 'array' : typeof m.content,
        contentPreview: JSON.stringify(m.content).slice(0, 100)
      }))
    })

    // Format messages based on provider
    let formattedMessages
    if (modelConfig?.provider === 'anthropic') {
      console.log('[Chat API] Formatting messages for Anthropic')
      const systemPrompt = await getSystemPrompt()
      formattedMessages = [
        {
          role: 'user',
          content: [{ type: 'text', text: systemPrompt }]
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'I understand. I will act as described.' }]
        },
        ...messages.map((msg: Message) => {
          const formatted = {
            role: msg.role === 'system' ? 'user' : msg.role,
            content: Array.isArray(msg.content)
              ? msg.content.map(c => {
                  if (c.type === 'text') {
                    return { type: 'text', text: c.text }
                  }
                  if (c.type === 'image_url') {
                    return {
                      type: 'image',
                      source: {
                        type: 'url',
                        url: c.image_url.url,
                        media_type: 'image/jpeg'
                      }
                    }
                  }
                  return null
                }).filter(Boolean)
              : [{ type: 'text', text: String(msg.content) }]
          }
          console.log('[Chat API] Formatted message:', {
            original: {
              role: msg.role,
              contentPreview: JSON.stringify(msg.content).slice(0, 100)
            },
            formatted: {
              role: formatted.role,
              contentPreview: JSON.stringify(formatted.content).slice(0, 100)
            }
          })
          return formatted
        })
      ]

      logAnthropicRequest(formattedMessages, model)
    } else {
      // Format for xAI/Grok
      console.log('[Chat API] Formatting messages for Grok')
      const systemPrompt = await getSystemPrompt()
      formattedMessages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...messages.map((msg: Message) => ({
          role: msg.role,
          content: Array.isArray(msg.content)
            ? msg.content
            : String(msg.content)
        }))
      ]
    }

    // Get the appropriate provider
    console.log('[Chat API] Getting model provider for:', model)
    const provider = getModelProvider(model)

    // Log the stream request
    console.log('[Chat API] Creating stream with config:', {
      model: model,
      messageCount: formattedMessages.length,
      providerType: modelConfig?.provider,
      options: modelConfig?.provider === 'anthropic' ? {
        maxTokens: 4096,
        temperature: 0.7,
        stream: true
      } : {}
    })

    // Create the stream with provider-specific options
    const aiStream = await streamText({
      model: provider,
      messages: formattedMessages,
      ...(modelConfig?.provider === 'anthropic' ? {
        maxTokens: 4096,
        temperature: 0.7,
        stream: true
      } : {})
    })

    // Convert AI SDK stream to web stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiStream.toDataStreamResponse().body?.getReader()
        if (!reader) {
          controller.error(new Error('No reader available'))
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              controller.close()
              break
            }

            // Log raw value before any processing
            console.log('[Chat API] Raw stream value:', {
              raw: value,
              decoded: new TextDecoder().decode(value),
              byteLength: value.byteLength
            })

            // Pass through raw value without processing
            controller.enqueue(value)
          }
        } catch (error: any) {
          console.error('[Chat API] Stream processing error:', {
            error: error.message,
            stack: error.stack,
            type: error?.constructor?.name,
            timestamp: new Date().toISOString()
          })
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no'
      },
    })

  } catch (error: any) {
    console.error('[Chat API] Error processing request:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        details: {
          name: error.name,
          stack: error.stack,
          cause: error.cause
        }
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
} 