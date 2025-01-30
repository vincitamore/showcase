'use client'

import { useMetrics } from '../../metrics-provider'
import { Bar } from 'react-chartjs-2'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { barChartOptions, chartColors } from '@/lib/chart-config'
import { useMemo } from 'react'

export default function ExternalMetrics() {
  const { metrics, loading, error } = useMetrics()

  const { data, options } = useMemo(() => {
    if (!metrics?.external) {
      return { data: null, options: null }
    }

    const data = {
      labels: ['Latency (ms)', 'Success Rate (%)'],
      datasets: [
        {
          label: 'External Service Performance',
          data: [
            Number(metrics.external.avgLatency.toFixed(2)),
            Number((100 - (metrics.external.errorRate * 100)).toFixed(1))
          ],
          backgroundColor: [
            chartColors.purple.secondary,
            chartColors.green.secondary
          ],
          borderColor: [
            chartColors.purple.primary,
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
              const index = context.dataIndex;
              const totalCalls = metrics.external.totalCalls;
              
              if (index === 0) {
                return [
                  `Average Latency: ${value}ms`,
                  `Total Calls: ${totalCalls}`
                ];
              } else {
                const successRate = value;
                const errorRate = (100 - value).toFixed(1);
                return [
                  `Success Rate: ${successRate}%`,
                  `Error Rate: ${errorRate}%`,
                  `Total Calls: ${totalCalls}`
                ];
              }
            }
          }
        }
      }
    }

    return { data, options }
  }, [metrics?.external])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load external service metrics: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || !options) {
    return (
      <Alert>
        <AlertDescription>No external service metrics available</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-[200px]">
      <Bar data={data} options={options} />
    </div>
  )
} 
