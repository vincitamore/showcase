import type { Message as AIMessage } from 'ai'

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageUrlContent {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'high' | 'low'
  }
}

export type MessageContent = TextContent | ImageUrlContent
export type MessageRole = 'system' | 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string | MessageContent[]
  createdAt: Date
}

// Extend AIMessage to support our content types
export interface ExtendedAIMessage {
  id: string
  role: MessageRole
  content: string | MessageContent[]
  createdAt: Date
}

export function convertToAIMessage(message: Message): ExtendedAIMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt
  }
}

export function convertFromAIMessage(aiMessage: AIMessage): Message {
  return {
    id: aiMessage.id,
    role: aiMessage.role as MessageRole,
    content: aiMessage.content,
    createdAt: aiMessage.createdAt || new Date()
  }
}

// Helper function to check if content is in Anthropic format
export function isAnthropicContent(content: any): boolean {
  if (!Array.isArray(content)) return false
  return content.every(item => 
    typeof item === 'object' && 
    (
      (item.type === 'text' && typeof item.text === 'string') ||
      (item.type === 'image' && typeof item.source?.url === 'string')
    )
  )
}

// Helper function to convert content to Anthropic format
export function toAnthropicContent(content: string | MessageContent[]): any[] {
  if (Array.isArray(content)) {
    return content.map(item => {
      if (item.type === 'text') {
        return { type: 'text', text: item.text }
      }
      if (item.type === 'image_url') {
        return {
          type: 'image',
          source: {
            type: 'url',
            url: item.image_url.url,
            media_type: 'image/jpeg'
          }
        }
      }
      return { type: 'text', text: '' }
    })
  }
  return [{ type: 'text', text: content }]
}

// Helper function to convert Anthropic format to our format
export function fromAnthropicContent(content: any[]): string | MessageContent[] {
  if (!Array.isArray(content)) return ''
  
  const converted = content.map(item => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text } as TextContent
    }
    if (item.type === 'image') {
      return {
        type: 'image_url',
        image_url: {
          url: item.source.url,
          detail: 'high'
        }
      } as ImageUrlContent
    }
    return { type: 'text', text: '' } as TextContent
  })

  // If all items are text, join them
  if (converted.every(item => item.type === 'text')) {
    return converted.map(item => (item as TextContent).text).join('\n')
  }

  return converted
} 