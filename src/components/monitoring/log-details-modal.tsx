import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Log } from '@prisma/client'
import { format } from 'date-fns'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { CopyIcon } from 'lucide-react'
import { Prisma } from '@prisma/client'

interface LogDetailsModalProps {
  log: Log | null
  onClose: () => void
}

export function LogDetailsModal({ log, onClose }: LogDetailsModalProps) {
  if (!log) return null

  const formatMetadata = (metadata: Prisma.JsonValue | null) => {
    if (!metadata) return ''
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(metadata)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Dialog open={!!log} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Log Details
            <Badge variant="outline" className="uppercase">{log.level}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div>
            <h3 className="font-semibold mb-1">Timestamp</h3>
            <p>{format(log.timestamp, 'M/d/yyyy, h:mm:ss a')}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Message</h3>
            <p>{log.message}</p>
          </div>

          {log.duration !== null && (
            <div>
              <h3 className="font-semibold mb-1">Duration</h3>
              <p>{log.duration}ms</p>
            </div>
          )}

          {log.metadata && (
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
                <ScrollArea className="w-full border rounded-md bg-muted/5">
                  <pre className="p-4 text-sm font-mono whitespace-pre overflow-x-auto">
                    {formatMetadata(log.metadata)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 
