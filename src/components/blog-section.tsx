"use client"

import { useState, useEffect } from 'react'
import { Card3D } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { MessageSquare, Share2, Heart, MessageCircle, Repeat2, ExternalLink } from "lucide-react"
import { ChatInput } from "@/components/chat-input"
import { Carousel } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { profileConfig } from "@/lib/profile-config"

interface UrlEntity {
  url: string
  expanded_url: string
  display_url: string
  indices: number[]
  title?: string
  description?: string
  unwound_url?: string
  images?: Array<{
    url: string
    width: number
    height: number
  }>
}

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
  author?: {
    profile_image_url?: string
    username?: string
    name?: string
  }
  entities?: {
    urls?: UrlEntity[]
  }
  referenced_tweets?: {
    type: 'quoted' | 'replied_to'
    id: string
  }[]
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
      console.log('Checking authentication status...');
      const response = await fetch('/api/twitter/auth/status')
      const { isAuthenticated: authStatus } = await response.json()
      console.log('Auth status:', { authStatus });
      setIsAuthenticated(authStatus)
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
    }
  }

  const handleLogin = async () => {
    try {
      console.log('Initiating Twitter login...');
      const response = await fetch('/api/twitter/auth')
      const { url } = await response.json()
      console.log('Received auth URL:', url);
      if (url) window.location.href = url
    } catch (error) {
      console.error('Login failed:', error)
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
    console.log('Attempting to post tweet:', { message });

    try {
      const response = await fetch('/api/twitter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      })

      console.log('Post response status:', response.status);

      if (response.status === 401) {
        console.log('User not authenticated, showing login prompt');
        setIsAuthenticated(false)
        toast({
          title: "Authentication Required",
          description: "Please log in to post messages.",
          variant: "destructive",
        })
        return
      }

      if (!response.ok) throw new Error('Failed to post message')

      console.log('Tweet posted successfully');
      toast({
        title: "Success!",
        description: "Your message has been posted.",
      })

      setMessage('')
      fetchCachedTweets()
    } catch (error) {
      console.error('Error posting tweet:', error)
      toast({
        title: "Error",
        description: "Failed to post your message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCardClick = (tweetId: string) => {
    window.open(`https://twitter.com/${profileConfig.username}/status/${tweetId}`, '_blank', 'noopener,noreferrer')
  }

  const renderTweetText = (tweet: Tweet) => {
    console.log('Rendering tweet:', {
      id: tweet.id,
      text: tweet.text,
      hasEntities: !!tweet.entities,
      urlCount: tweet.entities?.urls?.length || 0,
      entities: tweet.entities
    });

    if (!tweet.text) {
      console.log('Tweet has no text, skipping render');
      return null;
    }

    const renderLink = (url: string, displayText: string) => (
      <span
        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
      >
        {displayText}
        <ExternalLink className="h-3 w-3 inline-block" />
      </span>
    );

    // Function to process text and replace URLs with clickable links
    const processText = () => {
      if (!tweet.entities?.urls?.length) {
        console.log('No URLs to process in tweet');
        return <span>{tweet.text}</span>;
      }

      console.log('Processing URLs in tweet:', {
        urlCount: tweet.entities.urls.length,
        urls: tweet.entities.urls.map(u => u.expanded_url)
      });

      const segments: Array<JSX.Element | string> = [];
      let lastIndex = 0;

      // Sort URLs by their position in the text
      const sortedUrls = [...tweet.entities.urls].sort(
        (a, b) => (a.indices[0] || 0) - (b.indices[0] || 0)
      );

      sortedUrls.forEach((urlEntity, index) => {
        const start = urlEntity.indices[0];
        const end = urlEntity.indices[1];

        if (typeof start === 'number' && typeof end === 'number') {
          // Add text before the URL
          if (start > lastIndex) {
            segments.push(tweet.text.slice(lastIndex, start));
          }

          // Add the URL as a clickable link
          segments.push(
            <span key={`link-${index}`} className="mx-1">
              {renderLink(urlEntity.expanded_url, urlEntity.display_url)}
            </span>
          );

          lastIndex = end;
        }
      });

      // Add any remaining text
      if (lastIndex < tweet.text.length) {
        segments.push(tweet.text.slice(lastIndex));
      }

      return segments;
    };

    // Function to render preview cards for non-Twitter URLs
    const renderPreviews = () => {
      if (!tweet.entities?.urls) {
        console.log('No URLs available for preview cards');
        return null;
      }

      const previewUrls = tweet.entities.urls
        .filter(url => !url.expanded_url.includes('twitter.com') && !url.expanded_url.includes('x.com'));

      console.log('Rendering preview cards:', {
        totalUrls: tweet.entities.urls.length,
        previewableUrls: previewUrls.length,
        urls: previewUrls.map(u => ({
          url: u.expanded_url,
          hasImage: !!u.images?.[0],
          title: u.title
        }))
      });

      return previewUrls.map((url, index) => (
        <div
          key={`preview-${index}`}
          className="mt-3 rounded-lg border border-border/50 overflow-hidden hover:bg-accent/5 transition-colors cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(url.expanded_url, '_blank', 'noopener,noreferrer');
          }}
        >
          {url.images?.[0] && (
            <div className="relative w-full h-[160px] bg-accent/5">
              <Image
                src={url.images[0].url}
                alt={url.title || 'Link preview'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="p-4">
            <h4 className="font-medium text-sm mb-2 line-clamp-1">
              {url.title || new URL(url.expanded_url).hostname}
            </h4>
            {url.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {url.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <ExternalLink className="h-3 w-3" />
              {new URL(url.expanded_url).hostname}
            </div>
          </div>
        </div>
      ));
    };

    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground/90 leading-relaxed">
          {processText()}
        </div>
        {renderPreviews()}
      </div>
    );
  };

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
            className="w-full max-w-[100rem] mx-auto pb-4" 
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
                onClick={() => handleCardClick(tweet.id)}
                className={cn(
                  "group cursor-pointer",
                  "p-4 sm:p-6",
                  "mx-2 sm:mx-4",
                  "w-[calc(100vw-2rem)] sm:w-[calc(100vw-6rem)] md:w-[calc(85vw-6rem)] lg:w-[32rem]",
                  "backdrop-blur-sm bg-background/10 hover:bg-background/20 transition-all duration-300"
                )}
                containerClassName="min-h-[16rem] sm:min-h-[18rem] rounded-lg sm:rounded-xl"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Image
                        src={profileConfig.profileImage}
                        alt={profileConfig.username}
                        width={40}
                        height={40}
                        className="rounded-full"
                        unoptimized
                      />
                      <div>
                        <p className="font-medium text-sm">{profileConfig.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{profileConfig.username}</p>
                      </div>
                    </div>
                    <span 
                      className="text-primary hover:text-primary/80 transition-colors text-xl font-bold"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCardClick(tweet.id)
                      }}
                    >
                      𝕏
                    </span>
                  </div>
                  {renderTweetText(tweet)}
                  {tweet.referenced_tweets?.map((ref) => (
                    <div 
                      key={ref.id}
                      className="mb-4 rounded-lg border border-border/50 overflow-hidden"
                    >
                      <blockquote 
                        className="twitter-tweet" 
                        data-conversation="none"
                        data-theme="dark"
                      >
                        <a href={`https://twitter.com/x/status/${ref.id}`}></a>
                      </blockquote>
                    </div>
                  ))}
                  <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Heart className="h-4 w-4" /> {tweet.public_metrics?.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" /> {tweet.public_metrics?.reply_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1.5">
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
