'use client'

import { useMetrics } from '../../metrics-provider'
import { Line } from 'react-chartjs-2'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { lineChartOptions, chartColors, optimizeDataset } from '@/lib/chart-config'
import { useMemo } from 'react'

export default function DatabaseMetrics() {
  const { metrics, loading, error } = useMetrics()

  const { data, options } = useMemo(() => {
    if (!metrics?.database?.timeSeries) {
      return { data: null, options: null }
    }

    const timePoints = optimizeDataset(metrics.database.timeSeries)
    const labels = timePoints.map(point => 
      new Date(point.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    )

    const data = {
      labels,
      datasets: [
        {
          label: 'Query Duration (ms)',
          data: timePoints.map(point => point.avgDuration),
          borderColor: chartColors.green.primary,
          backgroundColor: chartColors.green.secondary,
          yAxisID: 'y'
        },
        {
          label: 'Queries per Minute',
          data: timePoints.map(point => point.queryCount),
          borderColor: chartColors.blue.primary,
          backgroundColor: chartColors.blue.secondary,
          yAxisID: 'y1'
        }
      ]
    }

    const options = {
      ...lineChartOptions,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        ...lineChartOptions.plugins,
        tooltip: {
          ...lineChartOptions.plugins?.tooltip,
          callbacks: {
            label: function(context: any) {
              const label = context.dataset.label || ''
              const value = context.parsed.y
              const point = timePoints[context.dataIndex]
              if (!point) return `${label}: ${value}`
              
              if (label.includes('Duration')) {
                return `${label}: ${value.toFixed(2)} ms`
              }
              if (label.includes('Queries')) {
                const errorRate = (point.errorCount / point.queryCount) * 100
                return [
                  `${label}: ${value}`,
                  `Error Rate: ${errorRate.toFixed(1)}%`
                ]
              }
              return `${label}: ${value}`
            }
          }
        }
      },
      scales: {
        ...lineChartOptions.scales,
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: true,
            text: 'Duration (ms)'
          }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Query Count'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }

    return { data, options }
  }, [metrics?.database?.timeSeries])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load database metrics: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || !options) {
    return (
      <Alert>
        <AlertDescription>No database metrics available</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-[200px]">
      <Line options={options} data={data} />
    </div>
  )
} 