'use client'

import { Suspense, lazy } from 'react'
import { Card3D } from '@/components/ui/card'
import { MetricsProvider, useMetrics } from './metrics-provider'

// Dynamically import metric components to avoid Chart.js conflicts
const DatabaseMetrics = lazy(() => import('./components/metrics/database-metrics'))
const RequestMetrics = lazy(() => import('./components/metrics/request-metrics'))
const ExternalMetrics = lazy(() => import('./components/metrics/external-metrics'))
const MemoryMetrics = lazy(() => import('./components/metrics/memory-metrics'))
const RouteMetrics = lazy(() => import('./components/metrics/route-metrics'))
const LogsSection = lazy(() => import('./components/logs-section'))

function LoadingCard({ title }: { title: string }) {
  return (
    <Card3D className="p-6">
      <div className="h-[400px] flex items-center justify-center">
        Loading {title}...
      </div>
    </Card3D>
  )
}

function MonitoringDashboard() {
  const { metrics } = useMetrics()

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">System Monitoring</h1>
        <p className="text-muted-foreground">
          Real-time performance metrics and system health monitoring
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Real-time Metrics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Suspense fallback={<LoadingCard title="request metrics" />}>
              <Card3D className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">API Requests</h3>
                    <p className="text-sm text-muted-foreground">Request count and response times</p>
                  </div>
                  <RequestMetrics />
                  <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span>Average Duration:</span>
                      <span className="font-mono">{metrics?.requests?.avgDuration?.toFixed(2) ?? '0.00'}ms</span>
                    </div>
                  </div>
                </div>
              </Card3D>
            </Suspense>

            <Suspense fallback={<LoadingCard title="route metrics" />}>
              <Card3D className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Route Performance</h3>
                    <p className="text-sm text-muted-foreground">Success and error rates by route</p>
                  </div>
                  <RouteMetrics />
                </div>
              </Card3D>
            </Suspense>

            <Suspense fallback={<LoadingCard title="database metrics" />}>
              <Card3D className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Database</h3>
                    <p className="text-sm text-muted-foreground">Query performance and counts</p>
                  </div>
                  <DatabaseMetrics />
                  <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span>Total Queries:</span>
                      <span className="font-mono">{metrics?.database?.totalQueries ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span>Error Rate:</span>
                      <span className="font-mono">{((metrics?.database?.errorRate ?? 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </Card3D>
            </Suspense>

            <Suspense fallback={<LoadingCard title="external service metrics" />}>
              <Card3D className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">External Services</h3>
                    <p className="text-sm text-muted-foreground">Third-party API performance</p>
                  </div>
                  <ExternalMetrics />
                  <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span>Total Calls:</span>
                      <span className="font-mono">{metrics?.external?.totalCalls ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span>Error Rate:</span>
                      <span className="font-mono">{((metrics?.external?.errorRate ?? 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </Card3D>
            </Suspense>

            <Suspense fallback={<LoadingCard title="memory metrics" />}>
              <Card3D className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Memory Usage</h3>
                    <p className="text-sm text-muted-foreground">System memory statistics</p>
                  </div>
                  <MemoryMetrics />
                  <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span>Heap Usage:</span>
                      <span className="font-mono">
                        {((metrics?.memory?.heapUsed ?? 0) / (1024 * 1024)).toFixed(2)}/
                        {((metrics?.memory?.heapTotal ?? 0) / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span>External Memory:</span>
                      <span className="font-mono">
                        {((metrics?.memory?.external ?? 0) / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>
              </Card3D>
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<LoadingCard title="logs section" />}>
          <LogsSection />
        </Suspense>
      </div>
    </div>
  )
}

export default function MonitoringPage() {
  return (
    <MetricsProvider>
      <MonitoringDashboard />
    </MetricsProvider>
  )
} 