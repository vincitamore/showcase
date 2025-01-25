"use client"

import * as React from "react"
import { useChat } from "ai/react"
import type { Message as AIMessage } from 'ai'
import type { Message, MessageContent, TextContent } from "@/types/chat"
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
  isAssistant,
  onQuote 
}: { 
  message: Message
  isAssistant: boolean
  onQuote: (content: string) => void
}) {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = React.useState(false)
  
  const getMessageText = (content: string | MessageContent[]): string => {
    if (typeof content === 'string') return content
    return content
      .filter(item => item.type === 'text')
      .map(item => (item as TextContent).text)
      .join('\n')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getMessageText(message.content))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity",
              isAssistant ? "ml-auto" : "mr-auto"
            )}
          >
            <MoreVertical className="h-3 w-3" />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isAssistant ? "end" : "start"} className="w-[160px]">
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy message
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsQuoteModalOpen(true)}>
            <Quote className="mr-2 h-3.5 w-3.5" />
            Quote message
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <QuoteModal
        content={getMessageText(message.content)}
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        onQuote={onQuote}
      />
    </>
  )
}

function ChatBubble({ 
  message, 
  isLoading,
  onQuote,
  onReactionChange
}: { 
  message: Message
  isLoading?: boolean
  onQuote: (content: string) => void
  onReactionChange: (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => void
}) {
  const isAssistant = message.role === "assistant"
  
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en', { 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    }).format(date)
  }

  const renderContent = () => {
    if (Array.isArray(message.content)) {
      return (
        <div className="space-y-4">
          {message.content.map((item, index) => {
            if (item.type === 'text') {
              return (
                <div key={index}>
                  {isAssistant ? (
                    <ReactMarkdown components={markdownComponents}>
                      {item.text || " "}
                    </ReactMarkdown>
                  ) : (
                    item.text
                  )}
                </div>
              )
            } else if (item.type === 'image') {
              return (
                <img
                  key={index}
                  src={`data:${item.image.mime_type};base64,${item.image.data}`}
                  alt="Uploaded content"
                  className="rounded-lg max-h-64 w-auto"
                />
              )
            }
            return null
          })}
        </div>
      )
    }

    return isAssistant ? (
      <ReactMarkdown components={markdownComponents}>
        {message.content || " "}
      </ReactMarkdown>
    ) : (
      message.content
    )
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "flex flex-col space-y-2 max-w-[80%]",
          isAssistant ? "items-start" : "items-end"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-muted-foreground">
            {isAssistant ? "AI Assistant" : "You"}
          </div>
          {isLoading && <TypingIndicator />}
        </div>
        <div
          className={cn(
            "group rounded-2xl px-4 py-2 shadow-sm relative",
            isAssistant 
              ? "bg-muted text-foreground rounded-tl-none" 
              : "bg-primary text-primary-foreground rounded-tr-none"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderContent()}
          </div>
          <div className={cn(
            "absolute top-2",
            isAssistant ? "right-2" : "left-2"
          )}>
            <MessageActions 
              message={message} 
              isAssistant={isAssistant}
              onQuote={onQuote}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <MessageReactions 
            isAssistant={isAssistant}
            messageId={message.id}
            onReactionChange={onReactionChange}
          />
          <time className="text-xs text-muted-foreground/60">
            {formatTime(new Date(message.createdAt || Date.now()))}
          </time>
        </div>
      </div>
    </motion.div>
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
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('Image size must be less than 10MB')
        return
      }
      onImageSelect(file)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative rounded-lg border bg-background shadow-glow transition-all duration-300">
        {imagePreview && (
          <div className="p-2 border-b">
            <div className="relative inline-block">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="max-h-32 rounded-lg"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-foreground/10 hover:bg-foreground/20"
                onClick={onImageRemove}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove image</span>
              </Button>
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

function convertToAIMessage(msg: Message): AIMessage {
  if (Array.isArray(msg.content)) {
    // Convert array content to string representation for AI SDK
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content
        .map(item => {
          if (item.type === 'text') return item.text
          if (item.type === 'image') return `[Image: ${item.image.mime_type}]`
          return ''
        })
        .filter(Boolean)
        .join('\n'),
      createdAt: msg.createdAt
    }
  }
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt
  }
}

export function AnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isAlertOpen, setIsAlertOpen] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/chat",
    initialMessages: [],
    id: React.useId(), // Unique chat ID
    onFinish: (message) => {
      // Save to localStorage whenever a message is added
      const updatedMessages = [...messages, message]
      localStorage.setItem('chatHistory', JSON.stringify(updatedMessages))
    }
  })

  // Load chat history from localStorage on mount
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory')
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory)
        setMessages(parsedHistory)
      } catch (error) {
        console.error('Failed to parse chat history:', error)
      }
    }
  }, [setMessages])

  const handleClearHistory = () => {
    setMessages([])
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
  }, [messages])

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

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (selectedImage) {
      console.log('[Chat Client] Starting image upload process')
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          console.log('[Chat Client] Image loaded, converting to base64')
          const base64Image = reader.result as string
          const base64Data = base64Image.split(',')[1]

          const imageMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: [
              { type: 'text', text: input || 'What do you see in this image?' },
              {
                type: 'image',
                image: {
                  data: base64Data,
                  mime_type: selectedImage.type || 'image/jpeg'
                }
              }
            ],
            createdAt: new Date()
          }

          handleImageRemove()
          
          try {
            console.log('[Chat Client] Adding message to chat')
            const aiMessage = convertToAIMessage(imageMessage)
            setMessages(prevMessages => 
              prevMessages.map(msg => convertToAIMessage(msg as Message)).concat(aiMessage)
            )
            
            console.log('[Chat Client] Sending request to API')
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: [...messages, imageMessage].map(msg => ({
                  ...msg,
                  createdAt: undefined
                }))
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
              console.error('[Chat Client] API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData
              })
              throw new Error(`API Error: ${response.status} ${response.statusText}\n${errorData.details || errorData.error || 'Unknown error'}`)
            }

            console.log('[Chat Client] Got response, reading stream')
            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response reader')

            let responseText = ''
            const decoder = new TextDecoder()

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              const chunk = decoder.decode(value)
              console.log('[Chat Client] Received chunk:', chunk)

              // Split chunk into lines and process each SSE event
              const lines = chunk.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6) // Remove 'data: ' prefix
                  if (data === '[DONE]') continue

                  try {
                    const event = JSON.parse(data)
                    if (event.choices?.[0]?.delta?.content) {
                      responseText += event.choices[0].delta.content
                    }
                  } catch (e) {
                    console.warn('[Chat Client] Failed to parse SSE event:', e)
                  }
                }
              }
            }

            console.log('[Chat Client] Creating assistant message')
            const assistantMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: responseText,
              createdAt: new Date()
            }

            console.log('[Chat Client] Updating messages with assistant response')
            const aiAssistantMessage = convertToAIMessage(assistantMessage)
            setMessages(prevMessages => 
              prevMessages.map(msg => convertToAIMessage(msg as Message)).concat(aiAssistantMessage)
            )
            
            localStorage.setItem('chatHistory', JSON.stringify([...messages, imageMessage, assistantMessage]))
          } catch (error) {
            console.error('[Chat Client] Error details:', {
              name: error instanceof Error ? error.name : 'UnknownError',
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              cause: error instanceof Error ? error.cause : undefined
            })
          }
          
          setIsDialogOpen(true)
        } catch (error) {
          console.error('[Chat Client] Error in image processing:', error instanceof Error ? error.message : String(error))
        }
      }
      reader.readAsDataURL(selectedImage)
    } else {
      handleSubmit(e)
    }
  }

  const handleQuote = React.useCallback((content: string) => {
    handleSubmit({
      preventDefault: () => {},
    } as React.FormEvent<HTMLFormElement>)
  }, [handleSubmit])

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
    let filteredMessages = messages
    
    if (!includeAll) {
      if (includeHearted) {
        filteredMessages = messages.filter(m => messageReactions[m.id]?.heart)
      }
    }
    
    if (excludeThumbsDown) {
      filteredMessages = filteredMessages.filter(m => !messageReactions[m.id]?.thumbsDown)
    }

    const exportData = {
      messages: filteredMessages,
      exportDate: new Date().toISOString(),
      metadata: {
        totalMessages: messages.length,
        exportedMessages: filteredMessages.length,
        heartedMessages: messages.filter(m => messageReactions[m.id]?.heart).length,
        thumbsDownMessages: messages.filter(m => messageReactions[m.id]?.thumbsDown).length
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
          setMessages(importedData.messages)
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
                disabled={messages.length === 0}
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
                disabled={messages.length === 0}
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
            {messages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No chat history yet. Start a conversation!
              </div>
            ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((message: Message) => (
                      <ChatBubble 
                  key={message.id}
                        message={message}
                        isLoading={isLoading && message === messages[messages.length - 1]}
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
        messageCount={messages.length}
        heartedCount={messages.filter(m => messageReactions[m.id]?.heart).length}
        thumbsDownCount={messages.filter(m => messageReactions[m.id]?.thumbsDown).length}
      />
    </>
  )
} 

