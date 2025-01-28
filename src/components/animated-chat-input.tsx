"use client"

import * as React from "react"
import { useChat } from "ai/react"
import type { Message as AIMessage } from 'ai'
import type { Message, MessageContent, TextContent, ImageUrlContent } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Send, Loader2, History, Image as ImageIcon, X, Upload, Download, Trash2, MoreVertical, Copy, Quote, Heart, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useTypewriter, Cursor } from 'react-simple-typewriter'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { convertToAIMessage, convertFromAIMessage } from "@/types/chat"
import { ModelSelector, type ModelValue } from "@/components/model-selector"
import { ModelSwitcher } from "@/components/model-switcher"
import {
  ChatBubble,
  ChatInput,
  ExportOptionsDialog,
} from "@/components/chat"
import ReactMarkdown, { type Components } from "react-markdown"
import { MODEL_CONFIGS } from "@/lib/chat-config"

interface CodeComponentProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

interface MessageReaction {
  emoji: (active: boolean) => React.ReactNode
  count: number
  active: boolean
  type: 'heart' | 'thumbsDown'
}

interface MarkdownComponentProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

interface MarkdownImageProps {
  src?: string
  alt?: string
}

const markdownComponents: Components = {
  p: ({ children, ...props }) => {
    if (typeof children === 'string') {
      return (
        <>
          {children.split('\n').map((line, i) => (
            <p key={i} className="mb-2 last:mb-0" {...props}>{line}</p>
          ))}
        </>
      )
    }
    return <p className="mb-2 last:mb-0" {...props}>{children}</p>
  },
  code: ({ className, children, inline, ...props }: CodeComponentProps) => (
    <code
      className={cn(
        "rounded bg-primary/10 px-1 py-0.5 font-mono text-sm",
        inline ? "inline" : "block p-2",
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2 list-disc pl-4 last:mb-0" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-2 list-decimal pl-4 last:mb-0" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="mb-1 last:mb-0" {...props}>{children}</li>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 text-lg font-semibold last:mb-0" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-2 text-base font-semibold last:mb-0" {...props}>{children}</h4>
  ),
  img: ({ src, alt, ...props }: MarkdownImageProps) => (
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
        {...props}
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
    <div className="absolute -left-14 top-0 h-full flex items-start pt-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-6 w-6 rounded-full p-0 hover:bg-primary/10 hover:text-primary transition-colors",
              "opacity-0 group-hover:opacity-100 focus:opacity-100"
            )}
          >
            <MoreVertical className="h-3.5 w-3.5" />
            <span className="sr-only">Message actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start"
          className="w-[120px] p-1"
        >
          <DropdownMenuItem 
            onClick={handleCopy}
            className="flex items-center gap-2 text-xs py-1.5 px-2 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => onQuote(Array.isArray(message.content) 
              ? message.content.filter(c => c.type === 'text').map(c => (c as TextContent).text).join('\n')
              : message.content)}
            className="flex items-center gap-2 text-xs py-1.5 px-2 cursor-pointer"
          >
            <Quote className="h-3.5 w-3.5" />
            Quote
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

async function convertToJpeg(file: File) {
  console.log('[Chat Client] Converting image:', {
    originalSize: file.size,
    type: file.type,
    name: file.name
  })

  // Check if already a JPEG/JPG
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    console.log('[Chat Client] File is already JPEG, reading directly')
    return new Promise<{ data: string, mimeType: string }>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1]
        resolve({
          data: base64Data,
          mimeType: 'image/jpeg'
        })
      }
      reader.onerror = () => reject(new Error('Failed to read JPEG file'))
      reader.readAsDataURL(file)
    })
  }

  // For non-JPEG images, convert to JPEG
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
        height: img.height,
        originalType: file.type,
        newType: 'image/jpeg'
      })

      resolve({
        data: base64Data,
        mimeType: 'image/jpeg'
      })
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for conversion'))
    }

    reader.readAsDataURL(file)
  })
}

