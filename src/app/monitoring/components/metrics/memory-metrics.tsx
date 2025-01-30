'use client'

import { useMetrics } from '../../metrics-provider'
import { Line } from 'react-chartjs-2'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { lineChartOptions, chartColors } from '@/lib/chart-config'
import { useMemo } from 'react'

function formatMemory(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(2)
}

export default function MemoryMetrics() {
  const { metrics, loading, error } = useMetrics()

  const { data, options } = useMemo(() => {
    if (!metrics?.memory) {
      return { data: null, options: null }
    }

    const data = {
      labels: ['Heap Used', 'Heap Total', 'External', 'Array Buffers'],
      datasets: [
        {
          label: 'Memory Usage',
          data: [
            metrics.memory.heapUsed,
            metrics.memory.heapTotal,
            metrics.memory.external,
            metrics.memory.arrayBuffers
          ].map(formatMemory),
          borderColor: chartColors.red.primary,
          backgroundColor: chartColors.red.secondary,
          tension: 0.4
        }
      ]
    }

    const options = {
      ...lineChartOptions,
      plugins: {
        ...lineChartOptions.plugins,
        tooltip: {
          ...lineChartOptions.plugins?.tooltip,
          callbacks: {
            label: function(context: any) {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              return `${label}: ${value} MB`
            }
          }
        }
      },
      scales: {
        ...lineChartOptions.scales,
        y: {
          ...lineChartOptions.scales?.y,
          title: {
            display: true,
            text: 'Memory (MB)'
          }
        }
      }
    }

    return { data, options }
  }, [metrics?.memory])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load memory metrics: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || !options) {
    return (
      <Alert>
        <AlertDescription>No memory metrics available</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-[200px]">
      <Line options={options} data={data} />
    </div>
  )
} 
