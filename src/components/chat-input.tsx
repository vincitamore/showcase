"use client"

import * as React from "react"
import { useChat, type Message } from "ai/react"
import { Card3D } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"

// Add CodeProps interface
interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
}

export function ChatInput() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
  })

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsDialogOpen(true)
    handleSubmit(e)
  }

  // Update markdownComponents with proper typing for code
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
    ul: ({ children }) => (
      <ul className="mb-2 list-disc pl-4">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal pl-4">{children}</ol>
    ),
    li: ({ children }) => <li className="mb-1">{children}</li>,
    h3: ({ children }) => (
      <h3 className="mb-2 text-lg font-semibold">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 text-base font-semibold">{children}</h4>
    ),
  }

  return (
    <>
      <Card3D className="mx-auto max-w-2xl p-6">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Textarea
            placeholder="What does my motto mean?"
            value={input}
            onChange={handleInputChange}
            className="min-h-[100px] resize-none"
            disabled={isLoading}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Thinking..." : "Ask"}
            </Button>
          </div>
        </form>
      </Card3D>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <div className="space-y-4 p-4">
            {messages.map((message: Message) => (
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
            ))}
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
