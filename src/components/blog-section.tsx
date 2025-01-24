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
import { useTwitterEmbed } from "@/hooks/use-twitter-embed"

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

interface MentionEntity {
  username: string
  indices: number[]
}

interface HashtagEntity {
  tag: string
  indices: number[]
}

interface MediaEntity {
  media_key: string
  type: 'photo' | 'video' | 'animated_gif'
  url?: string
  preview_image_url?: string
  width?: number
  height?: number
}

interface TweetEntities {
  urls?: UrlEntity[]
  mentions?: MentionEntity[]
  hashtags?: HashtagEntity[]
  media?: MediaEntity[]
}

interface TweetMetrics {
  like_count?: number
  reply_count?: number
  retweet_count?: number
}

interface TweetEntity {
  id: string;
  type: string;
  text: string;
  url?: string;
  expandedUrl?: string;
  displayUrl?: string;
  mediaKey?: string;
  metadata: any;
}

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count: number;
    reply_count: number;
    retweet_count: number;
  };
  author?: {
    profile_image_url?: string;
    username?: string;
    name?: string;
  };
  entities?: TweetEntity[];
  referenced_tweets?: {
    type: 'quoted' | 'replied_to';
    id: string;
  }[];
}

const DEFAULT_PROFILE_IMAGE = "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"

