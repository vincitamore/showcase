import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/env'
import { prisma } from '@/lib/db'
import { checkRateLimit, getRateLimitInfo } from '@/lib/rate-limit'
import { APIError, handleAPIError } from '@/lib/api-error'
import { 
  MODEL_CONFIGS,
  getSystemPrompt,
  extractSkillTags,
  type ChatMessage,
  type ModelConfig
} from '@/lib/chat-config'
import { xai } from '@ai-sdk/xai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { Message, MessageContent, TextContent, MessageRole } from '@/types/chat'
import type { LanguageModelV1 } from '@ai-sdk/provider'

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

// Convert our Message type to Anthropic format
function toAnthropicMessage(msg: Message): AnthropicMessage {
  return {
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
          return { type: 'text', text: '' }
        })
      : [{ type: 'text', text: String(msg.content) }]
  }
}

// Get the model provider based on the model name
function getModelProvider(model: string): LanguageModelV1 {
  const modelConfig = MODEL_CONFIGS[model]
  if (!modelConfig) {
    throw new Error(`Invalid model: ${model}`)
  }

  switch (modelConfig.provider) {
    case 'grok': {
      return xai(model) as LanguageModelV1
    }
    case 'anthropic': {
      try {
        // Initialize Anthropic provider
        const provider = anthropic(model) as LanguageModelV1
        
        console.log('[Chat API] Anthropic provider initialized:', {
          model,
          provider: 'anthropic',
          apiKeyLength: env.ANTHROPIC_API_KEY?.length || 0,
          hasHeaders: true,
          timestamp: new Date().toISOString()
        })

        return provider
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

// Add function to list available models
async function listAnthropicModels() {
  try {
    console.log('[Chat API] Fetching available Anthropic models')
    const headers: HeadersInit = {
      'x-api-key': env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }

    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers
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

// Wrap the original POST handler with error handling
export async function POST(req: Request) {
  try {
    console.log('----------------------------------------')
    console.log('[Chat API] Starting request processing')
    
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    
    // Rate limiting check
    const isAllowed = await checkRateLimit(ip)
    if (!isAllowed) {
      const rateLimitInfo = await getRateLimitInfo(ip)
      throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { messages, data, model = 'grok-2-latest' } = await req.json()
    const modelConfig = MODEL_CONFIGS[model]
    
    if (!modelConfig) {
      throw new APIError(`Invalid model: ${model}`, 400, 'INVALID_MODEL')
    }
    
    console.log('[Chat API] Request details:', {
      model,
      provider: modelConfig?.provider,
      messageCount: messages?.length,
      messages: messages?.map((m: any) => ({
        role: m.role,
        model: m.model,
        contentType: Array.isArray(m.content) ? 'array' : typeof m.content,
        contentPreview: JSON.stringify(m.content).slice(0, 100)
      }))
    })

    // Validate messages
    if (!Array.isArray(messages)) {
      throw new APIError('Messages must be an array', 400, 'INVALID_MESSAGES')
    }

    // Validate that all messages are for the correct model
    const invalidMessages = messages?.filter((m: Message) => m.model && m.model !== model)
    if (invalidMessages?.length > 0) {
      console.error('[Chat API] Found messages for incorrect model:', {
        expectedModel: model,
        invalidMessages: invalidMessages.map((m: Message) => ({
          id: m.id,
          model: m.model,
          role: m.role
        }))
      })
      throw new APIError('Request contains messages for incorrect model', 400, 'MODEL_MISMATCH')
    }

    // Format messages based on provider
    let formattedMessages
    const provider = modelConfig?.provider
    if (provider === 'anthropic') {
      console.log('[Chat API] Formatting messages for Anthropic')
      const systemPrompt = await getSystemPrompt()
      
      const systemMessage: Message = {
        id: 'system-' + Date.now(),
        role: 'system',
        content: systemPrompt,
        createdAt: new Date()
      }
      
      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: 'I understand. I will act as described.',
        createdAt: new Date()
      }
      
      formattedMessages = [
        toAnthropicMessage(systemMessage),
        toAnthropicMessage(assistantMessage),
        ...messages.map(toAnthropicMessage)
      ]

      logAnthropicRequest(formattedMessages, model)
    } else {
      // Format for xAI/Grok
      console.log('[Chat API] Formatting messages for Grok')
      const systemPrompt = await getSystemPrompt()
      formattedMessages = [
        {
          id: 'system-' + Date.now(),
          role: 'system',
          content: systemPrompt,
          createdAt: new Date()
        } as Message,
        ...messages
      ]
    }

    // Get the appropriate provider
    console.log('[Chat API] Getting model provider for:', model)
    const providerInstance = getModelProvider(model)

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
      model: providerInstance,
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

  } catch (error) {
    return handleAPIError(error)
  }
} 