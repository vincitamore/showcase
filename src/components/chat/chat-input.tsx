import * as React from "react"
import { Send, Loader2, Image as ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  className?: string
  placeholder?: string
  onImageSelect: (file: File) => void
  onImageRemove: () => void
  imagePreview: string | null
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
  const imageInputRef = React.useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImageSelect(file)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative rounded-lg border bg-background">
        {imagePreview && (
          <div className="p-2 border-b">
            <div className="relative w-32 h-32">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={onImageRemove}
                className="absolute -top-2 -right-2 p-1 rounded-full bg-background border"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove image</span>
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" />
            <span className="sr-only">Attach image</span>
          </Button>
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
            disabled={(!input.trim() && !imagePreview) || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        aria-label="Upload image"
      />
    </form>
  )
} 