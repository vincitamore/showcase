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
  MessageActions,
  MessageReactions,
  markdownComponents,
} from "@/components/chat"
import ReactMarkdown, { type Components } from "react-markdown"
import { MODEL_CONFIGS } from "@/lib/chat-config"
import { ErrorBoundary } from "@/components/error-boundary"

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
        if (!reader.result || typeof reader.result !== 'string') {
          reject(new Error('Invalid file data'));
          return;
        }
        const parts = reader.result.split(',');
        if (parts.length !== 2 || !parts[1]) {
          reject(new Error('Invalid base64 data format'));
          return;
        }
        resolve({
          data: parts[1],
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
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      
      // Use a higher quality (0.92) for better image quality
      const jpegData = canvas.toDataURL('image/jpeg', 0.92)
      const parts = jpegData.split(',')
      if (parts.length !== 2 || !parts[1]) {
        reject(new Error('Invalid converted image data'))
        return
      }
      
      // Log the converted size
      console.log('[Chat Client] Converted image:', {
        originalSize: file.size,
        convertedSize: Math.round(parts[1].length * 0.75), // base64 is ~4/3 the size of binary
        width: img.width,
        height: img.height,
        originalType: file.type,
        newType: 'image/jpeg'
      })

      resolve({
        data: parts[1],
        mimeType: 'image/jpeg'
      })
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for conversion'))
    }

    img.src = URL.createObjectURL(file)
  })
}

// Rename the base component to BaseAnimatedChatInput
function BaseAnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isAlertOpen, setIsAlertOpen] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<ModelValue>("grok-2-latest")
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
      // Create the new message
      const textMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input,
        createdAt: new Date(),
        model: selectedModel
      }

      // Get ONLY the messages for the current model
      const modelMessages = localMessages
        .filter(msg => msg.model === selectedModel)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))

      // Add the new message to the filtered list
      const updatedModelMessages = [
        ...modelMessages,
        {
          role: textMessage.role,
          content: textMessage.content
        }
      ]

      console.log('Sending request with messages:', {
        selectedModel,
        messageCount: updatedModelMessages.length,
        messages: updatedModelMessages
      })

      // Add to local state (with all message properties)
      setLocalMessages(prev => [...prev, textMessage])

      // Clear input immediately after sending
      setInput?.('')

      // Send message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages: updatedModelMessages,
          model: selectedModel,
          data: {
            text: input,
            stream: true
          }
        }),
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
    setMessageReactions(prev => {
      const updated = {
        ...prev,
        [messageId]: {
          ...prev[messageId] || { heart: false, thumbsDown: false },
          [type]: active
        }
      }
      // Save reactions to localStorage
      localStorage.setItem('messageReactions', JSON.stringify(updated))
      return updated
    })
  }

  // Load saved reactions on mount
  React.useEffect(() => {
    const savedReactions = localStorage.getItem('messageReactions')
    if (savedReactions) {
      try {
        setMessageReactions(JSON.parse(savedReactions))
      } catch (error) {
        console.error('Failed to parse saved reactions:', error)
      }
    }
  }, [])

  // Clean up reactions for deleted messages when messages change
  React.useEffect(() => {
    if (Object.keys(messageReactions).length > 0) {
      const existingMessageIds = new Set(localMessages.map(m => m.id))
      const updatedReactions = { ...messageReactions }
      let hasChanges = false

      Object.keys(messageReactions).forEach(messageId => {
        if (!existingMessageIds.has(messageId)) {
          delete updatedReactions[messageId]
          hasChanges = true
        }
      })

      if (hasChanges) {
        setMessageReactions(updatedReactions)
        localStorage.setItem('messageReactions', JSON.stringify(updatedReactions))
      }
    }
  }, [localMessages, messageReactions])

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

  // Update modelCounts when messages or reactions change
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
      } else {
        // Initialize counts for models with no messages yet
        counts[modelId] = { total: 0, hearted: 0, thumbsDown: 0 }
      }
    })
    setModelCounts(counts)
  }, [messageReactions, localMessages]) // Add localMessages as a dependency

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
            sm:max-w-2xl overflow-hidden
            h-[95dvh] sm:h-[80vh]
            w-[95vw] sm:w-full
            fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]
            bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90
            rounded-2xl
            border border-border/40"
          style={{ isolation: 'isolate' }}
        >
          <div className="flex flex-col border-b bg-background/99 backdrop-blur supports-[backdrop-filter]:bg-background/90 rounded-t-2xl">
            <div className="flex items-center justify-between relative px-3 py-2 sm:px-4 sm:py-3">
              <DialogTitle className="text-base font-semibold">Chat History</DialogTitle>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 hover:bg-accent"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
            <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5 sm:px-4 sm:py-2">
              <div className="flex-1 min-w-0">
                <ModelSwitcher 
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  variant="compact"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="sr-only">Import chat history</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportClick}
                  disabled={localMessages.length === 0}
                  className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only">Export chat history</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAlertOpen(true)}
                  disabled={localMessages.length === 0}
                  className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear history</span>
                </Button>
              </div>
            </div>
          </div>
          
          <div 
            className="flex-1 overflow-y-auto" 
            style={{ 
              position: 'relative', 
              zIndex: 40, 
              WebkitOverflowScrolling: 'touch' // Add touch scrolling for mobile
            }}
          >
            <div className="mx-auto max-w-[600px] px-3 py-3 sm:px-8 sm:py-4 w-full overflow-visible">
              <div className="space-y-3 sm:space-y-4 w-full overflow-visible pt-6">
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
                        messageReactions={messageReactions}
                      />
                    ))}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          <div className="border-t p-3 sm:p-4">
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

function AnimatedChatInput() {
  return (
    <ErrorBoundary
      onReset={() => {
        // Clear any stored state that might be causing issues
        localStorage.removeItem('selectedModel')
        Object.keys(MODEL_CONFIGS).forEach(modelId => {
          localStorage.removeItem(`chatHistory-${modelId}`)
        })
        localStorage.removeItem('messageReactions')
        window.location.reload()
      }}
    >
      <BaseAnimatedChatInput />
    </ErrorBoundary>
  )
}

// Export the component
export default AnimatedChatInput 

