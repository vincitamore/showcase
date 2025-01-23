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

// Initialize the xAI model
const model = xai('grok-2-1212')

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

export async function POST(req: NextRequest) {
  try {
    console.log('[Chat API] Request received');
    console.log('[Chat API] Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'text/plain; charset=utf-8',
    };
    
    // Get IP address for rate limiting
    const ip = req.ip ?? 'anonymous'
    const userAgent = req.headers.get('user-agent') ?? 'unknown'

    // Check rate limit
    const isAllowed = await checkRateLimit(ip)
    if (!isAllowed) {
      const { remaining, reset } = await getRateLimitInfo(ip)
      console.log('[Chat API] Rate limit exceeded:', { ip, remaining, reset });
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          remaining,
          reset: reset.toISOString(),
        }),
        { status: 429, headers }
      )
    }

    // Parse the request body
    const text = await req.text();
    console.log('[Chat API] Raw request body:', text);
    
    const body = JSON.parse(text);
    console.log('[Chat API] Parsed request body:', body);

    // Get the active system prompt
    const systemPrompt = await getSystemPrompt()
    console.log('[Chat API] System prompt retrieved');

    // Create a new chat session
    const session = await prisma.chatSession.create({
      data: {
        ipAddress: ip,
        userAgent,
      },
    })
    console.log('[Chat API] Chat session created:', session.id);

    // Extract user message from either format
    let userContent: string;
    if (body.messages && Array.isArray(body.messages)) {
      const lastMessage = body.messages[body.messages.length - 1];
      userContent = lastMessage.content;
    } else if (body.data?.messages && Array.isArray(body.data.messages)) {
      const lastMessage = body.data.messages[body.data.messages.length - 1];
      userContent = lastMessage.content;
    } else if (body.options?.body?.messages && Array.isArray(body.options.body.messages)) {
      const lastMessage = body.options.body.messages[body.options.body.messages.length - 1];
      userContent = lastMessage.content;
    } else if (body.data?.content) {
      userContent = body.data.content;
    } else {
      console.error('[Chat API] Invalid message format:', body);
      throw new Error('Invalid message format');
    }

    // Store the user's message in the database
    const userMessage: Message = { 
      id: session.id, 
      role: 'user', 
      content: userContent 
    }
    await prisma.message.create({
      data: {
        chatSessionId: session.id,
        content: userMessage.content,
        role: userMessage.role,
        tokens: userMessage.content.length / 4, // Rough estimate
        skillTags: [],
      },
    })
    console.log('[Chat API] User message stored');

    // Prepare messages for the API
    const apiMessages: Message[] = [
      { id: 'system', role: 'system', content: systemPrompt },
      userMessage
    ]
    console.log('[Chat API] Prepared messages for model:', apiMessages);

    // Create the stream using the provider-agnostic streamText
    const stream = streamText({
      model,
      messages: apiMessages,
      temperature: CHAT_SETTINGS.temperature,
      maxTokens: CHAT_SETTINGS.maxTokens,
    })
    console.log('[Chat API] Stream created');

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
        console.log('[Chat API] Stream complete, storing response');
        await prisma.message.create({
          data: {
            chatSessionId: session.id,
            content: fullResponse,
            role: 'assistant',
            tokens: fullResponse.length / 4, // Rough estimate
            skillTags: extractSkillTags(fullResponse),
          },
        })
        console.log('[Chat API] Response stored');
      },
    })

    // Get the response stream
    const responseStream = await stream.toDataStream()
    console.log('[Chat API] Response stream ready');

    // Chain the streams
    const finalStream = responseStream.pipeThrough(transformStream)

    // Return the streaming response
    return new Response(finalStream, { headers })
  } catch (error) {
    console.error('[Chat API] Error:', error);
    if (error instanceof Error) {
      console.error('[Chat API] Error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    }
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        }
      }
    )
  }
} 