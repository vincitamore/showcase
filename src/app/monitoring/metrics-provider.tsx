'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { env } from '@/env'

interface RouteMetrics {
  route: string
  requests: number
  success: number
  error: number
  avgDuration: number
}

interface MetricsData {
  timestamp: number
  requests: {
    total: number
    success: number
    error: number
    avgDuration: number
  }
  routes: {
    [key: string]: {
      total: number
      success: number
      error: number
      avgDuration: number
    }
  }
  database: {
    totalQueries: number
    avgQueryDuration: number
    errorRate: number
    timeSeries: Array<{
      timestamp: number
      avgDuration: number
      queryCount: number
      errorCount: number
    }>
  }
  external: {
    totalCalls: number
    avgLatency: number
    errorRate: number
  }
  memory?: {
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  } | null
  logs: {
    total: number
    info: number
    warn: number
    error: number
    debug: number
  }
}

interface MetricsContextType {
  metrics: MetricsData | null
  loading: boolean
  error: Error | null
}

const MetricsContext = createContext<MetricsContextType>({
  metrics: null,
  loading: true,
  error: null
})

export function useMetrics() {
  return useContext(MetricsContext)
}

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  useEffect(() => {
    let eventSource: EventSource | null = null
    let retryTimeout: NodeJS.Timeout | null = null

    async function connectSSE() {
      // Allow monitoring in development mode or when explicitly enabled
      if (!env.NEXT_PUBLIC_MONITORING_ENABLED && process.env.NODE_ENV !== 'development') {
        setLoading(false)
        setError(new Error('Monitoring is not enabled'))
        return
      }

      setLoading(true)
      setError(null)

      if (eventSource) {
        console.debug('Closing existing EventSource')
        eventSource.close()
      }

      try {
        console.debug('Creating new EventSource')
        eventSource = new EventSource('/api/monitoring/metrics/sse')

        // Handle metrics events
        eventSource.addEventListener('metrics', (event: MessageEvent) => {
          console.debug('Received metrics event')
          try {
            if (!event.data) {
              console.warn('No data in metrics event')
              return
            }

            const rawData = JSON.parse(event.data)
            console.debug('Parsed metrics data:', {
              hasRoutes: Array.isArray(rawData.routes),
              routeCount: Array.isArray(rawData.routes) ? rawData.routes.length : 0,
              hasDatabase: !!rawData.database,
              timestamp: rawData.timestamp
            })

            // Transform routes array to object
            const routesObject: MetricsData['routes'] = {}
            if (Array.isArray(rawData.routes)) {
              rawData.routes.forEach((route: RouteMetrics) => {
                routesObject[route.route] = {
                  total: route.requests,
                  success: route.success,
                  error: route.error,
                  avgDuration: route.avgDuration
                }
              })
            }

            const transformedData: MetricsData = {
              ...rawData,
              routes: routesObject
            }

            setMetrics(transformedData)
            setLoading(false)
            setRetryCount(0)
          } catch (err) {
            console.error('Failed to parse metrics:', err, 'Raw data:', event.data)
            setError(new Error('Failed to parse metrics data'))
          }
        })

        // Handle heartbeat events
        eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
          console.debug('Received heartbeat event')
          try {
            if (!event.data) {
              console.warn('No data in heartbeat event')
              return
            }
            const data = JSON.parse(event.data)
            console.debug('Heartbeat data:', data)
          } catch (err) {
            console.error('Failed to parse heartbeat:', err, 'Raw data:', event.data)
          }
        })

        // Handle error events
        eventSource.addEventListener('error', (event) => {
          const target = event.target as EventSource
          console.error('SSE connection error state:', {
            readyState: target.readyState,
            state: target.readyState === 0 ? 'connecting' : target.readyState === 1 ? 'open' : 'closed',
            hasError: !!event,
            errorType: event instanceof Error ? event.constructor.name : typeof event,
            error: event instanceof Error ? event.message : undefined
          })

          // Only retry if we're actually closed
          if (target.readyState === EventSource.CLOSED) {
            console.debug('Connection closed, attempting reconnect')
            eventSource?.close()
            
            if (retryCount < MAX_RETRIES) {
              const timeout = Math.min(1000 * Math.pow(2, retryCount), 10000)
              console.debug(`Scheduling retry in ${timeout}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
              
              if (retryTimeout) {
                clearTimeout(retryTimeout)
              }
              
              retryTimeout = setTimeout(() => {
                console.debug(`Attempting retry ${retryCount + 1}/${MAX_RETRIES}`)
                setRetryCount(prev => prev + 1)
                connectSSE()
              }, timeout)
            } else {
              console.debug('Max retries reached, giving up')
              setLoading(false)
              setError(new Error('Failed to connect to metrics stream after multiple retries'))
            }
          } else if (target.readyState === EventSource.CONNECTING) {
            console.debug('Still trying to connect...')
          }
        })

        // Handle open event
        eventSource.addEventListener('open', () => {
          console.debug('SSE connection opened')
          setError(null)
          setRetryCount(0)
        })

      } catch (err) {
        console.error('Failed to create EventSource:', err)
        setError(new Error('Failed to connect to metrics stream'))
        setLoading(false)
      }
    }

    connectSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
    }
  }, [retryCount])

  return (
    <MetricsContext.Provider value={{ metrics, loading, error }}>
      {children}
    </MetricsContext.Provider>
  )
} 