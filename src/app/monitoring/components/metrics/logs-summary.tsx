'use client'

import { useMetrics } from '../../metrics-provider'
import { Bar } from 'react-chartjs-2'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { barChartOptions, chartColors } from '@/lib/chart-config'
import { useMemo } from 'react'

export default function LogsSummary() {
  const { metrics, loading, error } = useMetrics()

  const { data, options } = useMemo(() => {
    if (!metrics?.logs) {
      return { data: null, options: null }
    }

    const data = {
      labels: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
      datasets: [
        {
          label: 'Log Level Distribution',
          data: [
            metrics.logs.info || 0,
            metrics.logs.warn || 0,
            metrics.logs.error || 0,
            metrics.logs.debug || 0
          ],
          backgroundColor: [
            chartColors.blue.secondary,
            chartColors.yellow.secondary,
            chartColors.red.secondary,
            chartColors.green.secondary
          ],
          borderColor: [
            chartColors.blue.primary,
            chartColors.yellow.primary,
            chartColors.red.primary,
            chartColors.green.primary
          ],
          borderWidth: 1
        }
      ]
    }

    const options = {
      ...barChartOptions,
      plugins: {
        ...barChartOptions.plugins,
        tooltip: {
          ...barChartOptions.plugins?.tooltip,
          callbacks: {
            label: function(context: any) {
              const value = context.raw;
              const label = context.label;
              const total = metrics.logs.total;
              const percentage = ((value / total) * 100).toFixed(1);
              
              return [
                `${label}: ${value}`,
                `${percentage}% of total logs`,
                `Total Logs: ${total}`
              ];
            }
          }
        }
      }
    }

    return { data, options }
  }, [metrics?.logs])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load logs summary: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || !options) {
    return (
      <Alert>
        <AlertDescription>No logs data available</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-[200px]">
      <Bar data={data} options={options} />
    </div>
  )
} 