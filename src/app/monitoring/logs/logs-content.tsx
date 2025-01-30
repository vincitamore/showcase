'use client'

import { useEffect, useState } from 'react'
import { LogsTable, type LogEntry } from '@/components/logs/logs-table'

export function LogsContent() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetchLogs = async () => {
      const response = await fetch('/api/monitoring/logs')
      const data = await response.json()
      setLogs(data.logs)
      setTotal(data.total)
    }

    fetchLogs()

    // Set up polling for new logs
    const interval = setInterval(fetchLogs, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Application Logs</h1>
        <p className="text-sm text-muted-foreground">
          Real-time log entries with filtering and search
        </p>
      </div>

      <div className="rounded-md border">
        <LogsTable logs={logs} />
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {logs.length} of {total} logs
      </div>
    </div>
  )
} 