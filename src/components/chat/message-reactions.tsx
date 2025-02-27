import * as React from "react"
import { Heart, ThumbsDown } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MessageReaction {
  emoji: (active: boolean) => React.ReactNode
  count: number
  active: boolean
  type: 'heart' | 'thumbsDown'
}

export interface MessageReactionsProps {
  isAssistant: boolean
  messageId: string
  onReactionChange: (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => void
  messageReactions: Record<string, { heart: boolean, thumbsDown: boolean }>
}

export function MessageReactions({ 
  isAssistant, 
  messageId, 
  onReactionChange,
  messageReactions
}: MessageReactionsProps) {
  // Initialize with empty reactions to avoid setState during render
  const [reactions, setReactions] = React.useState<MessageReaction[]>([
    { 
      emoji: (active: boolean) => active ? 
        <Heart className="h-4 w-4 sm:h-3.5 sm:w-3.5 fill-red-500 text-red-500" /> : 
        <Heart className="h-4 w-4 sm:h-3.5 sm:w-3.5" />,
      count: 0,
      active: false,
      type: 'heart' as const
    },
    { 
      emoji: (active: boolean) => active ? 
        <ThumbsDown className="h-4 w-4 sm:h-3.5 sm:w-3.5 fill-foreground text-foreground" /> : 
        <ThumbsDown className="h-4 w-4 sm:h-3.5 sm:w-3.5" />,
      count: 0,
      active: false,
      type: 'thumbsDown' as const
    },
  ])

  // Initialize reactions from props on mount and when props change
  React.useEffect(() => {
    const currentReactions = messageReactions[messageId] || { heart: false, thumbsDown: false }
    setReactions(prev => prev.map(reaction => ({
      ...reaction,
      count: currentReactions[reaction.type] ? 1 : 0,
      active: currentReactions[reaction.type]
    })))
  }, [messageId, messageReactions])

  const handleReaction = (index: number) => {
    setReactions(prev => {
      const updatedReactions = prev.map((reaction, i) => {
        if (i === index) {
          const newActive = !reaction.active;
          // Move the side effect outside of render
          setTimeout(() => {
            onReactionChange(messageId, reaction.type, newActive);
          }, 0);
          return {
            ...reaction,
            count: newActive ? 1 : 0,
            active: newActive
          }
        }
        return reaction
      });
      return updatedReactions;
    })
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex gap-1.5",
        "-mt-1",
        isAssistant ? "justify-start" : "justify-end",
        "touch-none select-none",
        "bg-background/95 backdrop-blur-sm py-1 px-2 rounded-full shadow-md",
        "border border-border/10",
        "will-change-transform"
      )}
    >
      {reactions.map((reaction, index) => (
        <Button
          key={index}
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 sm:h-7 sm:w-7 rounded-full p-0",
            "hover:bg-primary/10 active:scale-95",
            !reaction.active && "text-muted-foreground/60 hover:text-muted-foreground",
            "transition-all duration-200"
          )}
          onClick={() => handleReaction(index)}
        >
          <motion.div
            whileTap={{ scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            {reaction.emoji(reaction.active)}
            {reaction.count > 0 && (
              <span className={cn(
                "text-sm font-medium",
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