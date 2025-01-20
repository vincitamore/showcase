"use client"

import { useState, useEffect } from 'react'
import { Card3D } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { MessageSquare, Share2, Heart } from "lucide-react"

interface TweetMetrics {
  like_count?: number
  reply_count?: number
  retweet_count?: number
}

interface Tweet {
  id: string
  text: string
  created_at?: string
  public_metrics?: TweetMetrics
}

export function BlogSection() {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchTweets()
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }), // Empty test post to check auth
      })
      setIsAuthenticated(response.status !== 401)
    } catch (error) {
      setIsAuthenticated(false)
    }
  }

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/x')
      const { url } = await response.json()
      if (url) window.location.href = url
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate login. Please try again.",
        variant: "destructive",
      })
    }
  }

  const fetchTweets = async () => {
    try {
      const response = await fetch('/api/tweets')
      if (!response.ok) throw new Error('Failed to fetch tweets')
      
      const data = await response.json()
      // Ensure we have an array of tweets with required fields
      const validTweets = Array.isArray(data) ? data : []
      setTweets(validTweets)
    } catch (error) {
      console.error('Error fetching tweets:', error)
      toast({
        title: "Error",
        description: "Failed to load tweets. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const handlePost = async () => {
    if (!message.trim()) return
    setIsLoading(true)

    try {
      const response = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      })

      if (response.status === 401) {
        setIsAuthenticated(false)
        toast({
          title: "Authentication Required",
          description: "Please log in to post messages.",
          variant: "destructive",
        })
        return
      }

      if (!response.ok) throw new Error('Failed to post message')

      toast({
        title: "Success!",
        description: "Your message has been posted to X.com and the blog.",
      })

      setMessage('')
      fetchTweets() // Refresh the tweets list
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post your message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section id="blog" className="container relative mx-auto px-4 py-16 scroll-mt-16">
      <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
        Tech Thoughts
      </h2>
      
      {/* Message Composer */}
      <Card3D className="mb-8 mx-auto max-w-2xl p-6">
        <div className="space-y-4">
          {isAuthenticated ? (
            <>
              <Textarea
                placeholder="Share your tech insights..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isLoading}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handlePost} 
                  disabled={!message.trim() || isLoading}
                >
                  {isLoading ? "Posting..." : "Post to X & Blog"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">Sign in with X to post messages</p>
              <Button onClick={handleLogin}>
                Sign in with X
              </Button>
            </div>
          )}
        </div>
      </Card3D>

      {/* Tweets Display */}
      <div className="grid gap-6 mx-auto max-w-2xl">
        {tweets.map((tweet) => (
          <Card3D key={tweet.id} className="p-6">
            <p className="mb-4 text-foreground/90">{tweet.text}</p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{tweet.public_metrics?.like_count ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>{tweet.public_metrics?.reply_count ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                <span>{tweet.public_metrics?.retweet_count ?? 0}</span>
              </div>
              <span className="ml-auto">
                {tweet.created_at 
                  ? new Date(tweet.created_at).toLocaleDateString()
                  : 'Just now'
                }
              </span>
            </div>
          </Card3D>
        ))}
        {tweets.length === 0 && (
          <div className="text-center text-muted-foreground">
            No tweets to display yet.
          </div>
        )}
      </div>
    </section>
  )
} 