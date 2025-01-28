import * as React from "react"
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import { markdownComponents } from "./markdown-components"
import { cn } from "@/lib/utils"

interface QuoteModalProps {
  content: string
  isOpen: boolean
  onClose: () => void
  onQuote: (content: string) => void
  className?: string
}

export function QuoteModal({ content, isOpen, onClose, onQuote, className }: QuoteModalProps) {
  const [response, setResponse] = React.useState("")
  
  const handleSubmit = () => {
    const formattedMessage = `> ${content}\n\n${response}`
    onQuote(formattedMessage)
    onClose()
    setResponse("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "sm:max-w-[500px] max-w-[95vw] w-full",
        "p-4 sm:p-6",
        "gap-4",
        className
      )}>
        <DialogTitle className="text-lg">Quote & Reply</DialogTitle>
        <div className="mt-2 space-y-4">
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4">
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
              className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="mt-4 sm:mt-6 flex gap-2 sm:gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!response.trim()}
            className="flex-1 sm:flex-none"
          >
            Send Reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 