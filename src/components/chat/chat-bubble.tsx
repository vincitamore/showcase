import * as React from "react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import type { Message, TextContent, ImageUrlContent } from "@/types/chat"
import { motion } from "framer-motion"
import {
  MessageReactions,
  MessageActions,
  TypingIndicator,
  QuoteModal,
  markdownComponents
} from "."

interface ChatBubbleProps {
  message: Message
  isLoading?: boolean
  onQuote: (content: string) => void
  onReactionChange: (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => void
  messageReactions: Record<string, { heart: boolean, thumbsDown: boolean }>
}

export function ChatBubble({ 
  message,
  isLoading,
  onQuote,
  onReactionChange,
  messageReactions
}: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant'
  const [isQuoteModalOpen, setIsQuoteModalOpen] = React.useState(false)

  const handleQuote = (content: string) => {
    setIsQuoteModalOpen(false)
    onQuote(content)
  }

  const messageContent = Array.isArray(message.content) 
    ? message.content.map(c => {
        if (c.type === 'text') {
          // Trim whitespace and normalize newlines, then fix punctuation spacing
          return (c as TextContent).text
            .trim()
            .replace(/\n+/g, '\n')
            .replace(/\s+([.,!?])/g, '$1') // Remove spaces before punctuation
        }
        if (c.type === 'image_url') {
          return `![Image](${(c as ImageUrlContent).image_url.url})`
        }
        return ''
      }).join('\n').trim()
    : message.content.trim().replace(/\s+([.,!?])/g, '$1')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "group relative flex gap-3 px-4 py-4",
        isAssistant ? "flex-row" : "flex-row-reverse"
      )}
      style={{ isolation: 'isolate' }}
    >
      <div className={cn(
        "flex min-h-[32px] flex-1 flex-col",
        isAssistant ? "items-start" : "items-end"
      )}>
        <div className="relative flex items-start gap-2">
          <div className="flex items-start pt-2 absolute -left-10">
            <MessageActions 
              message={message} 
              isUser={!isAssistant}
              onQuote={() => setIsQuoteModalOpen(true)}
            />
          </div>
          <div className={cn(
            "relative group space-y-2 rounded-lg px-4 py-3",
            isAssistant 
              ? "bg-muted text-foreground" 
              : "bg-primary text-primary-foreground",
            isAssistant ? "rounded-tl-none" : "rounded-tr-none"
          )}>
            <ReactMarkdown components={markdownComponents}>
              {messageContent}
            </ReactMarkdown>
            {isLoading && (
              <div className="mt-2">
                <TypingIndicator />
              </div>
            )}
            <div className="absolute -bottom-7 left-0">
              <MessageReactions 
                isAssistant={isAssistant}
                messageId={message.id}
                onReactionChange={onReactionChange}
                messageReactions={messageReactions}
              />
            </div>
          </div>
        </div>
      </div>
      <QuoteModal
        content={messageContent}
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        onQuote={handleQuote}
      />
    </motion.div>
  )
} 