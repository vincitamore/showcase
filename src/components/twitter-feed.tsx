"use client"

import * as React from "react"
import { useTwitterEmbed } from "@/hooks/use-twitter-embed"
import { ErrorBoundary } from "@/components/error-boundary"
import { AlertCircle } from "lucide-react"

// Add Twitter widget type declaration
declare global {
  interface Window {
    twttr?: any
  }
}

interface TwitterFeedProps {
  username: string
  className?: string
}

function BaseTwitterFeed({ username, className }: TwitterFeedProps) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  
  useTwitterEmbed()

  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Check if Twitter widget loaded successfully
      if (!window.twttr) {
        setError(new Error("Failed to load Twitter feed"))
      }
      setIsLoading(false)
    }, 3000) // Give reasonable time for widget to load

    return () => clearTimeout(timer)
  }, [])

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] space-y-2 rounded-lg border bg-background">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load Twitter feed</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 rounded-lg border bg-background">
        <div className="h-12 w-full bg-muted animate-pulse rounded" />
        <div className="h-32 w-full bg-muted animate-pulse rounded" />
        <div className="h-12 w-3/4 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className={className}>
      <a
        className="twitter-timeline"
        data-height="600"
        data-theme="light"
        href={`https://twitter.com/${username}`}
      >
        Tweets by {username}
      </a>
    </div>
  )
}

export function TwitterFeed(props: TwitterFeedProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 flex flex-col items-center justify-center min-h-[200px] space-y-2 rounded-lg border bg-background">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Something went wrong loading the Twitter feed
          </p>
        </div>
      }
    >
      <BaseTwitterFeed {...props} />
    </ErrorBoundary>
  )
} 
