'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type {
  ColumnDef,
  ColumnResizeMode,
  Row,
  SortingState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { format, startOfDay, endOfDay } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LogModal } from './log-modal'
import { ArrowUpDown, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { DateRange } from 'react-day-picker'
import { useVirtualizer } from '@tanstack/react-virtual'
import React from 'react'

export interface LogEntry {
  id: string
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  duration?: number | null
  error: boolean
  route?: string | null
  method?: string | null
  status?: number | null
  metadata: any
}

const levelColors = {
  DEBUG: 'bg-gray-500',
  INFO: 'bg-blue-500',
  WARN: 'bg-yellow-500',
  ERROR: 'bg-red-500'
} as const

interface LogsTableProps {
  logs: LogEntry[]
  total?: number
}

export function LogsTable({ logs, total }: LogsTableProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'timestamp', desc: true }
  ])
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [columnFilters, setColumnFilters] = useState<{ id: string; value: any }[]>([])

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Memoize unique routes extraction
  const uniqueRoutes = useMemo(() => {
    const routes = new Set<string>(['all'])
    logs.forEach(log => {
      if (log.route) routes.add(log.route)
    })
    return Array.from(routes).sort()
  }, [logs])

  // Define available log levels
  const logLevels = ['all', 'DEBUG', 'INFO', 'WARN', 'ERROR']

  // Memoize filter handlers
  const handleDateRangeSelect = useCallback((newDateRange: DateRange | undefined) => {
    setDateRange(newDateRange)
    if (newDateRange?.from) {
      setColumnFilters(prev => {
        const existing = prev.filter(f => f.id !== 'timestamp')
        return [...existing, { id: 'timestamp', value: newDateRange }]
      })
    } else {
      setColumnFilters(prev => prev.filter(f => f.id !== 'timestamp'))
    }
  }, [])

  const handleFilterChange = useCallback((columnId: string, value: any) => {
    setColumnFilters(prev => {
      const existing = prev.filter(f => f.id !== columnId)
      if (value === 'all' || !value) return existing
      return [...existing, { id: columnId, value }]
    })
  }, [])

  // Memoize columns definition
  const columns = useMemo<ColumnDef<LogEntry>[]>(() => {
    const baseColumns: ColumnDef<LogEntry>[] = [
      {
        accessorKey: 'timestamp',
        header: ({ column }) => (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="p-0 hover:bg-transparent"
            >
              Timestamp
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-[240px] justify-start text-left font-normal ${!dateRange && "text-muted-foreground"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                        {format(dateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    <span>All dates</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="flex w-auto flex-col space-y-2 p-2">
                <div className="rounded-md border">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={2}
                    showOutsideDays={false}
                    fixedWeeks
                    weekStartsOn={0}
                    className="rounded-md border shadow"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
                {dateRange?.from && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDateRangeSelect(undefined)}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        ),
        size: 250,
        cell: ({ row }) => {
          const timestamp = row.getValue('timestamp') as string
          return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss')
        },
        filterFn: (row: Row<LogEntry>, id: string, filterValue: DateRange | undefined) => {
          if (!filterValue?.from) return true

          try {
            const timestamp = new Date(row.getValue(id) as string)
            if (isNaN(timestamp.getTime())) return true

            const from = startOfDay(filterValue.from)
            const to = filterValue.to ? endOfDay(filterValue.to) : endOfDay(filterValue.from)

            return timestamp >= from && timestamp <= to
          } catch (error) {
            console.error('Error filtering date:', error)
            return true
          }
        }
      },
      {
        accessorKey: 'level',
        header: ({ column }) => (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="p-0 hover:bg-transparent"
            >
              Level
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <Select
              value={columnFilters.find(f => f.id === 'level')?.value || 'all'}
              onValueChange={value => handleFilterChange('level', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                {logLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level === 'all' ? 'All Levels' : level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
        size: 100,
        cell: ({ row }) => {
          const level = row.getValue('level') as LogEntry['level']
          return (
            <Badge className={levelColors[level]}>
              {level}
            </Badge>
          )
        },
        filterFn: (row: Row<LogEntry>, id: string, filterValue: string) => {
          return filterValue === 'all' || row.getValue(id) === filterValue
        }
      },
      {
        accessorKey: 'route',
        header: ({ column }) => (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="p-0 hover:bg-transparent"
            >
              Route
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <Select
              value={columnFilters.find(f => f.id === 'route')?.value || 'all'}
              onValueChange={value => handleFilterChange('route', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Filter by route" />
              </SelectTrigger>
              <SelectContent>
                {uniqueRoutes.map((route) => (
                  <SelectItem key={route} value={route}>
                    {route === 'all' ? 'All Routes' : route}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
        size: 200,
        cell: ({ row }) => row.getValue('route') || '-',
        filterFn: (row: Row<LogEntry>, id: string, filterValue: string) => {
          if (filterValue === 'all') return true
          const route = row.getValue(id) as string | null
          if (!route) return false
          return route === filterValue
        }
      },
      {
        accessorKey: 'message',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
          >
            Message
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        size: 400,
        cell: ({ row }) => {
          const message = row.getValue('message') as string
          return (
            <div className="max-w-[400px] truncate" title={message}>
              {message}
            </div>
          )
        }
      },
      {
        accessorKey: 'duration',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
          >
            Duration
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        size: 100,
        cell: ({ row }) => {
          const duration = row.getValue('duration') as number | null
          return duration ? `${duration}ms` : '-'
        }
      }
    ]

    return baseColumns
  }, [dateRange, columnFilters, handleDateRangeSelect, handleFilterChange, uniqueRoutes, logLevels])

  // Create table instance
  const table = useReactTable({
    data: logs,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode,
  })

  // Set up virtualization
  const parentRef = React.useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
    scrollPaddingStart: mounted ? undefined : 0,
    scrollPaddingEnd: mounted ? undefined : 0,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0

  // Render loading state if not mounted
  if (!mounted) {
    return (
      <div className="rounded-md border">
        <div className="h-[400px] flex items-center justify-center">
          Loading table...
        </div>
      </div>
    )
  }

  // Count filtered logs for display purposes
  const visibleCount = table.getFilteredRowModel().rows.length

  return (
    <div className="rounded-md border">
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div ref={parentRef} className="relative w-full h-full">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none
                            ${header.column.getIsResizing() ? 'bg-primary' : 'bg-border'}`}
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualRows.map(virtualRow => {
                const row = rows[virtualRow.index]
                if (!row) return null

                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(row.original)}
                    data-index={virtualRow.index}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ height: `${paddingBottom}px` }} />
                </tr>
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </div>
      </ScrollArea>

      {/* Table footer with count information */}
      <div className="px-4 py-2 text-sm text-muted-foreground border-t">
        Showing {visibleCount} {visibleCount === 1 ? 'log' : 'logs'}
        {total !== undefined && total > 0 && visibleCount !== total && (
          <span> of {total} total</span>
        )}
      </div>

      <LogModal
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open: boolean) => !open && setSelectedLog(null)}
      />
    </div>
  )
} 
