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

export function ChatBubble({ 
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
  const isAssistant = message.role === 'assistant'
  const [isQuoteModalOpen, setIsQuoteModalOpen] = React.useState(false)

  const handleQuote = (content: string) => {
    setIsQuoteModalOpen(false)
    onQuote(content)
  }

  const messageContent = Array.isArray(message.content) 
    ? message.content.map(c => {
        if (c.type === 'text') {
          return (c as TextContent).text
        }
        if (c.type === 'image_url') {
          return `![Image](${(c as ImageUrlContent).image_url.url})`
        }
        return ''
      }).join('\n')
    : message.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "group relative flex gap-3 px-4",
        isAssistant ? "flex-row" : "flex-row-reverse"
      )}
    >
      <div className={cn(
        "flex min-h-[32px] flex-1 flex-col space-y-2",
        isAssistant ? "items-start" : "items-end"
      )}>
        <div className={cn(
          "group relative space-y-2 rounded-lg px-3 py-2",
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
          <div className={cn(
            "absolute right-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100",
            isAssistant ? "left-2 right-auto" : "left-auto right-2"
          )}>
            <MessageActions 
              message={message} 
              isUser={!isAssistant}
              onQuote={() => setIsQuoteModalOpen(true)}
            />
          </div>
        </div>
        <MessageReactions 
          isAssistant={isAssistant}
          messageId={message.id}
          onReactionChange={onReactionChange}
        />
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