export function AnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isAlertOpen, setIsAlertOpen] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<ModelValue>("grok-2-vision-1212")
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
      model: selectedModel
    },
    key: selectedModel,
    initialMessages: [],
    id: React.useId(),
    onFinish: (message) => {
      // Don't update messages here, we'll handle it in the stream
    }
  })

  // Update model selection handler
  const handleModelChange = React.useCallback((newModel: ModelValue) => {
    // Update model selection
    setSelectedModel(newModel)
    
    // Save to localStorage
    localStorage.setItem('selectedModel', newModel)
  }, [])

  // Load saved model selection and chat history on mount
  React.useEffect((): void => {
    const savedModel = localStorage.getItem('selectedModel')
    if (savedModel && Object.keys(MODEL_CONFIGS).includes(savedModel)) {
      setSelectedModel(savedModel as ModelValue)
    }

    // Load all chat history
    const allMessages: Message[] = []
    Object.keys(MODEL_CONFIGS).forEach(modelId => {
      const modelHistory = localStorage.getItem(`chatHistory-${modelId}`)
      if (modelHistory) {
        try {
          const parsedHistory = JSON.parse(modelHistory)
          allMessages.push(...parsedHistory)
        } catch (error) {
          console.error(`Failed to parse chat history for model ${modelId}:`, error)
        }
      }
    })

    // Sort messages by creation time
    allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    setLocalMessages(allMessages)
  }, [])

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

        const { url: rawImageUrl } = await uploadResponse.json()

        // Create message with image content
        const imageMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: rawImageUrl,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: input || 'What is in this image?'
            }
          ],
          createdAt: new Date(),
          model: selectedModel
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
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
              messages: updatedMessages.map(msg => ({
                role: msg.role,
                content: Array.isArray(msg.content)
                  ? msg.content.map(c => {
                      if (c.type === 'text') {
                        return { type: 'text', text: c.text }
                      }
                      if (c.type === 'image_url') {
                        return {
                          type: 'image',
                          source: {
                            type: 'url',
                            url: c.image_url.url,
                            media_type: 'image/jpeg'
                          }
                        }
                      }
                      return null
                    }).filter(Boolean)
                  : String(msg.content)
              })),
              model: selectedModel,
              data: {
                text: input,
                stream: true
              }
            }),
            // Add signal for streaming
            signal: AbortSignal.timeout(30000)
          })

          if (!response.ok || !response.body) {
            console.error('[Chat Client] API response not ok:', {
              status: response.status,
              statusText: response.statusText,
              hasBody: !!response.body
            })
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Process the streaming response
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          console.log('[Chat Client] Stream reader created:', !!reader)
          console.log('[Chat Client] Decoder created')

          if (!reader) {
            throw new Error('No reader available')
          }

          console.log('[Chat Client] Starting stream processing')
          let responseText = ''
          let chunkCount = 0
          let lineCount = 0
          let textDeltaCount = 0

          // Create assistant message placeholder
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: [{
              type: 'text' as const,
              text: ''
            }] as MessageContent[],
            createdAt: new Date(),
            model: selectedModel
          }
          console.log('[Chat Client] Created assistant message:', {
            id: assistantMessage.id,
            role: assistantMessage.role,
            contentLength: (assistantMessage.content[0] as TextContent).text.length
          })

          // Add assistant message to messages
          setLocalMessages(prevMessages => [...prevMessages, assistantMessage])

          console.log('[Chat Client] Entering stream processing loop')
          while (true) {
            const { done, value } = await reader.read()
            chunkCount++
            
            if (done) {
              console.log('[Chat Client] Stream complete:', {
                totalChunks: chunkCount,
                totalLines: lineCount,
                totalTextDeltas: textDeltaCount,
                finalResponseLength: responseText.length
              })
              break
            }

            const chunk = decoder.decode(value)
            console.log('[Chat Client] Decoded chunk:', {
              chunk,
              length: chunk.length,
              lines: chunk.split('\n').filter(Boolean)
            })

            // Split chunk into lines and process each line
            const lines = chunk.split('\n').filter(Boolean)
            for (const line of lines) {
              lineCount++
              
              // Handle text content (0:)
              if (line.startsWith('0:')) {
                try {
                  // Extract the text content, removing the prefix
                  const text = line.slice(2)
                  
                  // Unescape the JSON string properly
                  const deltaText = JSON.parse(text)
                  textDeltaCount++
                  
                  // Only add space if we're not dealing with markdown markers or split words
                  const shouldAddSpace = responseText && 
                    !responseText.endsWith(' ') && 
                    !deltaText.startsWith(' ') &&
                    !responseText.endsWith('*') && 
                    !deltaText.startsWith('*') &&
                    // Check if we're in the middle of a word (last char of previous + first of current are letters)
                    !(responseText.match(/[a-zA-Z]$/) && deltaText.match(/^[a-zA-Z]/))
                  
                  if (shouldAddSpace) {
                    responseText += ' '
                  }
                  responseText += deltaText
                  
                  // Update assistant message content with properly parsed markdown
                  setLocalMessages(prevMessages => 
                    prevMessages.map(msg => 
                      msg.id === assistantMessage.id 
                        ? {
                            ...msg,
                            content: [{
                              type: 'text' as const,
                              text: responseText
                            }]
                          }
                        : msg
                    )
                  )
                  
                  console.log('[Chat Client] Text delta processed:', {
                    deltaText,
                    totalLength: responseText.length,
                    shouldAddSpace
                  })
                } catch (error) {
                  console.error('[Chat Client] Error processing text chunk:', error)
                }
              }
              
              // Handle end message (e:)
              if (line.startsWith('e:')) {
                try {
                  const data = JSON.parse(line.slice(2))
                  console.log('[Chat Client] End message:', data)
                } catch (error) {
                  console.error('[Chat Client] Error parsing end message:', error)
                }
              }
              
              // Handle done message (d:)
              if (line.startsWith('d:')) {
                try {
                  const data = JSON.parse(line.slice(2))
                  console.log('[Chat Client] Done message:', data)
                } catch (error) {
                  console.error('[Chat Client] Error parsing done message:', error)
                }
              }
            }
          }

          // Save final state
          console.log('[Chat Client] Stream finished, saving final state')
          setLocalMessages(prevMessages => {
            const finalMessages = prevMessages.map(msg =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content: [{
                      type: 'text' as const,
                      text: responseText
                    }]
                  }
                : msg
            )
            localStorage.setItem('chatHistory', JSON.stringify(finalMessages))
            return finalMessages
          })

          // Format messages for API request
          const formattedMessages = updatedMessages.map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            content: Array.isArray(msg.content)
              ? msg.content.map(c => {
                  if (c.type === 'text') {
                    return c.text
                  }
                  if (c.type === 'image_url') {
                    return `[Image: ${c.image_url.url}]`
                  }
                  return null
                }).filter(Boolean).join('\n')
              : msg.content
          }))

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
          createdAt: new Date(),
          model: selectedModel
        }

        // Add user message to local state
        const updatedMessages = [...localMessages, textMessage]
        setLocalMessages(updatedMessages)

        try {
          // Send message with proper formatting for each provider
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
              messages: updatedMessages.map(msg => ({
                role: msg.role,
                content: Array.isArray(msg.content)
                  ? msg.content.map(c => {
                      if (c.type === 'text') {
                        return { type: 'text', text: c.text }
                      }
                      if (c.type === 'image_url') {
                        return {
                          type: 'image',
                          source: {
                            type: 'url',
                            url: c.image_url.url,
                            media_type: 'image/jpeg'
                          }
                        }
                      }
                      return null
                    }).filter(Boolean)
                  : String(msg.content)
              })),
              model: selectedModel,
              data: {
                text: input,
                stream: true
              }
            }),
            // Add signal for streaming
            signal: AbortSignal.timeout(30000)
          })

          if (!response.ok || !response.body) {
            console.error('[Chat Client] API response not ok:', {
              status: response.status,
              statusText: response.statusText,
              hasBody: !!response.body
            })
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Process the streaming response
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          console.log('[Chat Client] Stream reader created:', !!reader)
          console.log('[Chat Client] Decoder created')

          if (!reader) {
            throw new Error('No reader available')
          }

          console.log('[Chat Client] Starting stream processing')
          let responseText = ''
          let chunkCount = 0
          let lineCount = 0
          let textDeltaCount = 0

          // Create assistant message placeholder
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: [{
              type: 'text' as const,
              text: ''
            }] as MessageContent[],
            createdAt: new Date(),
            model: selectedModel
          }
          console.log('[Chat Client] Created assistant message:', {
            id: assistantMessage.id,
            role: assistantMessage.role,
            contentLength: (assistantMessage.content[0] as TextContent).text.length
          })

          // Add assistant message to messages
          setLocalMessages(prevMessages => [...prevMessages, assistantMessage])

          console.log('[Chat Client] Entering stream processing loop')
          while (true) {
            const { done, value } = await reader.read()
            chunkCount++
            
            if (done) {
              console.log('[Chat Client] Stream complete:', {
                totalChunks: chunkCount,
                totalLines: lineCount,
                totalTextDeltas: textDeltaCount,
                finalResponseLength: responseText.length
              })
              break
            }

            const chunk = decoder.decode(value)
            console.log('[Chat Client] Decoded chunk:', {
              chunk,
              length: chunk.length,
              lines: chunk.split('\n').filter(Boolean)
            })

            // Split chunk into lines and process each line
            const lines = chunk.split('\n').filter(Boolean)
            for (const line of lines) {
              lineCount++
              
              // Handle text content (0:)
              if (line.startsWith('0:')) {
                try {
                  // Extract the text content, removing the prefix
                  const text = line.slice(2)
                  
                  // Unescape the JSON string properly
                  const deltaText = JSON.parse(text)
                  textDeltaCount++
                  
                  // Only add space if we're not dealing with markdown markers or split words
                  const shouldAddSpace = responseText && 
                    !responseText.endsWith(' ') && 
                    !deltaText.startsWith(' ') &&
                    !responseText.endsWith('*') && 
                    !deltaText.startsWith('*') &&
                    // Check if we're in the middle of a word (last char of previous + first of current are letters)
                    !(responseText.match(/[a-zA-Z]$/) && deltaText.match(/^[a-zA-Z]/))
                  
                  if (shouldAddSpace) {
                    responseText += ' '
                  }
                  responseText += deltaText
                  
                  // Update assistant message content with properly parsed markdown
                  setLocalMessages(prevMessages => 
                    prevMessages.map(msg => 
                      msg.id === assistantMessage.id 
                        ? {
                            ...msg,
                            content: [{
                              type: 'text' as const,
                              text: responseText
                            }]
                          }
                        : msg
                    )
                  )
                  
                  console.log('[Chat Client] Text delta processed:', {
                    deltaText,
                    totalLength: responseText.length,
                    shouldAddSpace
                  })
                } catch (error) {
                  console.error('[Chat Client] Error processing text chunk:', error)
                }
              }
              
              // Handle end message (e:)
              if (line.startsWith('e:')) {
                try {
                  const data = JSON.parse(line.slice(2))
                  console.log('[Chat Client] End message:', data)
                } catch (error) {
                  console.error('[Chat Client] Error parsing end message:', error)
                }
              }
              
              // Handle done message (d:)
              if (line.startsWith('d:')) {
                try {
                  const data = JSON.parse(line.slice(2))
                  console.log('[Chat Client] Done message:', data)
                } catch (error) {
                  console.error('[Chat Client] Error parsing done message:', error)
                }
              }
            }
          }

          // Save final state
          console.log('[Chat Client] Stream finished, saving final state')
          setLocalMessages(prevMessages => {
            const finalMessages = prevMessages.map(msg =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content: [{
                      type: 'text' as const,
                      text: responseText
                    }]
                  }
                : msg
            )
            localStorage.setItem('chatHistory', JSON.stringify(finalMessages))
            return finalMessages
          })

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

  // Update localStorage handling
  const storageKey = `chatHistory-${selectedModel}`

  // Save messages to localStorage whenever they change
  React.useEffect(() => {
    if (localMessages.length > 0) {
      // Group messages by model
      const messagesByModel: Record<string, Message[]> = {}
      localMessages.forEach(msg => {
        const model = msg.model || selectedModel // Fallback to selectedModel if not set
        messagesByModel[model] = messagesByModel[model] || []
        messagesByModel[model].push(msg)
      })

      // Save each model's messages separately
      Object.entries(messagesByModel).forEach(([model, messages]) => {
        localStorage.setItem(`chatHistory-${model}`, JSON.stringify(messages))
      })
    }
  }, [localMessages, selectedModel])

  const handleClearHistory = () => {
    // Clear all model histories
    Object.keys(MODEL_CONFIGS).forEach(modelId => {
      localStorage.removeItem(`chatHistory-${modelId}`)
    })
    setLocalMessages([])
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

  const handleExportClick = () => {
    const modelCounts: Record<string, { total: number, hearted: number, thumbsDown: number }> = {}
    
    // Get counts for all models
    Object.keys(MODEL_CONFIGS).forEach(modelId => {
      const modelHistory = localStorage.getItem(`chatHistory-${modelId}`)
      if (modelHistory) {
        try {
          const messages = JSON.parse(modelHistory)
          modelCounts[modelId] = {
            total: messages.length,
            hearted: messages.filter((m: Message) => messageReactions[m.id]?.heart).length,
            thumbsDown: messages.filter((m: Message) => messageReactions[m.id]?.thumbsDown).length
          }
        } catch (error) {
          console.error(`Failed to parse history for model ${modelId}:`, error)
        }
      }
    })
    
    setIsExportOptionsOpen(true)
  }

  const handleExportWithOptions = ({ 
    includeAll, 
    includeHearted, 
    excludeThumbsDown,
    selectedModels 
  }: { 
    includeAll: boolean
    includeHearted: boolean
    excludeThumbsDown: boolean
    selectedModels: string[]
  }) => {
    const exportData: Record<string, any> = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      models: {}
    }

    selectedModels.forEach(modelId => {
      const modelHistory = localStorage.getItem(`chatHistory-${modelId}`)
      if (modelHistory) {
        try {
          let messages = JSON.parse(modelHistory)
          
          if (!includeAll) {
            if (includeHearted) {
              try {
                messages = messages.filter((m: Message) => messageReactions[m.id]?.heart)
              } catch (error) {
                console.error('Error filtering hearted messages:', error)
              }
            }
          }
          
          if (excludeThumbsDown) {
            messages = messages.filter((m: Message) => !messageReactions[m.id]?.thumbsDown)
          }

          if (messages.length > 0) {
            exportData.models[modelId] = {
              messages,
              messageCount: messages.length,
              modelConfig: MODEL_CONFIGS[modelId]
            }
          }
        } catch (error) {
          console.error(`Failed to process history for model ${modelId}:`, error)
        }
      }
    })
    
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

  const handleImportHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string)
        let allMessages: Message[] = []
        
        // Handle both old and new format
        if (importedData.version === '2.0') {
          // New format with multiple models
          Object.entries(importedData.models).forEach(([modelId, data]: [string, any]) => {
            if (MODEL_CONFIGS[modelId]) { // Only import if model still exists
              const modelMessages = data.messages
              localStorage.setItem(`chatHistory-${modelId}`, JSON.stringify(modelMessages))
              allMessages = [...allMessages, ...modelMessages]
            }
          })
        } else {
          // Old format - import as current model only
          if (Array.isArray(importedData.messages)) {
            localStorage.setItem(storageKey, JSON.stringify(importedData.messages))
            allMessages = importedData.messages
          }
        }

        // Update local messages with all imported messages
        setLocalMessages(allMessages)

        // Update model counts
        const counts: Record<string, { total: number, hearted: number, thumbsDown: number }> = {}
        Object.keys(MODEL_CONFIGS).forEach(modelId => {
          const modelMessages = allMessages.filter(msg => msg.model === modelId)
          counts[modelId] = {
            total: modelMessages.length,
            hearted: modelMessages.filter(m => messageReactions[m.id]?.heart).length,
            thumbsDown: modelMessages.filter(m => messageReactions[m.id]?.thumbsDown).length
          }
        })
        setModelCounts(counts)
      } catch (error) {
        console.error('Failed to import chat history:', error)
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  // Add modelCounts declaration before ExportOptionsDialog
  const [modelCounts, setModelCounts] = React.useState<Record<string, { total: number, hearted: number, thumbsDown: number }>>({})

  React.useEffect(() => {
    const counts: Record<string, { total: number, hearted: number, thumbsDown: number }> = {}
    Object.keys(MODEL_CONFIGS).forEach(modelId => {
      const modelHistory = localStorage.getItem(`chatHistory-${modelId}`)
      if (modelHistory) {
        try {
          const messages = JSON.parse(modelHistory)
          counts[modelId] = {
            total: messages.length,
            hearted: messages.filter((m: Message) => messageReactions[m.id]?.heart).length,
            thumbsDown: messages.filter((m: Message) => messageReactions[m.id]?.thumbsDown).length
          }
        } catch (error) {
          console.error(`Failed to parse history for model ${modelId}:`, error)
        }
      }
    })
    setModelCounts(counts)
  }, [messageReactions])

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
            <div className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setIsDialogOpen(true)}
                className="opacity-70 hover:opacity-100"
                disabled={isLoading}
              >
                <History className="h-4 w-4" />
                <span className="sr-only">View chat history</span>
              </Button>
            </div>
          </motion.div>
          <ModelSwitcher 
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            variant="tagline"
          />
        </motion.div>
      </AnimatePresence>

      <Dialog modal={false} open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="flex flex-col gap-0 p-0 data-[state=open]:duration-200
            sm:max-w-2xl sm:rounded-lg overflow-hidden
            h-[100dvh] sm:h-[80vh]
            w-screen sm:w-full
            fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
        >
          <div className="flex flex-col border-b bg-background">
            <div className="flex items-center justify-center relative px-4 py-3">
              <DialogTitle className="text-base font-semibold absolute left-1/2 -translate-x-1/2">Chat History</DialogTitle>
              <div className="flex items-center gap-2 ml-auto">
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 rounded-full p-0 hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogClose>
              </div>
            </div>
            <div className="flex items-center justify-between border-t px-2 sm:px-4 py-2 sm:border-none">
              <ModelSwitcher 
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                variant="header"
              />
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0 hover:bg-accent"
                >
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="sr-only">Import chat history</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportClick}
                  disabled={localMessages.length === 0}
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0 hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="sr-only">Export chat history</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAlertOpen(true)}
                  disabled={localMessages.length === 0}
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0 hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="sr-only">Clear history</span>
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[600px] px-4 py-4">
              <div className="space-y-4">
            {localMessages.filter(msg => msg.model === selectedModel).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No chat history yet. Start a conversation!
              </div>
            ) : (
                  <AnimatePresence initial={false}>
                    {localMessages
                      .filter(msg => msg.model === selectedModel)
                      .map((message: Message) => (
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
        messageCounts={modelCounts}
      />
    </>
  )
} 

