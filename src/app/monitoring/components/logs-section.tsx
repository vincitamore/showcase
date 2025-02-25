'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogsTable, type LogEntry } from '@/components/logs/logs-table'

const REFRESH_INTERVAL = 5000 // 5 seconds

export default function LogsSection() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    console.debug('[LogsSection] Starting fetchLogs')
    try {
      setIsLoading(true)
      const response = await fetch('/api/monitoring/logs', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Sort logs by timestamp in descending order
      const sortedLogs = [...data.logs].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      
      setLogs(sortedLogs)
      setTotal(data.total)
    } catch (error) {
      console.error('[LogsSection] Error fetching logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    console.debug('[LogsSection] Running initial fetch')
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!isAutoRefresh) {
      console.debug('[LogsSection] Auto-refresh disabled')
      return
    }

    console.debug('[LogsSection] Setting up auto-refresh')
    const interval = setInterval(fetchLogs, REFRESH_INTERVAL)
    return () => {
      console.debug('[LogsSection] Cleaning up auto-refresh')
      clearInterval(interval)
    }
  }, [isAutoRefresh, fetchLogs])

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">System Logs</h2>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Application Logs</h3>
              <p className="text-sm text-muted-foreground">
                Real-time log entries with filtering and search
              </p>
            </div>
            <Button
              variant="outline"
              size="default"
              onClick={() => setIsAutoRefresh(prev => !prev)}
              className="shrink-0"
            >
              {isAutoRefresh ? 'Pause Updates' : 'Resume Updates'}
            </Button>
          </div>

          <div className="rounded-md border">
            <LogsTable logs={logs} total={total} />
          </div>
        </div>
      </Card>
    </section>
  )
} 