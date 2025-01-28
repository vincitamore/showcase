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
  const currentMessageReactions = messageReactions[messageId] || { heart: false, thumbsDown: false }

  const [reactions, setReactions] = React.useState<MessageReaction[]>([
    { 
      emoji: (active: boolean) => active ? 
        <Heart className="h-3 w-3 fill-red-500 text-red-500" /> : 
        <Heart className="h-3 w-3" />,
      count: currentMessageReactions.heart ? 1 : 0,
      active: currentMessageReactions.heart,
      type: 'heart' as const
    },
    { 
      emoji: (active: boolean) => active ? 
        <ThumbsDown className="h-3 w-3 fill-foreground text-foreground" /> : 
        <ThumbsDown className="h-3 w-3" />,
      count: currentMessageReactions.thumbsDown ? 1 : 0,
      active: currentMessageReactions.thumbsDown,
      type: 'thumbsDown' as const
    },
  ])

  // Update reactions when the global state changes
  React.useEffect(() => {
    const currentReactions = messageReactions[messageId] || { heart: false, thumbsDown: false }
    setReactions(prev => prev.map(reaction => ({
      ...reaction,
      count: currentReactions[reaction.type] ? 1 : 0,
      active: currentReactions[reaction.type]
    })))
  }, [messageId, messageReactions])

  const handleReaction = (index: number) => {
    setReactions(prev => prev.map((reaction, i) => {
      if (i === index) {
        const newActive = !reaction.active;
        onReactionChange(messageId, reaction.type, newActive);
        return {
          ...reaction,
          count: newActive ? 1 : 0,
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