'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { LogsTable, type LogEntry } from '@/components/logs/logs-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { LogsContent } from './logs-content'

const LOG_LEVELS = ['all', 'debug', 'info', 'warn', 'error'] as const

export default function LogsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Application Logs</h1>
          <p className="text-sm text-muted-foreground">Loading logs...</p>
        </div>
      </div>
    }>
      <LogsContent />
    </Suspense>
  )
} 