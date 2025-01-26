import { Message as BaseAIMessage } from '@ai-sdk/ui-utils'

// Extend the base AIMessage type to support array content
export interface AIMessage extends Omit<BaseAIMessage, 'content'> {
  content: string | MessageContent[]
}

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
  let content = message.content
  
  // If content is a string and looks like a stringified array, parse it
  if (typeof content === 'string' && content.startsWith('[')) {
    try {
      content = JSON.parse(content)
    } catch {
      // If parsing fails, keep it as a string
    }
  }

  return {
    id: message.id,
    role: message.role,
    content // Will be either parsed array or original content
  }
}

export function convertFromAIMessage(message: AIMessage): CustomMessage {
  let content: string | MessageContent[]
  
  // If the content is a stringified array, parse it
  if (typeof message.content === 'string' && message.content.startsWith('[')) {
    try {
      content = JSON.parse(message.content)
    } catch {
      content = message.content
    }
  } else {
    content = message.content
  }

  return {
    id: message.id,
    role: message.role,
    content,
    createdAt: new Date()
  }
} 