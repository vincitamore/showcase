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
      "flex flex-col items-center gap-1.5",
      "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
      "touch-none select-none"
    )}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 sm:h-6 sm:w-6 rounded-full p-0",
          "hover:bg-primary/10 hover:text-primary active:scale-95",
          "transition-all duration-200"
        )}
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
        <span className="sr-only">Copy message</span>
      </Button>
      {!isUser && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 sm:h-6 sm:w-6 rounded-full p-0",
            "hover:bg-primary/10 hover:text-primary active:scale-95",
            "transition-all duration-200"
          )}
          onClick={() => onQuote(Array.isArray(message.content) 
            ? message.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n')
            : message.content)}
        >
          <Quote className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
          <span className="sr-only">Quote message</span>
        </Button>
      )}
    </div>
  )
} 