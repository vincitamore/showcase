import * as React from "react"
import { Copy, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Message } from "@/types/chat"
import { cn } from "@/lib/utils"

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
    <div className={cn(
      "flex items-center gap-2",
      "flex-row md:flex-col",
      "touch-none select-none",
      "z-30"
    )}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 sm:h-7 sm:w-7 rounded-full p-0",
          "bg-background/95",
          "hover:bg-primary/10 hover:text-primary active:scale-95",
          "transition-all duration-200",
          "shadow-sm"
        )}
        onClick={handleCopy}
      >
        <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span className="sr-only">Copy message</span>
      </Button>
      {!isUser && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 sm:h-7 sm:w-7 rounded-full p-0",
            "bg-background/95",
            "hover:bg-primary/10 hover:text-primary active:scale-95",
            "transition-all duration-200",
            "shadow-sm"
          )}
          onClick={() => onQuote(Array.isArray(message.content) 
            ? message.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n')
            : message.content)}
        >
          <Quote className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="sr-only">Quote message</span>
        </Button>
      )}
    </div>
  )
} 