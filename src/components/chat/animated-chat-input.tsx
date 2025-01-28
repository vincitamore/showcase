"use client"

import * as React from "react"
import { useChat } from "ai/react"
import type { Message as AIMessage } from 'ai'
import type { Message, MessageContent, TextContent, ImageUrlContent } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import type { ModelValue } from "@/components/model-selector"
import { X } from "lucide-react"

export function AnimatedChatInput() {
  const [mounted, setMounted] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isAlertOpen, setIsAlertOpen] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<ModelValue>("grok-2-latest")
  // ... rest of the state variables ...

  return (
    <>
      <Dialog modal={false} open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="flex flex-col gap-0 p-0 data-[state=open]:duration-200
            sm:max-w-2xl overflow-hidden
            h-[95dvh] sm:h-[80vh]
            w-[95vw] sm:w-full
            fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]
            bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/90
            rounded-2xl
            border border-border/40"
        >
          <div className="flex flex-col border-b bg-background/99 backdrop-blur supports-[backdrop-filter]:bg-background/90 rounded-t-2xl">
            <div className="flex items-center justify-between relative px-3 py-2 sm:px-4 sm:py-3">
              <DialogTitle className="text-base font-semibold">Chat History</DialogTitle>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 hover:bg-accent"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
            {/* ... rest of the dialog content ... */}
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* ... message content ... */}
          </div>
          <div className="border-t p-3 sm:p-4 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/90 rounded-b-2xl">
            {/* ... input area ... */}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 