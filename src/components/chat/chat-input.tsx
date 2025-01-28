import * as React from "react"
import { Send, Loader2, Image as ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  className?: string
  placeholder?: string
  onImageSelect?: (file: File) => void
  onImageRemove?: () => void
  imagePreview?: string | null
}

export function ChatInput({ 
  input, 
  handleInputChange, 
  handleSubmit, 
  isLoading,
  className,
  placeholder = "Type a message...",
  onImageSelect,
  onImageRemove,
  imagePreview
}: ChatInputProps) {
  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative rounded-lg border bg-background">
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </form>
  )
} 