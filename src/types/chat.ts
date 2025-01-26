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

export type Message = CustomMessage

export function convertToAIMessage(message: CustomMessage): AIMessage {
  if (Array.isArray(message.content)) {
    // Convert our message format to xAI's format
    const content = message.content.map(c => {
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
    return {
      id: message.id,
      role: message.role,
      content: JSON.stringify(content)
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