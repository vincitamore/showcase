import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopyIcon } from "lucide-react"
import type { LogEntry } from "./logs-table"

interface LogModalProps {
  log: LogEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogModal({ log, open, onOpenChange }: LogModalProps) {
  if (!log) return null

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-500'
      case 'WARN':
        return 'bg-yellow-500'
      case 'INFO':
        return 'bg-blue-500'
      case 'DEBUG':
        return 'bg-gray-500'
      default:
        return ''
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const formatMetadata = (metadata: any) => {
    try {
      if (typeof metadata === 'string') {
        return JSON.stringify(JSON.parse(metadata), null, 2)
      }
      return JSON.stringify(metadata, null, 2)
    } catch {
      return String(metadata)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Log Details
            <Badge className={getLevelColor(log.level)}>
              {log.level}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Timestamp</h3>
              <p className="font-mono text-sm">{formatDate(log.timestamp)}</p>
            </div>

            {log.route && (
              <div>
                <h3 className="font-semibold mb-1">Route</h3>
                <p className="font-mono text-sm">{log.route}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-1">Message</h3>
              <p className="whitespace-pre-wrap">{log.message}</p>
            </div>

            {log.duration !== undefined && (
              <div>
                <h3 className="font-semibold mb-1">Duration</h3>
                <p>{log.duration}ms</p>
              </div>
            )}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Metadata</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => copyToClipboard(formatMetadata(log.metadata))}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative w-full">
                  <ScrollArea className="w-full max-h-[300px] border rounded-md bg-muted/5">
                    <pre className="p-4 text-sm font-mono whitespace-pre overflow-x-auto">
                      {formatMetadata(log.metadata)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 