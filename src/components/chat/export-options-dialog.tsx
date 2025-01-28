import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { MODEL_CONFIGS } from "@/lib/chat-config"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

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
      <DialogContent className="sm:max-w-[425px] w-[calc(100%-2rem)] mx-auto">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-base sm:text-lg font-semibold">Export Options</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 hover:bg-accent"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>
        
        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-xs sm:text-sm font-medium leading-none text-foreground/90">Message Filters</h4>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeAll"
                  checked={includeAll}
                  onCheckedChange={(checked: boolean) => {
                    setIncludeAll(checked)
                    if (checked) setIncludeHearted(false)
                  }}
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                />
                <Label 
                  htmlFor="includeAll" 
                  className="text-xs sm:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Export all messages <span className="text-muted-foreground ml-1">({totalMessages})</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeHearted"
                  checked={includeHearted}
                  onCheckedChange={(checked: boolean) => {
                    setIncludeHearted(checked)
                    if (checked) setIncludeAll(false)
                  }}
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                />
                <Label 
                  htmlFor="includeHearted" 
                  className="text-xs sm:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Only export hearted messages <span className="text-muted-foreground ml-1">({totalHearted})</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeThumbsDown"
                  checked={excludeThumbsDown}
                  onCheckedChange={(checked: boolean) => setExcludeThumbsDown(checked)}
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                />
                <Label 
                  htmlFor="excludeThumbsDown" 
                  className="text-xs sm:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Exclude thumbs down messages <span className="text-muted-foreground ml-1">({totalThumbsDown})</span>
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-xs sm:text-sm font-medium leading-none text-foreground/90">Models to Export</h4>
            <div className="space-y-2 sm:space-y-3">
              {Object.entries(MODEL_CONFIGS).map(([modelId, config]) => (
                <div key={modelId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`model-${modelId}`}
                    checked={selectedModels.includes(modelId)}
                    onCheckedChange={(checked: boolean) => {
                      setSelectedModels(prev => 
                        checked
                          ? [...prev, modelId]
                          : prev.filter(id => id !== modelId)
                      )
                    }}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  />
                  <Label 
                    htmlFor={`model-${modelId}`} 
                    className="text-xs sm:text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {config.name} <span className="text-muted-foreground ml-1">({messageCounts[modelId]?.total || 0})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm px-3"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onExport({ includeAll, includeHearted, excludeThumbsDown, selectedModels })
              onClose()
            }}
            disabled={selectedModels.length === 0}
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm px-3"
          >
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 