import * as React from "react"
import { useChat } from "ai/react"
import type { Message, MessageContent, TextContent } from "@/types/chat"
import { ModelSelector, type ModelValue } from "@/components/model-selector"
import { AnimatePresence, motion } from "framer-motion"
import { useTypewriter, Cursor } from 'react-simple-typewriter'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ChatInput } from "@/components/chat"
import { ModelSwitcher } from "@/components/model-switcher"

export function AnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isAlertOpen, setIsAlertOpen] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<ModelValue>("grok-2-latest")
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
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

  const [text] = useTypewriter({
    words: ['How can I help you today?', 'Ask me about my skills...', 'Learn about my experience...', 'Discover my projects...'],
    loop: true,
    delaySpeed: 2000,
  })

  // Update model selection handler
  const handleModelChange = React.useCallback((newModel: ModelValue) => {
    setSelectedModel(newModel)
    localStorage.setItem('selectedModel', newModel)
  }, [])

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsDialogOpen(true)
    
    if (isLoading) return

    try {
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
          signal: AbortSignal.timeout(30000)
        })

        if (!response.ok || !response.body) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`)
        }

        // Process the streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No reader available')
        }

        let responseText = ''
        let chunkCount = 0

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

        // Add assistant message to local state
        setLocalMessages(prev => [...prev, assistantMessage])

        while (true) {
          const { value, done } = await reader.read()
          
          if (done) {
            break
          }

          // Update the message content
          const chunk = decoder.decode(value)
          responseText += chunk
          chunkCount++

          // Update the assistant message with new content
          setLocalMessages(prev => {
            const updated = [...prev]
            const lastMessage = updated[updated.length - 1]
            if (lastMessage && Array.isArray(lastMessage.content)) {
              ;(lastMessage.content[0] as TextContent).text = responseText
            }
            return updated
          })
        }

        setInput('')
      } catch (error) {
        console.error('Failed to send message:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in form submission:', error)
    }
  }

  // ... rest of the component code ...

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.form
          key="chat-input"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onSubmit={handleFormSubmit}
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
            />
          </motion.div>
          <ModelSwitcher 
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            variant="tagline"
          />
        </motion.form>
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="flex h-[80vh] max-h-[80vh] flex-col gap-0 p-0 sm:max-w-2xl"
          style={{ isolation: 'isolate' }}
        >
          {/* ... dialog content ... */}
          <div className="border-t p-4">
            <div className="mx-auto max-w-[600px]">
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleFormSubmit}
                isLoading={isLoading}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ... rest of the JSX ... */}
    </>
  )
} 