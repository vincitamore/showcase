import * as React from "react"
import { Heart, ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const initialReactions = [
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
]

interface MessageReaction {
  emoji: (active: boolean) => React.ReactNode
  count: number
  active: boolean
  type: 'heart' | 'thumbsDown'
}

interface MessageReactionsProps {
  isAssistant: boolean
  messageId: string
  onReactionChange: (messageId: string, type: 'heart' | 'thumbsDown', active: boolean) => void
}

export function MessageReactions({ isAssistant, messageId, onReactionChange }: MessageReactionsProps) {
  const [reactions, setReactions] = React.useState<MessageReaction[]>(() => initialReactions)

  const handleReaction = React.useCallback((index: number) => {
    setReactions(prev => prev.map((reaction, i) => {
      if (i === index) {
        const newActive = !reaction.active;
        return {
          ...reaction,
          count: newActive ? reaction.count + 1 : reaction.count - 1,
          active: newActive
        }
      }
      return reaction
    }))
  }, [])

  React.useEffect(() => {
    reactions.forEach((reaction, index) => {
      if (reaction.active) {
        onReactionChange(messageId, reaction.type, reaction.active)
      }
    })
  }, [reactions, messageId, onReactionChange])

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