import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
  ScriptableContext,
  TooltipItem,
  InteractionMode
} from 'chart.js'

// Register ChartJS components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

// Optimize chart performance
ChartJS.defaults.responsive = true
ChartJS.defaults.maintainAspectRatio = false

// Disable animations by default for better performance
ChartJS.defaults.animation = {
  duration: 0
}

// Optimize rendering
ChartJS.defaults.elements.line.borderWidth = 1
ChartJS.defaults.elements.point.radius = 2
ChartJS.defaults.elements.point.hoverRadius = 4

// Base options for all charts
export const baseChartOptions: ChartOptions<'line' | 'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    mode: 'nearest' as InteractionMode,
    axis: 'x' as const,
    intersect: false
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 8,
        font: {
          size: 11
        }
      }
    },
    tooltip: {
      enabled: true,
      mode: 'nearest' as InteractionMode,
      intersect: false,
      animation: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'rgba(255, 255, 255, 0.8)',
      bodyColor: 'rgba(255, 255, 255, 0.8)',
      cornerRadius: 4,
      padding: 8,
      bodyFont: {
        size: 11
      },
      titleFont: {
        size: 11
      }
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        display: false
      },
      ticks: {
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 10,
        font: {
          size: 10
        }
      }
    },
    y: {
      display: true,
      beginAtZero: true,
      ticks: {
        maxTicksLimit: 8,
        font: {
          size: 10
        }
      }
    }
  },
  elements: {
    point: {
      radius: 0,
      hitRadius: 8,
      hoverRadius: 4,
      hoverBorderWidth: 1
    }
  },
  layout: {
    padding: {
      top: 4,
      right: 4,
      bottom: 4,
      left: 4
    }
  }
}

// Specific options for line charts
export const lineChartOptions: ChartOptions<'line'> = {
  ...baseChartOptions,
  elements: {
    ...baseChartOptions.elements,
    line: {
      tension: 0.2,
      borderWidth: 1.5,
      fill: false,
      spanGaps: true,
      capBezierPoints: true
    }
  }
}

// Specific options for bar charts
export const barChartOptions: ChartOptions<'bar'> = {
  ...baseChartOptions,
  elements: {
    ...baseChartOptions.elements,
    bar: {
      borderWidth: 1
    }
  },
  scales: {
    ...baseChartOptions.scales,
    x: {
      ...baseChartOptions.scales?.x,
      stacked: true
    },
    y: {
      ...baseChartOptions.scales?.y,
      stacked: true
    }
  }
}

// Theme-aware colors with proper typing
interface ChartColor {
  primary: string
  secondary: string
}

type ChartColorScheme = {
  blue: ChartColor;
  green: ChartColor;
  red: ChartColor;
  purple: ChartColor;
}

export const chartColors: ChartColorScheme = {
  blue: {
    primary: 'rgb(59, 130, 246)',
    secondary: 'rgba(59, 130, 246, 0.5)'
  },
  green: {
    primary: 'rgb(75, 192, 192)',
    secondary: 'rgba(75, 192, 192, 0.5)'
  },
  red: {
    primary: 'rgb(255, 99, 132)',
    secondary: 'rgba(255, 99, 132, 0.5)'
  },
  purple: {
    primary: 'rgb(153, 102, 255)',
    secondary: 'rgba(153, 102, 255, 0.5)'
  }
}

// Data point throttling with proper typing
export function throttleDataPoints<T extends { timestamp: number }>(
  data: Array<T>,
  maxPoints: number = 30
): Array<T> {
  if (data.length <= maxPoints) return data
  
  const step = Math.ceil(data.length / maxPoints)
  return data.filter((_, index) => index % step === 0).slice(-maxPoints)
}

// Optimize dataset updates with proper typing
export function optimizeDataset<T extends { timestamp: number }>(
  data: Array<T>,
  maxPoints: number = 30
): Array<T> {
  return throttleDataPoints(data, maxPoints).map(point => {
    const optimizedPoint = { ...point }
    Object.entries(point).forEach(([key, value]) => {
      if (typeof value === 'number') {
        (optimizedPoint as any)[key] = Number(value.toFixed(2))
      }
    })
    return optimizedPoint as T
  })
}

// Chart update throttling
let lastUpdate = 0
const UPDATE_THRESHOLD = 16 // ~60fps

export function shouldUpdateChart(): boolean {
  const now = performance.now()
  if (now - lastUpdate < UPDATE_THRESHOLD) {
    return false
  }
  lastUpdate = now
  return true
} 