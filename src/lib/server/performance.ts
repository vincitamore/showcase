import { env } from '@/env'
import { logger } from '@/lib/logger'

interface PerformanceMetrics {
  duration: number
  timestamp: number
  labels: Record<string, unknown>
}

// Store metrics in memory
const metricsStore = new Map<string, { startTime: number; labels: Record<string, unknown> }>()

// Track if we're currently processing a performance metric to prevent recursion
let isProcessingMetric = false;

export const serverPerformance = {
  start(operationId: string, labels: Record<string, unknown> = {}) {
    if (!env.MONITORING_ENABLED) return

    metricsStore.set(operationId, {
      startTime: Date.now(),
      labels
    })
  },

  end(operationId: string, additionalLabels: Record<string, unknown> = {}) {
    if (!env.MONITORING_ENABLED) return

    const metric = metricsStore.get(operationId)
    if (!metric) {
      logger.warn('No timing found for operation', { operationId })
      return
    }

    const duration = Date.now() - metric.startTime
    const metrics: PerformanceMetrics = {
      duration,
      timestamp: Date.now(),
      labels: { ...metric.labels, ...additionalLabels, operationId }
    }

    // Clean up
    metricsStore.delete(operationId)

    // Skip logging if we're already processing a metric
    if (isProcessingMetric) {
      if (env.NODE_ENV === 'development') {
        console.debug('Skipping recursive performance metric logging')
      }
      return
    }

    try {
      isProcessingMetric = true
      // Log metrics
      logger.info('Performance metrics', {
        metrics,
        operation: operationId
      })
    } finally {
      isProcessingMetric = false
    }
  },

  async trackQuery<T>(
    queryName: string, 
    query: Promise<T>,
    labels: Record<string, unknown> = {}
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

  async trackExternalCall<T>(
    serviceName: string,
    call: Promise<T>,
    labels: Record<string, unknown> = {}
  ): Promise<T> {
    if (!env.MONITORING_ENABLED) return call

    const operationId = `external_${serviceName}`
    const startTime = Date.now()

    try {
      const result = await call

      // Log external call metrics
      await logger.info('External service call', {
        metrics: {
          duration: Date.now() - startTime,
          labels: {
            type: 'external',
            service: serviceName,
            error: 0,
            ...labels
          }
        }
      })

      return result
    } catch (error) {
      // Log external call error
      await logger.error('External service error', {
        metrics: {
          duration: Date.now() - startTime,
          labels: {
            type: 'external',
            service: serviceName,
            error: 1,
            ...labels
          }
        }
      })
      throw error
    }
  }
} 