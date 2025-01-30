'use client'

import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useTheme } from 'next-themes'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface MetricsData {
  timestamp: number
  requests: number
  errors: number
  avgDuration: number
}

export function MetricsChart() {
  const [metrics, setMetrics] = useState<MetricsData[]>([])
  const { theme } = useTheme()

  useEffect(() => {
    let eventSource: EventSource

    const connectSSE = () => {
      eventSource = new EventSource('/api/monitoring/metrics/sse')

      eventSource.addEventListener('metrics', (event) => {
        try {
          const data = JSON.parse(event.data)
          setMetrics(prevMetrics => {
            const newMetrics = [...prevMetrics, data]
            // Keep last 30 data points
            return newMetrics.slice(-30)
          })
        } catch (error) {
          console.error('Failed to parse metrics:', error)
        }
      })

      eventSource.addEventListener('error', () => {
        eventSource.close()
        // Attempt to reconnect after 5 seconds
        setTimeout(connectSSE, 5000)
      })
    }

    connectSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [])

  const chartData: ChartData<'line'> = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Requests/min',
        data: metrics.map(m => m.requests),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.2
      },
      {
        label: 'Errors/min',
        data: metrics.map(m => m.errors),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.2
      },
      {
        label: 'Avg Duration (ms)',
        data: metrics.map(m => m.avgDuration),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.2
      }
    ]
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      },
      x: {
        grid: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme === 'dark' ? '#fff' : '#000'
        }
      }
    }
  }

  return (
    <div className="h-[400px]">
      <Line data={chartData} options={options} />
    </div>
  )
} 