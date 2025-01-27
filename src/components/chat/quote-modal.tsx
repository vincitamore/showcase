import * as React from "react"
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import { markdownComponents } from "./markdown-components"

interface QuoteModalProps {
  content: string
  isOpen: boolean
  onClose: () => void
  onQuote: (content: string) => void
}

export function QuoteModal({ content, isOpen, onClose, onQuote }: QuoteModalProps) {
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