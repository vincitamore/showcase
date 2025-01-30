'use client'

import { useMetrics } from '../../metrics-provider'
import { Bar } from 'react-chartjs-2'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { barChartOptions, chartColors } from '@/lib/chart-config'
import { useMemo } from 'react'

interface RouteMetric {
  route: string
  requests: number
  success: number
  error: number
  avgDuration: number
}

export default function RouteMetrics() {
  const { metrics, loading, error } = useMetrics()

  const { data, options } = useMemo(() => {
    if (!metrics?.routes) {
      return { data: null, options: null }
    }

    // Convert routes object to array if it's not already
    const routesArray = Array.isArray(metrics.routes) 
      ? metrics.routes 
      : Object.entries(metrics.routes).map(([route, stats]) => ({
          route,
          ...stats
        }));

    if (routesArray.length === 0) {
      return { data: null, options: null }
    }

    const data = {
      labels: routesArray.map(r => r.route),
      datasets: [
        {
          label: 'Success',
          data: routesArray.map(r => r.success),
          backgroundColor: chartColors.green.secondary,
          borderColor: chartColors.green.primary,
          borderWidth: 1,
          stack: 'Stack 0'
        },
        {
          label: 'Error',
          data: routesArray.map(r => r.error),
          backgroundColor: chartColors.red.secondary,
          borderColor: chartColors.red.primary,
          borderWidth: 1,
          stack: 'Stack 0'
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
              const routeIndex = context.dataIndex;
              const route = routesArray[routeIndex];
              if (!route) return `${label}: ${value}`;

              const total = route.success + route.error;
              const rate = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              const avgDuration = route.avgDuration.toFixed(2);
              
              if (label === 'Success') {
                return [
                  `Successful Requests: ${value} (${rate}%)`,
                  `Average Duration: ${avgDuration}ms`
                ];
              } else {
                return [
                  `Failed Requests: ${value} (${rate}%)`,
                  `Average Duration: ${avgDuration}ms`
                ];
              }
            }
          }
        }
      },
      scales: {
        ...barChartOptions.scales,
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          beginAtZero: true
        }
      }
    }

    return { data, options }
  }, [metrics?.routes])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load route metrics: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || !options) {
    return (
      <Alert>
        <AlertDescription>No route metrics available</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-[200px]">
      <Bar data={data} options={options} />
    </div>
  )
} 
