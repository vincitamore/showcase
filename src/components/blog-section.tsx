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
  entities?: TweetEntities
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

          const entities = dbTweet.entities?.reduce((acc: TweetEntities, entity: any) => {
            try {
              const entityData = entity.metadata 
                ? (typeof entity.metadata === 'string'
                    ? JSON.parse(entity.metadata)
                    : entity.metadata)
                : {};
              
              switch (entity.type) {
                case 'url':
                  if (!acc.urls) acc.urls = [];
                  acc.urls.push({
                    url: entity.url,
                    expanded_url: entity.expandedUrl || entity.url,
                    display_url: entity.text || entity.url,
                    indices: entityData.indices || [0, 0],
                    title: entityData.title,
                    description: entityData.description,
                    images: entityData.images?.map((img: any) => ({
                      url: img.url,
                      width: img.width || 0,
                      height: img.height || 0
                    }))
                  });
                  break;
                case 'mention':
                  if (!acc.mentions) acc.mentions = [];
                  acc.mentions.push({
                    username: entity.text,
                    indices: entityData.indices || [0, 0]
                  });
                  break;
                case 'hashtag':
                  if (!acc.hashtags) acc.hashtags = [];
                  acc.hashtags.push({
                    tag: entity.text,
                    indices: entityData.indices || [0, 0]
                  });
                  break;
                case 'media':
                  if (!acc.media) acc.media = [];
                  acc.media.push({
                    media_key: entity.mediaKey || '',
                    type: entityData.type || 'photo',
                    url: entityData.url || entity.url,
                    preview_image_url: entityData.preview_image_url || entityData.url || entity.url,
                    width: entityData.width,
                    height: entityData.height
                  });
                  break;
              }
              return acc;
            } catch (entityError) {
              console.error('Error processing entity:', { entity, error: entityError });
              return acc;
            }
          }, {} as TweetEntities);

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
          urls: t.entities?.urls?.length || 0,
          mentions: t.entities?.mentions?.length || 0,
          hashtags: t.entities?.hashtags?.length || 0,
          media: t.entities?.media?.length || 0
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

  const renderTweetText = (tweet: Tweet) => {
    if (!tweet.text) {
      console.log('Tweet has no text, skipping render');
      return null;
    }

    // Log entity processing
    if (tweet.entities) {
      console.log('Processing entities:', {
        urls: tweet.entities.urls?.length || 0,
        mentions: tweet.entities.mentions?.length || 0,
        hashtags: tweet.entities.hashtags?.length || 0,
        media: tweet.entities.media?.length || 0
      });
    }

    const renderLink = (url: string, displayText: string, urlEntity: UrlEntity) => {
      // Check if it's a Twitter/X link
      const isTweetLink = url.match(/twitter\.com|x\.com\/\w+\/status\/(\d+)/);
      
      if (isTweetLink) {
        // Return null here since we'll handle tweet embeds in renderPreviews
        return (
          <span
            className="text-primary hover:text-primary/80 hover:underline cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            {displayText}
          </span>
        );
      }

      // For non-Twitter links, just render as text link since we'll handle previews separately
      return (
        <span
          className="text-primary hover:text-primary/80 hover:underline cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          {displayText}
        </span>
      );
    };

    const renderMention = (username: string) => (
      <span
        className="text-primary hover:text-primary/80 hover:underline cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(`https://twitter.com/${username}`, '_blank', 'noopener,noreferrer');
        }}
      >
        @{username}
      </span>
    );

    const renderHashtag = (tag: string) => (
      <span
        className="text-primary hover:text-primary/80 hover:underline cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(`https://twitter.com/hashtag/${tag}`, '_blank', 'noopener,noreferrer');
        }}
      >
        #{tag}
      </span>
    );

    const renderMedia = (media: MediaEntity[]) => {
      if (!media.length) return null;

      // If there's only one media item
      if (media.length === 1) {
        const item = media[0];
        return (
          <div className="mt-3 rounded-lg overflow-hidden bg-accent/5">
            {item.type === 'photo' && (
              <div className="relative w-full aspect-[16/9]">
                <Image
                  src={item.url || item.preview_image_url || ''}
                  alt="Tweet media"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            {(item.type === 'video' || item.type === 'animated_gif') && item.preview_image_url && (
              <div className="relative w-full aspect-[16/9] group/media">
                <Image
                  src={item.preview_image_url}
                  alt="Tweet media preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/media:opacity-100 transition-opacity">
                  <span className="text-white text-sm">
                    {item.type === 'video' ? 'Play Video' : 'View GIF'}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      }

      // If there are multiple media items
      return (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
          {media.map((item, index) => {
            if (index > 3) return null; // Only show up to 4 items
            return (
              <div 
                key={item.media_key}
                className={cn(
                  "relative bg-accent/5",
                  "aspect-square",
                  media.length === 3 && index === 0 && "col-span-2", // First item spans full width in 3-item layout
                  media.length === 1 && "col-span-2" // Single item spans full width
                )}
              >
                <Image
                  src={item.type === 'photo' ? (item.url || '') : (item.preview_image_url || '')}
                  alt="Tweet media"
                  fill
                  className="object-cover"
                  unoptimized
                />
                {(item.type === 'video' || item.type === 'animated_gif') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm">
                      {item.type === 'video' ? 'Play Video' : 'View GIF'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    // Function to process text and replace entities with clickable elements
    const processText = () => {
      if (!tweet.entities) {
        return <span>{tweet.text}</span>;
      }

      // Collect all entities and sort by their position
      const entities: Array<{
        type: 'url' | 'mention' | 'hashtag'
        indices: number[]
        render: () => JSX.Element
      }> = [
        ...(tweet.entities.urls?.map(url => ({
          type: 'url' as const,
          indices: url.indices,
          render: () => renderLink(url.expanded_url, url.display_url, url)
        })) || []),
        ...(tweet.entities.mentions?.map(mention => ({
          type: 'mention' as const,
          indices: mention.indices,
          render: () => renderMention(mention.username)
        })) || []),
        ...(tweet.entities.hashtags?.map(hashtag => ({
          type: 'hashtag' as const,
          indices: hashtag.indices,
          render: () => renderHashtag(hashtag.tag)
        })) || [])
      ].sort((a, b) => {
        // Sort by start index, if equal sort by end index
        if (a.indices[0] === b.indices[0]) {
          return b.indices[1] - a.indices[1]; // Longer entities first
        }
        return a.indices[0] - b.indices[0];
      });

      // Create a map of positions that are part of entities
      const entityPositions = new Set<number>();
      entities.forEach(entity => {
        for (let i = entity.indices[0]; i < entity.indices[1]; i++) {
          entityPositions.add(i);
        }
      });

      const segments: Array<JSX.Element | string> = [];
      let lastIndex = 0;

      entities.forEach((entity, index) => {
        const [start, end] = entity.indices;

        // Only add text before entity if it's not part of a previous entity
        if (start > lastIndex) {
          const textSegment = tweet.text.slice(lastIndex, start);
          if (textSegment.trim() && !Array.from(textSegment).some((_c, i) => entityPositions.has(lastIndex + i))) {
            segments.push(textSegment);
          }
        }

        // Only render mentions and hashtags in text, URLs will be rendered as previews
        if (entity.type !== 'url') {
          segments.push(
            <span key={`entity-${index}`} className="mx-0.5">
              {entity.render()}
            </span>
          );
        }

        lastIndex = end;
      });

      // Add any remaining text that's not part of any entity
      if (lastIndex < tweet.text.length) {
        const remainingText = tweet.text.slice(lastIndex);
        if (remainingText.trim() && !Array.from(remainingText).some((_c, i) => entityPositions.has(lastIndex + i))) {
          segments.push(remainingText);
        }
      }

      return segments;
    };

    // Function to render preview cards for non-Twitter URLs
    const renderPreviews = () => {
      if (!tweet.entities?.urls?.length) return null;

      // Separate Twitter/X links and other URLs
      const twitterLinks: UrlEntity[] = [];
      const otherLinks: UrlEntity[] = [];

      tweet.entities.urls.forEach(url => {
        if (url.expanded_url.match(/twitter\.com|x\.com\/\w+\/status\/(\d+)/)) {
          twitterLinks.push(url);
        } else if (url.images?.[0] || url.title || url.description) {
          otherLinks.push(url);
        }
      });

      return (
        <>
          {/* Render Twitter embeds first */}
          {twitterLinks.map((url, index) => (
            <div 
              key={`twitter-${url.url}-${index}`}
              className="mt-3 rounded-lg border border-border/50 overflow-hidden"
            >
              <blockquote 
                className="twitter-tweet" 
                data-conversation="none"
                data-theme="dark"
              >
                <a href={url.expanded_url}></a>
              </blockquote>
            </div>
          ))}

          {/* Then render other URL previews */}
          {otherLinks.length > 0 && (
            <div className="mt-3 space-y-3">
              {otherLinks.map((url, index) => (
                <div
                  key={`preview-${url.url}-${index}`}
                  className="rounded-lg border border-border/50 overflow-hidden hover:bg-accent/5 transition-colors cursor-pointer"
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
                  <div className="p-3">
                    {url.title && (
                      <h4 className="font-medium text-sm mb-2 line-clamp-1">
                        {url.title}
                      </h4>
                    )}
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
              ))}
            </div>
          )}
        </>
      );
    };

    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground/90 leading-relaxed">
          {processText()}
        </div>
        {/* Render media first if present */}
        {tweet.entities?.media && renderMedia(tweet.entities.media)}
        {/* Then render URL previews and embeds */}
        {renderPreviews()}
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
                  "p-3 sm:p-6",
                  "mx-1.5",
                  "w-[calc(100vw-4rem)] sm:w-[calc(100vw-8rem)] md:w-[calc(85vw-8rem)] lg:w-[32rem]",
                  "max-w-[28rem]",
                  "backdrop-blur-sm bg-background/10 hover:bg-background/20 transition-all duration-300"
                )}
                containerClassName="min-h-[20rem] sm:min-h-[22rem] rounded-lg sm:rounded-xl"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
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
