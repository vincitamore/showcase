"use client"

import * as React from "react"
import { useChat } from "ai/react"
import type { Message as AIMessage } from 'ai'
import type { Message, MessageContent, TextContent, ImageUrlContent } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Send, Loader2, History, Heart, ThumbsUp, ThumbsDown, MoreVertical, Copy, Quote, Trash2, Download, Upload, Image as ImageIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import { motion, AnimatePresence } from "framer-motion"
import { useTypewriter, Cursor } from 'react-simple-typewriter'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { convertToAIMessage, convertFromAIMessage } from "@/types/chat"

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
}

interface MessageReaction {
  emoji: (active: boolean) => React.ReactNode
  count: number
  active: boolean
  type: 'heart' | 'thumbsDown'
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  code: ({ className, children, inline }: CodeProps) => (
    <code
      className={cn(
        "rounded bg-primary/10 px-1 py-0.5 font-mono text-sm",
        inline ? "inline" : "block p-2",
        className
      )}
    >
      {children}
    </code>
  ),
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
  h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold last:mb-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 text-base font-semibold last:mb-0">{children}</h4>,
  img: ({ src, alt }) => (
    <div className="relative w-full max-w-[300px] my-4">
      <img 
        src={src} 
        alt={alt || 'Chat image'} 
        className="rounded-lg w-full h-auto object-contain"
        loading="lazy"
        onError={(e) => {
          console.error('[Chat Client] Image failed to load:', e)
          e.currentTarget.alt = 'Failed to load image'
        }}
      />
    </div>
  ),
}

function ChatSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto opacity-0" />
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <motion.div
        className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8, repeatDelay: 0.2 }}
      />
      <motion.div
        className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.2, repeatDelay: 0.2 }}
      />
      <motion.div
        className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.4, repeatDelay: 0.2 }}
      />
    </div>
  )
}

function MessageReactions({ isAssistant, messageId, onReactionChange }: { 
  isAssistant: boolean
  messageId: string
  onReactionChange: (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => void
}) {
  const [reactions, setReactions] = React.useState<MessageReaction[]>([
    { 
      emoji: (active: boolean) => active ? 
        <Heart className="h-3 w-3 fill-red-500 text-red-500" /> : 
        <Heart className="h-3 w-3" />,
      count: 0, 
      active: false,
      type: 'heart' as const
    },
    { 
      emoji: (active: boolean) => active ? 
        <ThumbsDown className="h-3 w-3 fill-foreground text-foreground" /> : 
        <ThumbsDown className="h-3 w-3" />,
      count: 0, 
      active: false,
      type: 'thumbsDown' as const
    },
  ])

  const handleReaction = (index: number) => {
    setReactions(prev => prev.map((reaction, i) => {
      if (i === index) {
        const newActive = !reaction.active;
        onReactionChange(messageId, reaction.type, newActive);
        return {
          ...reaction,
          count: newActive ? reaction.count + 1 : reaction.count - 1,
          active: newActive
        }
      }
      return reaction
    }))
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex gap-0.5 -mt-1",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {reactions.map((reaction, index) => (
        <Button
          key={index}
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-full p-0 hover:bg-transparent",
            !reaction.active && "text-muted-foreground/60 hover:text-muted-foreground"
          )}
          onClick={() => handleReaction(index)}
        >
          <motion.div
            whileTap={{ scale: 0.8 }}
            className="flex items-center gap-1"
          >
            {reaction.emoji(reaction.active)}
            {reaction.count > 0 && (
              <span className={cn(
                "text-xs",
                reaction.active && reaction.type === 'heart' && "text-red-500",
                reaction.active && reaction.type === 'thumbsDown' && "text-foreground"
              )}>
                {reaction.count}
              </span>
            )}
          </motion.div>
        </Button>
      ))}
    </motion.div>
  )
}

