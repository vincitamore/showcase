"use client"

import * as React from "react"
import { useChat, type Message } from "ai/react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Send, Loader2, History } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import { motion, AnimatePresence } from "framer-motion"
import { useTypewriter, Cursor } from 'react-simple-typewriter'

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
}

function ChatSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto opacity-0" />
  )
}

export function AnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
  })

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const [text] = useTypewriter({
    words: ['How can I help you today?', 'Ask me about my skills...', 'Learn about my experience...', 'Discover my projects...'],
    loop: true,
    delaySpeed: 2000,
  })

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsDialogOpen(true)
    handleSubmit(e)
  }

  const markdownComponents: Components = {
    p: ({ children }) => <p className="mb-2">{children}</p>,
    code: ({ className, children, inline }: CodeProps) => (
      <code
        className={cn(
          "rounded bg-muted px-1 py-0.5 font-mono text-sm",
          inline ? "inline" : "block p-2",
          className
        )}
      >
        {children}
      </code>
    ),
    ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
    li: ({ children }) => <li className="mb-1">{children}</li>,
    h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold">{children}</h3>,
    h4: ({ children }) => <h4 className="mb-2 text-base font-semibold">{children}</h4>,
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
            ease: [0.22, 1, 0.36, 1], // Custom cubic bezier for smooth blooming
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
          
          <motion.form 
            onSubmit={handleFormSubmit} 
            className="relative"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <div className="relative rounded-lg border bg-background shadow-glow transition-all duration-300">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything about my skills, experience, or projects..."
                className="w-full rounded-lg border-0 bg-transparent px-4 py-3 pr-24 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
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
          </motion.form>
        </motion.div>
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <div className="space-y-4 p-4">
            {messages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No chat history yet. Start a conversation!
              </div>
            ) : (
              messages.map((message: Message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col space-y-2 rounded-lg p-4",
                    message.role === "assistant"
                      ? "bg-primary/10"
                      : "bg-muted"
                  )}
                >
                  <div className="text-sm font-medium">
                    {message.role === "assistant" ? "AI Assistant" : "You"}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.role === "assistant" ? (
                      <ReactMarkdown components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 