const BlogSection = () => {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { toast } = useToast()

  // Initialize Twitter embed script
  useTwitterEmbed()

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
      
      // Enhanced debug logging
      console.log('Raw tweet response:', data);
      
      if (!data.tweets || !Array.isArray(data.tweets)) {
        console.error('Invalid tweets data received:', data);
        toast({
          title: "Error",
          description: "Received invalid tweet data. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      // Convert database tweets to TweetV2 format
      const processedTweets = data.tweets.map((dbTweet: any) => {
        try {
          const publicMetrics = dbTweet.publicMetrics 
            ? (typeof dbTweet.publicMetrics === 'string' 
                ? JSON.parse(dbTweet.publicMetrics) 
                : dbTweet.publicMetrics)
            : {
                like_count: 0,
                reply_count: 0,
                retweet_count: 0
              };

          // Convert entities directly without reducing
          const entities = dbTweet.entities?.map((entity: any) => {
            try {
              const metadata = entity.metadata 
                ? (typeof entity.metadata === 'string'
                    ? JSON.parse(entity.metadata)
                    : entity.metadata)
                : {};

              // Log entity processing for debugging
              console.log('[Tweet Processing] Processing entity:', {
                type: entity.type,
                mediaKey: entity.mediaKey,
                url: entity.url,
                metadata: metadata
              });

              return {
                id: entity.id,
                type: entity.type,
                text: entity.text,
                url: entity.url || metadata?.url,
                expandedUrl: entity.expandedUrl || metadata?.expanded_url,
                displayUrl: entity.displayUrl || metadata?.display_url,
                mediaKey: entity.mediaKey,
                metadata
              };
            } catch (entityError) {
              console.error('Error processing entity:', { entity, error: entityError });
              return null;
            }
          }).filter(Boolean);

          // Log processed entities
          console.log('[Tweet Processing] Processed entities:', {
            tweetId: dbTweet.id,
            entityCount: entities?.length || 0,
            mediaCount: entities?.filter((e: TweetEntity) => e.type === 'media').length || 0,
            urlCount: entities?.filter((e: TweetEntity) => e.type === 'url').length || 0,
            entities: entities?.map((e: TweetEntity) => ({
              type: e.type,
              text: e.text,
              mediaKey: e.mediaKey,
              url: e.url
            }))
          });

          return {
            id: dbTweet.id,
            text: dbTweet.text,
            created_at: dbTweet.createdAt,
            public_metrics: publicMetrics,
            author: {
              profile_image_url: profileConfig.profileImage,
              username: profileConfig.username,
              name: profileConfig.displayName
            },
            entities
          };
        } catch (tweetError) {
          console.error('Error processing tweet:', { tweet: dbTweet, error: tweetError });
          return null;
        }
      }).filter(Boolean) as Tweet[];
      
      // Log the processed tweets
      console.log('Processed tweets:', processedTweets.map((t: Tweet) => ({
        id: t.id,
        created_at: t.created_at,
        metrics: t.public_metrics,
        entityCounts: {
          urls: t.entities?.filter(e => e.type === 'url').length || 0,
          mentions: t.entities?.filter(e => e.type === 'mention').length || 0,
          hashtags: t.entities?.filter(e => e.type === 'hashtag').length || 0,
          media: t.entities?.filter(e => e.type === 'media').length || 0
        }
      })));
      
      setTweets(processedTweets);
    } catch (error) {
      console.error('Error fetching cached tweets:', error);
      toast({
        title: "Error",
        description: "Failed to load tweets. Please try again later.",
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

  const renderTweetText = (text: string, entities: any[]) => {
    if (!text) return null;

    console.log('[Tweet Rendering] Processing tweet text:', {
      textLength: text.length,
      entities: entities.map(e => ({
        type: e.type,
        text: e.text,
        indices: e.metadata?.indices
      }))
    });

    // Sort entities by their position in the text
    const sortedEntities = entities
      .filter(e => e.metadata?.indices)
      .sort((a, b) => {
        const aIndices = JSON.parse(typeof a.metadata === 'string' ? a.metadata : JSON.stringify(a.metadata)).indices;
        const bIndices = JSON.parse(typeof b.metadata === 'string' ? b.metadata : JSON.stringify(b.metadata)).indices;
        return aIndices[0] - bIndices[0];
      });

    // Create segments of text and entities
    const segments: JSX.Element[] = [];
    let lastIndex = 0;

    sortedEntities.forEach((entity, index) => {
      const metadata = typeof entity.metadata === 'string'
        ? JSON.parse(entity.metadata)
        : entity.metadata;

      const [start, end] = metadata.indices;

      // Add text before entity
      if (start > lastIndex) {
        segments.push(
          <span key={`text-${index}`}>
            {text.slice(lastIndex, start)}
          </span>
        );
      }

      // Add entity
      switch (entity.type) {
        case 'mention':
          segments.push(
            <span
              key={`entity-${index}`}
              className="text-primary hover:underline cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(`https://twitter.com/${entity.text}`, '_blank', 'noopener,noreferrer');
              }}
            >
              @{entity.text}
            </span>
          );
          break;
        case 'hashtag':
          segments.push(
            <span
              key={`entity-${index}`}
              className="text-primary hover:underline cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(`https://twitter.com/hashtag/${entity.text}`, '_blank', 'noopener,noreferrer');
              }}
            >
              #{entity.text}
            </span>
          );
          break;
        case 'url':
          // Skip URLs as they'll be rendered as previews
          break;
      }

      lastIndex = end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-end">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return (
      <div className="whitespace-pre-wrap break-words">
        {segments}
      </div>
    );
  }

  function formatDate(date: string | undefined) {
    if (!date) return 'Just now';
    return new Date(date).toLocaleDateString();
  }

  function formatNumber(num: number | undefined) {
    if (typeof num !== 'number') return '0';
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);
  }

  function renderMedia(entities: TweetEntity[]) {
    const mediaEntities = entities.filter(e => e.type === 'media');
    if (!mediaEntities?.length) return null;

    console.log('[Tweet Rendering] Processing media entities:', {
      count: mediaEntities.length,
      entities: mediaEntities.map(e => ({
        type: e.type,
        mediaKey: e.mediaKey,
        metadata: e.metadata
      }))
    });

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {mediaEntities.map((entity, index) => {
          const metadata = typeof entity.metadata === 'string' 
            ? JSON.parse(entity.metadata) 
            : entity.metadata;

          console.log('[Tweet Rendering] Processing media item:', {
            index,
            mediaKey: entity.mediaKey,
            metadata
          });

          // Try different paths for the image URL
          const imageUrl = metadata?.preview_image_url || metadata?.url || entity.url;
          if (!imageUrl) {
            console.warn('[Tweet Rendering] No image URL found for media entity:', {
              mediaKey: entity.mediaKey,
              metadata
            });
            return null;
          }

          const width = metadata?.width || 0;
          const height = metadata?.height || 0;
          const aspectRatio = width && height ? width / height : 16 / 9;

          return (
            <div 
              key={entity.mediaKey || index}
              className="relative overflow-hidden rounded-lg"
              style={{
                width: '100%',
                maxWidth: '400px',
                aspectRatio: String(aspectRatio)
              }}
            >
              <Image
                src={imageUrl}
                alt={metadata?.alt_text || 'Tweet media'}
                fill
                className="object-cover"
                sizes="(max-width: 400px) 100vw, 400px"
              />
            </div>
          );
        })}
      </div>
    );
  }

  function renderUrlPreviews(entities: TweetEntity[]) {
    // Deduplicate URL entities by their expanded URL
    const uniqueUrlEntities = entities
      .filter(e => e.type === 'url')
      .reduce((acc: TweetEntity[], entity) => {
        const exists = acc.find(e => e.expandedUrl === entity.expandedUrl);
        if (!exists) acc.push(entity);
        return acc;
      }, []);

    if (!uniqueUrlEntities?.length) return null;

    console.log('[Tweet Rendering] Processing unique URL entities:', {
      originalCount: entities.filter(e => e.type === 'url').length,
      uniqueCount: uniqueUrlEntities.length,
      entities: uniqueUrlEntities.map(e => ({
        type: e.type,
        url: e.url,
        expandedUrl: e.expandedUrl
      }))
    });

    return (
      <div className="mt-2 space-y-2">
        {uniqueUrlEntities.map((entity, index) => {
          const metadata = typeof entity.metadata === 'string'
            ? JSON.parse(entity.metadata)
            : entity.metadata;

          // Skip if no preview data or if it's a Twitter URL (will be embedded)
          if (
            (!metadata?.title && !metadata?.description && !metadata?.images?.length) ||
            (entity.expandedUrl && entity.expandedUrl.includes('twitter.com'))
          ) {
            return null;
          }

          return (
            <div
              key={entity.expandedUrl || entity.url || index}
              className="rounded-lg border overflow-hidden hover:bg-accent/5 transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(entity.expandedUrl || entity.url, '_blank', 'noopener,noreferrer');
              }}
            >
              {metadata.images?.[0]?.url && (
                <div className="relative w-full h-[160px] bg-accent/5">
                  <Image
                    src={metadata.images[0].url}
                    alt={metadata.title || 'Link preview'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 400px) 100vw, 400px"
                  />
                </div>
              )}
              <div className="p-3">
                {metadata.title && (
                  <h4 className="font-medium text-sm mb-2 line-clamp-1">
                    {metadata.title}
                  </h4>
                )}
                {metadata.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {metadata.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                  <ExternalLink className="h-3 w-3" />
                  {new URL(entity.expandedUrl || entity.url || '').hostname}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const renderTweet = (tweet: Tweet) => {
    const entities = tweet.entities || [];
    
    // Log entity processing
    console.log('[Tweet Rendering] Processing tweet:', {
      tweetId: tweet.id,
      totalEntities: entities.length,
      entityTypes: entities.map(e => e.type),
      mediaEntities: entities.filter(e => e.type === 'media'),
      urlEntities: entities.filter(e => e.type === 'url')
    });

    // Get unique Twitter URLs for embedding
    const twitterUrls = entities
      .filter(e => e.type === 'url' && e.expandedUrl?.includes('twitter.com/'))
      .reduce((acc: string[], entity) => {
        const url = entity.expandedUrl;
        if (url && !acc.includes(url)) acc.push(url);
        return acc;
      }, []);

    // Only render one Twitter embed per tweet
    const primaryTwitterUrl = twitterUrls[0];

    return (
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-4">
          <div className="text-sm">
            {renderTweetText(tweet.text, entities)}
            {renderMedia(entities)}
            {renderUrlPreviews(entities)}
            {primaryTwitterUrl && (
              <div 
                key={`${tweet.id}-embed`}
                className="mt-2 rounded-lg border border-border/50 overflow-hidden"
              >
                <blockquote 
                  className="twitter-tweet" 
                  data-conversation="none"
                  data-theme="dark"
                >
                  <a href={primaryTwitterUrl}></a>
                </blockquote>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>{formatDate(tweet.created_at)}</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              <span>{formatNumber(tweet.public_metrics?.like_count)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Repeat2 className="h-4 w-4" />
              <span>{formatNumber(tweet.public_metrics?.retweet_count)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span>{formatNumber(tweet.public_metrics?.reply_count)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section id="blog" className="relative w-full max-w-[100vw] overflow-hidden px-1 sm:px-4 py-8 sm:py-16 scroll-mt-16">
      <div className="mb-8 sm:mb-12 text-center">
        <h2 className="text-3xl font-bold mb-4">My Thoughts</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Sharing insights and experiences from my journey in software development,
          network engineering, and cybersecurity; plus a good bit of poasting.
        </p>
      </div>

      {/* Message Composer */}
      {/*
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
      */}
      {/* Tweets Display */}
      {tweets && tweets.length > 0 && (
        <div className="mt-8 w-full">
          <h3 className="text-lg sm:text-xl font-semibold mb-4">Recent Posts</h3>
          <Carousel 
            className="w-full overflow-visible mx-auto pb-4" 
            opts={{ 
              loop: true, 
              align: "center",
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
                  "p-3 sm:p-4",
                  "mx-1.5",
                  "w-[calc(100vw-4rem)] sm:w-[calc(100vw-8rem)] md:w-[calc(85vw-8rem)] lg:w-[32rem]",
                  "max-w-[28rem]",
                  "backdrop-blur-sm bg-background/10 hover:bg-background/20 transition-all duration-300",
                  "flex flex-col h-full"
                )}
                containerClassName="min-h-[12rem] sm:min-h-[14rem] rounded-lg sm:rounded-xl"
              >
                <div className="flex flex-col h-full">
                  {/* Header section with fixed height */}
                  <div className="flex items-start justify-between h-12 mb-2">
                    <div className="flex items-center gap-2">
                      <Image
                        src={profileConfig.profileImage}
                        alt={profileConfig.username}
                        width={32}
                        height={32}
                        className="rounded-full"
                        unoptimized
                      />
                      <div>
                        <p className="font-medium text-sm leading-tight">{profileConfig.displayName}</p>
                        <p className="text-xs text-muted-foreground leading-tight">@{profileConfig.username}</p>
                      </div>
                    </div>
                    <span 
                      className="text-primary hover:text-primary/80 transition-colors text-lg font-bold"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCardClick(tweet.id)
                      }}
                    >
                      𝕏
                    </span>
                  </div>

                  {/* Content section with dynamic height */}
                  <div className="flex-1 overflow-hidden">
                    {renderTweet(tweet)}
                    {tweet.referenced_tweets?.map((ref) => (
                      <div 
                        key={ref.id}
                        className="mt-2 rounded-lg border border-border/50 overflow-hidden"
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
                  </div>

                  {/* Footer section with fixed height */}
                  <div className="h-8 mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> {tweet.public_metrics?.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {tweet.public_metrics?.reply_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-3.5 w-3.5" /> {tweet.public_metrics?.retweet_count ?? 0}
                    </span>
                    <time className="ml-auto text-[10px]">
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
