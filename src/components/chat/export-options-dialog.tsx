import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { MODEL_CONFIGS } from "@/lib/chat-config"
import { X } from "lucide-react"

interface ModelMessageCounts {
  [modelId: string]: {
    total: number
    hearted: number
    thumbsDown: number
  }
}

interface ExportOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (options: { 
    includeAll: boolean
    includeHearted: boolean
    excludeThumbsDown: boolean
    selectedModels: string[]
  }) => void
  messageCounts: ModelMessageCounts
}

export function ExportOptionsDialog({
  isOpen,
  onClose,
  onExport,
  messageCounts
}: ExportOptionsDialogProps) {
  const [includeAll, setIncludeAll] = React.useState(true)
  const [includeHearted, setIncludeHearted] = React.useState(false)
  const [excludeThumbsDown, setExcludeThumbsDown] = React.useState(false)
  const [selectedModels, setSelectedModels] = React.useState<string[]>(
    Object.keys(MODEL_CONFIGS)
  )

  // Calculate totals only from selected models
  const totalMessages = Object.entries(messageCounts)
    .filter(([modelId]) => selectedModels.includes(modelId))
    .reduce((sum, [_, counts]) => sum + counts.total, 0)
    
  const totalHearted = Object.entries(messageCounts)
    .filter(([modelId]) => selectedModels.includes(modelId))
    .reduce((sum, [_, counts]) => sum + counts.hearted, 0)
    
  const totalThumbsDown = Object.entries(messageCounts)
    .filter(([modelId]) => selectedModels.includes(modelId))
    .reduce((sum, [_, counts]) => sum + counts.thumbsDown, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="flex flex-col gap-0 p-0 data-[state=open]:duration-200
          sm:max-w-[425px] sm:rounded-lg overflow-hidden
          h-[100dvh] sm:h-auto
          w-screen sm:w-full
          fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
      >
        <div className="flex items-center justify-between border-b bg-background px-4 py-3 sm:border-none sm:p-0">
          <DialogTitle className="text-base font-semibold">Export Options</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-full p-0 hover:bg-accent"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Message Filters</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="includeAll"
                    checked={includeAll}
                    onChange={(e) => {
                      setIncludeAll(e.target.checked)
                      if (e.target.checked) {
                        setIncludeHearted(false)
                      }
                    }}
                    className="h-5 w-5 rounded border-primary mt-0.5"
                  />
                  <label htmlFor="includeAll" className="text-sm">
                    Export all messages <span className="text-muted-foreground">({totalMessages})</span>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="includeHearted"
                    checked={includeHearted}
                    onChange={(e) => {
                      setIncludeHearted(e.target.checked)
                      if (e.target.checked) {
                        setIncludeAll(false)
                      }
                    }}
                    className="h-5 w-5 rounded border-primary mt-0.5"
                  />
                  <label htmlFor="includeHearted" className="text-sm">
                    Only export hearted messages <span className="text-muted-foreground">({totalHearted})</span>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="excludeThumbsDown"
                    checked={excludeThumbsDown}
                    onChange={(e) => setExcludeThumbsDown(e.target.checked)}
                    className="h-5 w-5 rounded border-primary mt-0.5"
                  />
                  <label htmlFor="excludeThumbsDown" className="text-sm">
                    Exclude thumbs down messages <span className="text-muted-foreground">({totalThumbsDown})</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Models to Export</h4>
              <div className="space-y-3">
                {Object.entries(MODEL_CONFIGS).map(([modelId, config]) => (
                  <div key={modelId} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`model-${modelId}`}
                      checked={selectedModels.includes(modelId)}
                      onChange={(e) => {
                        setSelectedModels(prev => 
                          e.target.checked
                            ? [...prev, modelId]
                            : prev.filter(id => id !== modelId)
                        )
                      }}
                      className="h-5 w-5 rounded border-primary mt-0.5"
                    />
                    <label htmlFor={`model-${modelId}`} className="text-sm">
                      {config.name} <span className="text-muted-foreground">({messageCounts[modelId]?.total || 0})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-4 sm:static sm:border-none sm:bg-transparent sm:p-0 sm:pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onExport({ includeAll, includeHearted, excludeThumbsDown, selectedModels })
                onClose()
              }}
              disabled={selectedModels.length === 0}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 