function QuoteModal({
  content,
  isOpen,
  onClose,
  onQuote,
}: {
  content: string
  isOpen: boolean
  onClose: () => void
  onQuote: (content: string) => void
}) {
  const [response, setResponse] = React.useState("")
  
  const handleSubmit = () => {
    const formattedMessage = `> ${content}\n\n${response}`
    onQuote(formattedMessage)
    onClose()
    setResponse("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogTitle>Quote & Reply</DialogTitle>
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="border-l-2 border-primary/50 pl-3">
              <ReactMarkdown components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Your response</div>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Type your response..."
              className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!response.trim()}
          >
            Send Reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExportOptionsDialog({
  isOpen,
  onClose,
  onExport,
  messageCount,
  heartedCount,
  thumbsDownCount
}: {
  isOpen: boolean
  onClose: () => void
  onExport: (options: { includeAll: boolean; includeHearted: boolean; excludeThumbsDown: boolean }) => void
  messageCount: number
  heartedCount: number
  thumbsDownCount: number
}) {
  const [includeAll, setIncludeAll] = React.useState(true)
  const [includeHearted, setIncludeHearted] = React.useState(false)
  const [excludeThumbsDown, setExcludeThumbsDown] = React.useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Export Options</DialogTitle>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeAll"
              checked={includeAll}
              onChange={(e) => {
                setIncludeAll(e.target.checked)
                if (e.target.checked) {
                  setIncludeHearted(false)
                }
              }}
              className="h-4 w-4 rounded border-primary"
            />
            <label htmlFor="includeAll" className="text-sm font-medium">
              Export all messages ({messageCount})
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeHearted"
              checked={includeHearted}
              onChange={(e) => {
                setIncludeHearted(e.target.checked)
                if (e.target.checked) {
                  setIncludeAll(false)
                }
              }}
              className="h-4 w-4 rounded border-primary"
            />
            <label htmlFor="includeHearted" className="text-sm font-medium">
              Only export hearted messages ({heartedCount})
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="excludeThumbsDown"
              checked={excludeThumbsDown}
              onChange={(e) => setExcludeThumbsDown(e.target.checked)}
              className="h-4 w-4 rounded border-primary"
            />
            <label htmlFor="excludeThumbsDown" className="text-sm font-medium">
              Exclude thumbs down messages ({thumbsDownCount})
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => {
            onExport({ includeAll, includeHearted, excludeThumbsDown })
            onClose()
          }}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageActions({ 
  message, 
  isUser,
  onQuote 
}: { 
  message: Message
  isUser: boolean
  onQuote: (content: string) => void
}) {
  const handleCopy = async () => {
    const text = Array.isArray(message.content) 
      ? message.content.filter(c => c.type === 'text').map(c => (c as TextContent).text).join('\n')
      : message.content
    await navigator.clipboard.writeText(text)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Message actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onQuote(Array.isArray(message.content) 
          ? message.content.filter(c => c.type === 'text').map(c => (c as TextContent).text).join('\n')
          : message.content)}>
          <Quote className="mr-2 h-4 w-4" />
          Quote
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ChatBubble = ({ 
  message, 
  isLoading,
  onQuote,
  onReactionChange
}: { 
  message: Message
  isLoading?: boolean
  onQuote: (content: string) => void
  onReactionChange: (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => void
}): JSX.Element => {
  const [showActions, setShowActions] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const isUser = message.role === 'user'

  // Extract text and image content
  const textContent = Array.isArray(message.content) 
    ? message.content.filter(c => c.type === 'text').map(c => (c as TextContent).text).join('\n')
    : message.content

  const imageContent = Array.isArray(message.content)
    ? message.content.find(c => c.type === 'image_url') as ImageUrlContent | undefined
    : null

  const formatTime = (date: Date | string | number | undefined): string => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div
      className={cn(
        "group relative mb-4 flex items-start",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn(
        "rounded-lg px-4 py-2 max-w-[85%] space-y-2 relative group",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {textContent && (
          <ReactMarkdown
            components={markdownComponents}
            className="prose dark:prose-invert prose-sm break-words"
          >
            {textContent}
          </ReactMarkdown>
        )}
        
        {imageContent && (
          <div className="relative w-full max-w-[300px] my-4">
            <img 
              src={imageContent.image_url.url}
              alt="Uploaded image"
              className="rounded-lg w-full h-auto object-contain"
              loading="lazy"
              onError={(e) => {
                console.error('[Chat Client] Image failed to load:', e)
                e.currentTarget.alt = 'Failed to load image'
              }}
            />
          </div>
        )}

        {isLoading && (
          <div className="h-4 flex items-center justify-center">
            <TypingIndicator />
          </div>
        )}

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageActions 
            message={message}
            isUser={isUser}
            onQuote={onQuote}
          />
        </div>

        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground/60">
          <MessageReactions 
            isAssistant={!isUser}
            messageId={message.id}
            onReactionChange={onReactionChange}
          />
          <time>
            {formatTime(message.createdAt)}
          </time>
        </div>
      </div>
    </div>
  )
}

function ChatInput({ 
  input, 
  handleInputChange, 
  handleSubmit, 
  isLoading,
  className,
  placeholder = "Type a message...",
  onImageSelect,
  onImageRemove,
  imagePreview
}: { 
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  className?: string
  placeholder?: string
  onImageSelect: (file: File) => void
  onImageRemove: () => void
  imagePreview: string | null
}) {
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

async function convertToJpeg(file: File) {
  console.log('[Chat Client] Converting image:', {
    originalSize: file.size,
    type: file.type
  })

  return new Promise<{ data: string, mimeType: string }>((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = e.target?.result as string
    }

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Use crisp rendering
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Draw with white background to handle transparency
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      // Use a higher quality (0.92) for better image quality
      const jpegData = canvas.toDataURL('image/jpeg', 0.92)
      
      // Log the converted size
      const base64Data = jpegData.split(',')[1]
      console.log('[Chat Client] Converted image:', {
        originalSize: file.size,
        convertedSize: Math.round(base64Data.length * 0.75), // base64 is ~4/3 the size of binary
        width: img.width,
        height: img.height
      })

      resolve({
        data: base64Data,
        mimeType: 'image/jpeg'
      })
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    reader.readAsDataURL(file)
  })
}

export function AnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isAlertOpen, setIsAlertOpen] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [localMessages, setLocalMessages] = React.useState<Message[]>([])
  
  const { 
    messages: aiMessages, 
    input, 
    handleInputChange, 
    handleSubmit: originalHandleSubmit, 
    isLoading, 
    setInput 
  } = useChat({
    api: "/api/chat",
    body: {
      model: "grok-2-vision-latest"
    },
    initialMessages: [],
    id: React.useId(),
    onFinish: (message) => {
      // Don't update messages here, we'll handle it in the stream
    }
  })

  // Use localMessages for rendering
  const messages = localMessages

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsDialogOpen(true)
    
    if (isLoading) return

    try {
      if (selectedImage) {
        console.log('[Chat Client] Starting image upload process')
        
        // Convert image to JPEG with error handling
        let base64Data: string, mimeType: string
        try {
          const result = await convertToJpeg(selectedImage)
          base64Data = result.data
          mimeType = result.mimeType
          console.log('[Chat Client] Image converted to JPEG successfully')
        } catch (error) {
          console.error('[Chat Client] Failed to convert image:', error)
          throw new Error('Failed to process image')
        }

        // Upload image to get URL
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: {
              data: base64Data,
              mime_type: mimeType
            }
          })
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }

        const { url: imageUrl } = await uploadResponse.json()

        // Create message with image content
        const imageMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: [
            {
              type: 'text',
              text: input || 'What is in this image?'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ],
          createdAt: new Date()
        }

        // Add message to chat immediately
        const updatedMessages = [...localMessages, imageMessage]
        setLocalMessages(updatedMessages)
        
        try {
          // Send message with image URL
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: updatedMessages.map(msg => convertToAIMessage(msg))
            })
          })

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Create a placeholder for the assistant's response
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            createdAt: new Date()
          }

          setLocalMessages([...updatedMessages, assistantMessage])

          // Process the streaming response
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let responseText = ''

          while (reader) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            console.log('[Chat Client] Raw chunk:', chunk)
            
            // Split into lines and process each line
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (!line.trim()) continue
              
              // Handle different message types
              if (line.startsWith('f:')) continue // Skip function call messages
              if (line.startsWith('e:') || line.startsWith('d:')) continue // Skip end messages
              
              // Clean up the response text
              // Remove the "0:" prefix and any surrounding quotes
              const cleanedText = line.replace(/^\d+:\s*"?|"?$/g, '')
              
              // Process actual content
              responseText += cleanedText
              
              // Update the assistant's message with the accumulated response
              setLocalMessages(prev => {
                const updated = [...prev]
                const lastMessage = updated[updated.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content = responseText
                }
                return [...updated]
              })
            }
          }

          // Save to localStorage after the stream is complete
          localStorage.setItem('chatHistory', JSON.stringify([...updatedMessages, {
            ...assistantMessage,
            content: responseText
          }]))

          console.log('[Chat Client] Image message sent and response received successfully')
        } catch (error) {
          console.error('[Chat Client] Failed to send image message:', error)
          throw error
        }

        // Reset states
        setSelectedImage(null)
        setImagePreview(null)
        setInput?.('')
        
      } else {
        // For text-only messages
        const textMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: input,
          createdAt: new Date()
        }

        // Add user message to local state
        const updatedMessages = [...localMessages, textMessage]
        setLocalMessages(updatedMessages)

        try {
          // Send message
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: updatedMessages.map(msg => convertToAIMessage(msg))
            })
          })

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Create a placeholder for the assistant's response
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            createdAt: new Date()
          }

          setLocalMessages([...updatedMessages, assistantMessage])

          // Process the streaming response
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let responseText = ''

          while (reader) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            console.log('[Chat Client] Raw chunk:', chunk)
            
            // Split into lines and process each line
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (!line.trim()) continue
              
              // Handle different message types
              if (line.startsWith('f:')) continue // Skip function call messages
              if (line.startsWith('e:') || line.startsWith('d:')) continue // Skip end messages
              
              // Clean up the response text
              // Remove the "0:" prefix and any surrounding quotes
              const cleanedText = line.replace(/^\d+:\s*"?|"?$/g, '')
              
              // Process actual content
              responseText += cleanedText
              
              // Update the assistant's message with the accumulated response
              setLocalMessages(prev => {
                const updated = [...prev]
                const lastMessage = updated[updated.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content = responseText
                }
                return [...updated]
              })
            }
          }

          // Save to localStorage after the stream is complete
          localStorage.setItem('chatHistory', JSON.stringify([...updatedMessages, {
            ...assistantMessage,
            content: responseText
          }]))

          console.log('[Chat Client] Text message sent and response received successfully')
        } catch (error) {
          console.error('[Chat Client] Failed to send text message:', error)
          throw error
        }

        // Reset input
        setInput?.('')
      }
    } catch (error) {
      console.error('[Chat Client] Error in handleFormSubmit:', error)
      // TODO: Add error toast notification here
    }
  }

  // Load chat history from localStorage on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory')
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory)
        setLocalMessages(parsedHistory)
      } catch (error) {
        console.error('Failed to parse chat history:', error)
      }
    }
  }, [])

  const handleClearHistory = () => {
    setLocalMessages([])
    localStorage.removeItem('chatHistory')
    setIsAlertOpen(false)
  }

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [localMessages])

  const [text] = useTypewriter({
    words: ['How can I help you today?', 'Ask me about my skills...', 'Learn about my experience...', 'Discover my projects...'],
    loop: true,
    delaySpeed: 2000,
  })

  const handleImageSelect = (file: File) => {
    setSelectedImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageRemove = () => {
    setSelectedImage(null)
    setImagePreview(null)
  }

  const handleQuote = React.useCallback((content: string) => {
    if (setInput) {
      setInput(content)
    }
  }, [setInput])

  const [messageReactions, setMessageReactions] = React.useState<Record<string, { heart: boolean, thumbsDown: boolean }>>({})

  const handleReactionChange = (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => {
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: {
        ...prev[messageId] || { heart: false, thumbsDown: false },
        [type]: active
      }
    }))
  }

  const [isExportOptionsOpen, setIsExportOptionsOpen] = React.useState(false)

  const handleExportWithOptions = ({ includeAll, includeHearted, excludeThumbsDown }: { 
    includeAll: boolean
    includeHearted: boolean
    excludeThumbsDown: boolean 
  }) => {
    let filteredMessages = localMessages
    
    if (!includeAll) {
      if (includeHearted) {
        filteredMessages = localMessages.filter(m => messageReactions[m.id]?.heart)
      }
    }
    
    if (excludeThumbsDown) {
      filteredMessages = filteredMessages.filter(m => !messageReactions[m.id]?.thumbsDown)
    }

    const exportData = {
      messages: filteredMessages,
      exportDate: new Date().toISOString(),
      metadata: {
        totalMessages: localMessages.length,
        exportedMessages: filteredMessages.length,
        heartedMessages: localMessages.filter(m => messageReactions[m.id]?.heart).length,
        thumbsDownMessages: localMessages.filter(m => messageReactions[m.id]?.thumbsDown).length
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportClick = () => {
    setIsExportOptionsOpen(true)
  }

  const handleImportHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string)
        if (Array.isArray(importedData.messages)) {
          setLocalMessages(importedData.messages)
          localStorage.setItem('chatHistory', JSON.stringify(importedData.messages))
        } else {
          throw new Error('Invalid file format')
        }
      } catch (error) {
        console.error('Failed to import chat history:', error)
        // You might want to show a toast notification here
      }
    }
    reader.readAsText(file)
    // Reset the file input
    if (event.target) {
      event.target.value = ''
    }
  }

  if (!mounted) {
    return <ChatSkeleton />
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div 
          key="chat-input"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
            scale: {
              type: "spring",
              damping: 20,
              stiffness: 100
            }
          }}
          className="w-full max-w-3xl mx-auto"
        >
          <motion.div 
            className="text-center mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <h2 className="text-2xl font-semibold text-foreground/80">
              {text}<Cursor cursorStyle="_" />
            </h2>
          </motion.div>
          
          <motion.div 
            className="relative"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleFormSubmit}
              isLoading={isLoading}
              placeholder="What does your motto mean?"
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              imagePreview={imagePreview}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsDialogOpen(true)}
              className="absolute right-14 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
              disabled={isLoading}
            >
              <History className="h-4 w-4" />
              <span className="sr-only">View chat history</span>
            </Button>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex h-[80vh] max-h-[80vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <DialogTitle className="text-lg font-semibold">Chat History</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 rounded-full p-0 opacity-70 hover:opacity-100 hover:bg-primary/10 hover:text-primary"
                title="Import chat history"
              >
                <Upload className="h-4 w-4" />
                <span className="sr-only">Import chat history</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExportClick}
                disabled={localMessages.length === 0}
                className="h-8 w-8 rounded-full p-0 opacity-70 hover:opacity-100 hover:bg-primary/10 hover:text-primary"
                title="Export chat history"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export chat history</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAlertOpen(true)}
                disabled={localMessages.length === 0}
                className="h-8 w-8 rounded-full p-0 opacity-70 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear history</span>
              </Button>
              <DialogClose className="h-6 w-6 rounded-md p-0 opacity-70 hover:opacity-100" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[600px] px-4">
              <div className="space-y-6 py-4">
                {localMessages.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No chat history yet. Start a conversation!
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {localMessages.map((message: Message) => (
                      <ChatBubble 
                        key={message.id}
                        message={message}
                        isLoading={isLoading && message === localMessages[localMessages.length - 1]}
                        onQuote={handleQuote}
                        onReactionChange={handleReactionChange}
                      />
                    ))}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          <div className="border-t p-4">
            <div className="mx-auto max-w-[600px]">
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleFormSubmit}
                isLoading={isLoading}
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
                imagePreview={imagePreview}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your entire chat history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportHistory}
        className="hidden"
        aria-label="Import chat history"
      />

      <ExportOptionsDialog
        isOpen={isExportOptionsOpen}
        onClose={() => setIsExportOptionsOpen(false)}
        onExport={handleExportWithOptions}
        messageCount={localMessages.length}
        heartedCount={localMessages.filter(m => messageReactions[m.id]?.heart).length}
        thumbsDownCount={localMessages.filter(m => messageReactions[m.id]?.thumbsDown).length}
      />
    </>
  )
} 

