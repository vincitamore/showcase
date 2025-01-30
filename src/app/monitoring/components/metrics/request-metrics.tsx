'use client'

import { useMetrics } from '../../metrics-provider'
import { Bar } from 'react-chartjs-2'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { barChartOptions, chartColors } from '@/lib/chart-config'
import { useMemo } from 'react'

export default function RequestMetrics() {
  const { metrics, loading, error } = useMetrics()

  const { data, options } = useMemo(() => {
    if (!metrics?.requests) {
      return { data: null, options: null }
    }

    const data = {
      labels: ['Total', 'Success', 'Error'],
      datasets: [
        {
          label: 'Requests',
          data: [
            metrics.requests.total,
            metrics.requests.success,
            metrics.requests.error
          ],
          backgroundColor: [
            chartColors.blue.secondary,
            chartColors.green.secondary,
            chartColors.red.secondary
          ],
          borderColor: [
            chartColors.blue.primary,
            chartColors.green.primary,
            chartColors.red.primary
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
              const label = context.dataset.label || '';
              const value = context.raw || 0;
              const type = context.label;
              if (type === 'Total') {
                return `Total Requests: ${value}`;
              } else if (type === 'Success') {
                const rate = metrics.requests.total > 0 
                  ? ((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)
                  : '0';
                return `Successful Requests: ${value} (${rate}%)`;
              } else {
                const rate = metrics.requests.total > 0
                  ? ((metrics.requests.error / metrics.requests.total) * 100).toFixed(1)
                  : '0';
                return `Failed Requests: ${value} (${rate}%)`;
              }
            }
          }
        }
      }
    }

    return { data, options }
  }, [metrics?.requests])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load request metrics: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || !options) {
    return (
      <Alert>
        <AlertDescription>No request metrics available</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-[200px]">
      <Bar data={data} options={options} />
    </div>
  )
} 