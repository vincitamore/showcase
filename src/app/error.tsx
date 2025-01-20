'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
      <p className="text-lg mb-8 text-muted-foreground">
        {error.message || 'An unexpected error occurred'}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => router.push('/')}>
          Go Home
        </Button>
        <Button variant="outline" onClick={() => reset()}>
          Try Again
        </Button>
      </div>
    </div>
  )
} 