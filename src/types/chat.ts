import type { Message as AIMessage } from 'ai'

export type TextContent = {
  type: 'text'
  text: string
}

export type ImageContent = {
  type: 'image'
  image: {
    data: string
    mime_type: string
  }
}

export type MessageContent = TextContent | ImageContent

export interface Message extends Omit<AIMessage, 'content'> {
  content: string | MessageContent[]
} 