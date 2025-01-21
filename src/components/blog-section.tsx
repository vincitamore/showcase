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

const BlogSection = () => {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCachedTweets()
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/twitter/auth/status')
      const { isAuthenticated: authStatus } = await response.json()
      setIsAuthenticated(authStatus)
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
    }
  }

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/twitter/auth')
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

  const fetchCachedTweets = async () => {
    try {
      console.log('Fetching cached tweets from API...');
      const response = await fetch('/api/twitter/tweets');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch cached tweets:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        toast({
          title: "Error Loading Tweets",
          description: errorData.error || "Failed to load tweets. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      const data = await response.json();
      console.log('Received tweets response:', {
        hasTweets: Array.isArray(data?.tweets),
        tweetCount: data?.tweets?.length ?? 0,
        tweets: data?.tweets?.map((t: any) => ({ id: t.id, text: t.text.substring(0, 50) + '...' }))
      });
      
      if (!data.tweets || !Array.isArray(data.tweets)) {
        console.error('Invalid tweets data received:', data);
        toast({
          title: "Error",
          description: "Received invalid tweet data. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      setTweets(data.tweets);
    } catch (error) {
      console.error('Error fetching cached tweets:', error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? `Failed to load tweets: ${error.message}`
          : "Failed to load tweets. Please try again later.",
        variant: "destructive",
      });
    }
  }

  const handlePost = async () => {
    if (!message.trim()) return
    setIsLoading(true)

    try {
      const response = await fetch('/api/twitter', {
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
        description: "Your message has been posted.",
      })

      setMessage('')
      fetchCachedTweets() // Refresh the tweets list
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
        {tweets.map((tweet) => (
          <a 
            key={tweet.id}
            href={`https://x.com/i/web/status/${tweet.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative transition-all duration-200 hover:scale-[1.02]"
          >
            <Card3D className="p-6 transition-colors group-hover:bg-muted/50 h-full">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/5 dark:bg-white/5 backdrop-blur-sm rounded-xl">
                <div className="flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground shadow-sm">
                  <Share2 className="h-4 w-4" />
                  <span>View on X</span>
                </div>
              </div>
              <p className="mb-4 text-foreground/90">{tweet.text}</p>
              <div className="flex items-center gap-6 text-sm text-muted-foreground mt-auto">
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
          </a>
        ))}
        {tweets.length === 0 && (
          <div className="text-center text-muted-foreground col-span-full">
            No tweets to display yet.
          </div>
        )}
      </div>
    </section>
  )
}

export default BlogSection 