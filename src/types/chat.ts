import { Message as AIMessage } from '@ai-sdk/ui-utils'

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageUrlContent {
  type: 'image_url'
  image_url: {
    url: string
    detail: 'high' | 'low'
  }
}

export type MessageContent = TextContent | ImageUrlContent

export interface CustomMessage {
  id: string
  role: AIMessage['role']
  content: string | MessageContent[]
  createdAt: Date
}

// Define the AI message content type
export type AIMessageContent = string | MessageContent[]

// Extend the AI message type to support array content
export interface ExtendedAIMessage extends Omit<AIMessage, 'content'> {
  content: AIMessageContent
}

export type Message = CustomMessage

export function convertToAIMessage(message: CustomMessage): ExtendedAIMessage {
  if (Array.isArray(message.content)) {
    // Convert our message format to xAI's format but don't stringify the array
    return {
      id: message.id,
      role: message.role,
      content: message.content.map(c => {
        if (c.type === 'text') {
          return {
            type: 'text',
            text: c.text
          }
        } else if (c.type === 'image_url') {
          return {
            type: 'image_url',
            image_url: c.image_url
          }
        }
        return c
      })
    }
  }
  
  return {
    id: message.id,
    role: message.role,
    content: message.content
  }
}

export function convertFromAIMessage(message: AIMessage): CustomMessage {
  let content: string | MessageContent[]
  try {
    // Try to parse the content as JSON in case it's a structured message
    const parsed = JSON.parse(message.content)
    if (Array.isArray(parsed)) {
      content = parsed
    } else {
      content = message.content
    }
  } catch {
    // If parsing fails, use the content as-is
    content = message.content
  }

  return {
    id: message.id,
    role: message.role,
    content,
    createdAt: new Date()
  }
} 