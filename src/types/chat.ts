import type { Message as AIMessage } from 'ai'

type TextContent = {
  type: 'text'
  text: string
}

type ImageContent = {
  type: 'image'
  image: {
    data: string
    mime_type: string
  }
}

type MessageContent = TextContent | ImageContent

export interface Message extends Omit<AIMessage, 'content' | 'createdAt'> {
  content: string | MessageContent[]
  createdAt?: Date
}

export type { Message } 