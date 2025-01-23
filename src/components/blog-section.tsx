"use client"

import { useState, useEffect } from 'react'
import { Card3D } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { MessageSquare, Share2, Heart, Twitter, MessageCircle, Repeat2 } from "lucide-react"
import { ChatInput } from "@/components/chat-input"
import { Carousel } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"
import Image from "next/image"

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
  author: {
    profile_image_url: string
    username: string
    name: string
  }
}

const DEFAULT_PROFILE_IMAGE = "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"

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
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold mb-4">Tech Thoughts</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Sharing insights and experiences from my journey in software development,
          network engineering, and cybersecurity.
        </p>
      </div>

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
      {tweets && tweets.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-4">Recent Posts</h3>
          <Carousel 
            className="w-full max-w-[100rem] mx-auto" 
            opts={{ 
              loop: true, 
              align: "start",
              containScroll: "trimSnaps",
              dragFree: false
            }}
          >
            {tweets.map((tweet, index) => (
              <Card3D
                key={tweet.id}
                className={cn(
                  "group cursor-pointer",
                  "p-4 sm:p-6",
                  "mx-2 sm:mx-4",
                  "w-[calc(100vw-3rem)] sm:w-[calc(100vw-8rem)] md:w-[calc(85vw-8rem)] lg:w-[40rem]",
                  "max-h-[calc(100vh-12rem)]",
                  "backdrop-blur-sm bg-background/10 hover:bg-background/20 transition-all duration-300"
                )}
                containerClassName="min-h-[12rem] sm:min-h-[14rem] rounded-lg sm:rounded-xl overflow-y-auto"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Image
                        src={tweet.author?.profile_image_url || DEFAULT_PROFILE_IMAGE}
                        alt={tweet.author?.username || 'Profile'}
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                      />
                      <div>
                        <p className="font-medium text-sm">{tweet.author?.name || 'Anonymous'}</p>
                        <p className="text-xs text-muted-foreground">@{tweet.author?.username || 'user'}</p>
                      </div>
                    </div>
                    <a 
                      href={tweet.author?.username ? `https://twitter.com/${tweet.author.username}/status/${tweet.id}` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <Twitter className="h-5 w-5" />
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground/90 leading-relaxed mb-4">{tweet.text}</p>
                  <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" /> {tweet.public_metrics?.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" /> {tweet.public_metrics?.reply_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-4 w-4" /> {tweet.public_metrics?.retweet_count ?? 0}
                    </span>
                    <time className="ml-auto">
                      {tweet.created_at 
                        ? new Date(tweet.created_at).toLocaleDateString()
                        : 'Just now'
                      }
                    </time>
                  </div>
                </div>
              </Card3D>
            ))}
          </Carousel>
        </div>
      )}
    </section>
  )
}

export default BlogSection 
