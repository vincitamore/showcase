import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { MODEL_CONFIGS } from "@/lib/chat-config"

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

  const totalMessages = Object.values(messageCounts).reduce((sum, counts) => sum + counts.total, 0)
  const totalHearted = Object.values(messageCounts).reduce((sum, counts) => sum + counts.hearted, 0)
  const totalThumbsDown = Object.values(messageCounts).reduce((sum, counts) => sum + counts.thumbsDown, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Export Options</DialogTitle>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Message Filters</h4>
            <div className="flex items-center gap-2">
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
                className="h-4 w-4 rounded border-primary"
              />
              <label htmlFor="includeAll" className="text-sm font-medium">
                Export all messages ({totalMessages})
              </label>
            </div>
            <div className="flex items-center gap-2">
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
                className="h-4 w-4 rounded border-primary"
              />
              <label htmlFor="includeHearted" className="text-sm font-medium">
                Only export hearted messages ({totalHearted})
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="excludeThumbsDown"
                checked={excludeThumbsDown}
                onChange={(e) => setExcludeThumbsDown(e.target.checked)}
                className="h-4 w-4 rounded border-primary"
              />
              <label htmlFor="excludeThumbsDown" className="text-sm font-medium">
                Exclude thumbs down messages ({totalThumbsDown})
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Models to Export</h4>
            {Object.entries(MODEL_CONFIGS).map(([modelId, config]) => (
              <div key={modelId} className="flex items-center gap-2">
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
                  className="h-4 w-4 rounded border-primary"
                />
                <label htmlFor={`model-${modelId}`} className="text-sm font-medium">
                  {config.name} ({messageCounts[modelId]?.total || 0} messages)
                </label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onExport({ includeAll, includeHearted, excludeThumbsDown, selectedModels })
              onClose()
            }}
            disabled={selectedModels.length === 0}
          >
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 