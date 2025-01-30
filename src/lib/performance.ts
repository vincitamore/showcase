import { env } from '@/env'

interface PerformanceMetrics {
  duration: number
  timestamp: number
  labels: Record<string, string | number>
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
}

// Separate client and server-side tracking
const isClient = typeof window !== 'undefined'

// Store metrics in memory
const metricsStore = new Map<string, { startTime: number; labels: Record<string, string | number> }>()

// Track if we're currently processing a performance metric to prevent recursion
let isProcessingMetric = false;

export const performance = {
  async sendMetricsToServer(metrics: PerformanceMetrics) {
    if (!isClient || isProcessingMetric) return // Only send metrics from client and prevent recursion

    try {
      isProcessingMetric = true;
      await fetch('/api/monitoring/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metrics,
          level: metrics.level || 'INFO'
        })
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
    } finally {
      isProcessingMetric = false;
    }
  },

  /**
   * Start timing an operation
   */
  start(operationId: string, labels: Record<string, string | number> = {}) {
    if (!env.NEXT_PUBLIC_MONITORING_ENABLED) return

    metricsStore.set(operationId, {
      startTime: Date.now(),
      labels
    })
  },

  /**
   * End timing an operation and log the metrics
   */
  end(operationId: string, additionalLabels: Record<string, string | number> = {}) {
    if (!env.NEXT_PUBLIC_MONITORING_ENABLED) return

    const metric = metricsStore.get(operationId)
    if (!metric) {
      console.warn('No timing found for operation', { operationId })
      return
    }

    const duration = Date.now() - metric.startTime
    const metrics: PerformanceMetrics = {
      duration,
      timestamp: Date.now(),
      labels: { ...metric.labels, ...additionalLabels, operationId },
      level: additionalLabels.error ? 'ERROR' : 'INFO'
    }

    // Clean up
    metricsStore.delete(operationId)

    // Send metrics to server if in browser
    if (isClient) {
      this.sendMetricsToServer(metrics)
    } else {
      // In server context, just log to console
      console.log('[Performance]', {
        operation: operationId,
        duration,
        ...metric.labels,
        ...additionalLabels
      })
    }
  },

  /**
   * Track database query performance
   */
  async trackQuery<T>(
    queryName: string, 
    query: Promise<T>,
    labels: Record<string, string | number> = {}
  ): Promise<T> {
    if (!env.MONITORING_ENABLED) return query

    const operationId = `db_query_${queryName}`
    this.start(operationId, { type: 'db_query', query: queryName, ...labels })

    try {
      const result = await query
      this.end(operationId)
      return result
    } catch (error) {
      this.end(operationId, { error: 1 })
      throw error
    }
  },

  /**
   * Track external service call performance
   */
  async trackExternalCall<T>(
    serviceName: string,
    call: Promise<T>,
    labels: Record<string, string | number> = {}
  ): Promise<T> {
    if (!env.NEXT_PUBLIC_MONITORING_ENABLED) return call

    const operationId = `external_${serviceName}`
    this.start(operationId, { type: 'external', service: serviceName, ...labels })

    try {
      const result = await call
      this.end(operationId)
      return result
    } catch (error) {
      this.end(operationId, { error: 1 })
      throw error
    }
  }
} 
