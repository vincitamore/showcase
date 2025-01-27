import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface ExportOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (options: { 
    includeAll: boolean
    includeHearted: boolean
    excludeThumbsDown: boolean 
  }) => void
  messageCount: number
  heartedCount: number
  thumbsDownCount: number
}

export function ExportOptionsDialog({
  isOpen,
  onClose,
  onExport,
  messageCount,
  heartedCount,
  thumbsDownCount
}: ExportOptionsDialogProps) {
  const [includeAll, setIncludeAll] = React.useState(true)
  const [includeHearted, setIncludeHearted] = React.useState(false)
  const [excludeThumbsDown, setExcludeThumbsDown] = React.useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Export Options</DialogTitle>
        <div className="grid gap-4 py-4">
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
              Export all messages ({messageCount})
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
              Only export hearted messages ({heartedCount})
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
              Exclude thumbs down messages ({thumbsDownCount})
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => {
            onExport({ includeAll, includeHearted, excludeThumbsDown })
            onClose()
          }}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 