import * as React from "react"
import { Copy, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Message } from "@/types/chat"

interface MessageActionsProps {
  message: Message
  isUser: boolean
  onQuote: (content: string) => void
}

export function MessageActions({ message, isUser, onQuote }: MessageActionsProps) {
  const handleCopy = async () => {
    const text = Array.isArray(message.content)
      ? message.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n')
      : message.content
    
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('[Chat Client] Failed to copy text:', error)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full p-0 hover:bg-transparent"
        onClick={handleCopy}
      >
        <Copy className="h-3 w-3" />
        <span className="sr-only">Copy message</span>
      </Button>
      {!isUser && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full p-0 hover:bg-transparent"
          onClick={() => onQuote(Array.isArray(message.content) 
            ? message.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n')
            : message.content)}
        >
          <Quote className="h-3 w-3" />
          <span className="sr-only">Quote message</span>
        </Button>
      )}
    </div>
  )
} 