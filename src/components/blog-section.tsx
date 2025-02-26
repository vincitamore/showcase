"use client"

import { useState, useEffect } from 'react'
import { Card3D } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { MessageSquare, Share2, Heart, MessageCircle, Repeat2, ExternalLink } from "lucide-react"
import { Carousel } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { profileConfig } from "@/lib/profile-config"
import { useTwitterEmbed } from "@/hooks/use-twitter-embed"
import { performance } from '@/lib/performance'
import { 
  isShortUrl, 
  formatDisplayUrl,
  detectMentions,
  detectHashtags,
  detectUrls,
  DetectedEntity
} from '@/lib/url-utils'
import React from 'react'

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
  tweetId: string;
  type: 'url' | 'mention' | 'hashtag' | 'media';
  text: string;
  url?: string;
  expandedUrl?: string;
  displayUrl?: string;
  mediaKey?: string;
  metadata?: any;
  indices?: [number, number];
}

// Combined type for entities that can be either TweetEntity or DetectedEntity
type EntityType = TweetEntity | DetectedEntity;

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
  const [isPosting, setIsPosting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [expandedTweets, setExpandedTweets] = useState<Record<string, boolean>>({})
  const [isLoadingUrlPreviews, setIsLoadingUrlPreviews] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [urlEntitiesMap, setUrlEntitiesMap] = useState<Record<string, TweetEntity[]>>({})

  // Initialize Twitter embed script
  const { loadTwitterWidgets, forceWidgetReload } = useTwitterEmbed()

  useEffect(() => {
    fetchCachedTweets()
    checkAuth()
    
    // Return empty cleanup function
    return () => {};
  }, [])

  // Add a new useEffect to trigger Twitter widget loading after tweets are rendered
  useEffect(() => {
    if (tweets.length > 0) {
      console.log('[Tweet Rendering] Triggering Twitter widget loading after tweets render');
      
      // Give time for the DOM to update
      const timer = setTimeout(() => {
        loadTwitterWidgets();
        
        // Add a second load after a longer delay to catch any missed embeds
        // but only do this once, not repeatedly
        const secondTimer = setTimeout(() => {
          console.log('[Tweet Rendering] Performing final widget reload check');
          forceWidgetReload();
          
          // After this final reload, hide any remaining loading indicators
          setTimeout(() => {
            document.querySelectorAll('.tweet-embed-loading').forEach(el => {
              el.classList.add('hidden');
            });
          }, 2000);
        }, 5000);
        
        return () => {
          clearTimeout(timer);
          clearTimeout(secondTimer);
        };
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // Return an empty cleanup function when tweets.length is 0
    return () => {};
  }, [tweets, loadTwitterWidgets, forceWidgetReload]);

  // Handle URL preview loading states at the component level
  useEffect(() => {
    // Create a map of all unique URL entities across all tweets
    const allUrlEntities: Record<string, TweetEntity[]> = {};
    
    tweets.forEach(tweet => {
      const entities = tweet.entities || [];
      // Get unique URL entities for this tweet
      const uniqueUrlEntities = entities
        .filter(e => e.type === 'url' && e.expandedUrl) 
        .filter(e => !(e.expandedUrl?.includes('twitter.com') || e.expandedUrl?.includes('x.com')))
        .reduce((acc: TweetEntity[], entity) => {
          const exists = acc.find(e => e.expandedUrl === entity.expandedUrl);
          if (!exists) acc.push(entity);
          return acc;
        }, []);
      
      if (uniqueUrlEntities.length > 0) {
        allUrlEntities[tweet.id] = uniqueUrlEntities;
      }
    });
    
    setUrlEntitiesMap(allUrlEntities);
    
    // Set loading states for all URL entities
    const loadingStates: Record<string, boolean> = {};
    
    Object.values(allUrlEntities).flat().forEach(entity => {
      const key = entity.expandedUrl || entity.url || entity.id;
      if (key) loadingStates[key] = true;
    });
    
    if (Object.keys(loadingStates).length > 0) {
      setIsLoadingUrlPreviews(loadingStates);
      
      // Simulate loading completion
      const timer = setTimeout(() => {
        setIsLoadingUrlPreviews({});
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // Return empty cleanup function if no loading states
    return () => {};
  }, [tweets]);

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
      performance.start('tweet_processing', { operation: 'fetch_tweets' });
      const response = await fetch('/api/twitter/tweets');
      const data = await response.json();

      if (!data.tweets?.length) {
        performance.end('tweet_processing', { error: 'no_tweets' });
        setError('No tweets available');
        return;
      }

      console.log('[Tweet Rendering DEBUG] Raw tweets from API:', {
        count: data.tweets.length,
        firstTweet: data.tweets[0] ? {
          id: data.tweets[0].id,
          text: data.tweets[0].text ? data.tweets[0].text.substring(0, 50) + '...' : 'No text',
          entitiesCount: data.tweets[0].entities?.length || 0
        } : 'No tweets'
      });

      // Log the raw tweet dates for debugging
      console.log('[Tweet Rendering] Raw tweet dates:', 
        data.tweets.map((t: any) => ({
          id: t.id,
          createdAt: t.createdAt,
          parsedDate: t.createdAt ? new Date(t.createdAt).toISOString() : null
        }))
      );

      // Log detailed entity information for debugging
      console.log('[Tweet Rendering DEBUG] Detailed entity information:', 
        data.tweets.map((t: any) => ({
          id: t.id,
          entitiesCount: t.entities?.length || 0,
          entities: t.entities?.map((e: any) => ({
            id: e.id,
            type: e.type,
            text: e.text,
            url: e.url,
            expandedUrl: e.expandedUrl,
            displayUrl: e.displayUrl,
            mediaKey: e.mediaKey,
            metadataType: typeof e.metadata,
            metadataPreview: typeof e.metadata === 'string' 
              ? e.metadata.substring(0, 100) + '...' 
              : JSON.stringify(e.metadata).substring(0, 100) + '...'
          }))
        }))
      );

      // Process tweets
      const processedTweets = await Promise.all(data.tweets.map(async (dbTweet: any) => {
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
              performance.end('tweet_processing', { 
                error: 'entity_processing_error',
                entityId: entity.id 
              });
              return null;
            }
          }).filter(Boolean);

          const processedTweet = {
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

          console.log('[Tweet Rendering DEBUG] Processed tweet:', {
            id: processedTweet.id,
            textLength: processedTweet.text?.length || 0,
            entitiesCount: processedTweet.entities?.length || 0
          });

          return processedTweet;
        } catch (tweetError) {
          console.error('[Tweet Rendering ERROR] Error processing tweet:', tweetError);
          performance.end('tweet_processing', { 
            error: 'tweet_processing_error',
            tweetId: dbTweet.id 
          });
          return null;
        }
      }));

      // Filter out null values and set tweets
      const validTweets = processedTweets.filter(Boolean);
      
      console.log('[Tweet Rendering DEBUG] Final processed tweets:', {
        count: validTweets.length,
        firstTweet: validTweets[0] ? {
          id: validTweets[0].id,
          textLength: validTweets[0].text?.length || 0,
          entitiesCount: validTweets[0].entities?.length || 0
        } : 'No valid tweets'
      });
      
      performance.end('tweet_processing', { 
        processed_count: processedTweets.length,
        valid_count: validTweets.length 
      });
      setTweets(validTweets);
      
      // Trigger Twitter widget loading after tweets are rendered
      setTimeout(() => {
        console.log('[Tweet Rendering] Initial widget load after fetching tweets');
        loadTwitterWidgets();
        
        // No need for additional forced reloads here since the useEffect will handle it
      }, 1000);
    } catch (error) {
      console.error('[Tweet Rendering ERROR] Error fetching tweets:', error);
      performance.end('tweet_processing', { error: 1 });
      toast({
        title: "Error",
        description: "Failed to load tweets. Please try again later.",
        variant: "destructive",
      });
    }
  }

  const handlePost = async () => {
    if (!message.trim()) return
    setIsPosting(true)
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
      setIsPosting(false)
    }
  }

  const handleCardClick = (tweetId: string) => {
    window.open(`https://x.com/${profileConfig.username}/status/${tweetId}`, '_blank', 'noopener,noreferrer')
  }

  const toggleTweetExpansion = (tweetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTweets(prev => ({
      ...prev,
      [tweetId]: !prev[tweetId]
    }));
  };

  // Memoize the renderTweetText function to prevent unnecessary re-renders
  const renderTweetText = React.useCallback((text: string, entities: TweetEntity[]) => {
    console.log('[Tweet Rendering DEBUG] renderTweetText called:', {
      textLength: text?.length || 0,
      textPreview: text ? (text.substring(0, 50) + (text.length > 50 ? '...' : '')) : 'No text',
      entitiesCount: entities?.length || 0,
      entitiesTypes: entities?.map(e => e.type) || []
    });

    if (!text) {
      console.error('[Tweet Rendering ERROR] No text provided to renderTweetText');
      return <div className="text-red-500">Error: No tweet text available</div>;
    }

    // If no entities are provided or the array is empty, just return the plain text
    if (!entities || entities.length === 0) {
      console.log('[Tweet Rendering DEBUG] No entities provided, returning plain text');
      return <div className="whitespace-pre-wrap break-words">{text}</div>;
    }

    // Create fallback entities if none are provided
    let enhancedEntities: EntityType[] = [...(entities || [])];
    
    // Check if we have mention entities, if not, detect them
    if (!enhancedEntities.some(e => e.type === 'mention')) {
      console.log('[Tweet Rendering DEBUG] No mention entities found, detecting mentions');
      const detectedMentions = detectMentions(text);
      console.log('[Tweet Rendering DEBUG] Detected mentions:', {
        count: detectedMentions.length,
        mentions: detectedMentions.map(m => m.text)
      });
      enhancedEntities = [...enhancedEntities, ...detectedMentions];
    }
    
    // Check if we have hashtag entities, if not, detect them
    if (!enhancedEntities.some(e => e.type === 'hashtag')) {
      console.log('[Tweet Rendering DEBUG] No hashtag entities found, detecting hashtags');
      const detectedHashtags = detectHashtags(text);
      console.log('[Tweet Rendering DEBUG] Detected hashtags:', {
        count: detectedHashtags.length,
        hashtags: detectedHashtags.map(h => h.text)
      });
      enhancedEntities = [...enhancedEntities, ...detectedHashtags];
    }
    
    // Check if we have URL entities, if not, detect them
    if (!enhancedEntities.some(e => e.type === 'url')) {
      console.log('[Tweet Rendering DEBUG] No URL entities found, detecting URLs');
      const detectedUrls = detectUrls(text);
      console.log('[Tweet Rendering DEBUG] Detected URLs:', {
        count: detectedUrls.length,
        urls: detectedUrls.map(u => ({
          text: u.text,
          expandedUrl: u.expandedUrl,
          displayUrl: u.displayUrl
        }))
      });
      enhancedEntities = [...enhancedEntities, ...detectedUrls];
    }

    console.log('[Tweet Rendering DEBUG] Enhanced entities:', {
      originalCount: entities?.length || 0,
      enhancedCount: enhancedEntities.length,
      types: enhancedEntities.map(e => e.type)
    });

    // Sort entities by their position in the text
    const sortedEntities = enhancedEntities
      .filter(e => e.metadata?.indices)
      .sort((a, b) => {
        try {
          const aIndices = Array.isArray(a.metadata.indices) 
            ? a.metadata.indices 
            : JSON.parse(typeof a.metadata === 'string' ? a.metadata : JSON.stringify(a.metadata)).indices;
          
          const bIndices = Array.isArray(b.metadata.indices)
            ? b.metadata.indices
            : JSON.parse(typeof b.metadata === 'string' ? b.metadata : JSON.stringify(b.metadata)).indices;
          
          return aIndices[0] - bIndices[0];
        } catch (error) {
          console.error('[Tweet Rendering ERROR] Error sorting entities:', error);
          return 0; // Default to no change in order if there's an error
        }
      });

    console.log('[Tweet Rendering DEBUG] Sorted entities:', {
      sortedCount: sortedEntities.length,
      sortedEntities: sortedEntities.map(e => ({
        type: e.type,
        text: e.text,
        indices: e.metadata?.indices
      }))
    });

    // Create segments of text and entities
    const segments: JSX.Element[] = [];
    let lastIndex = 0;

    // If we have no entities after sorting, just return the plain text
    if (sortedEntities.length === 0) {
      console.log('[Tweet Rendering DEBUG] No sorted entities, returning plain text');
      return <div className="whitespace-pre-wrap break-words">{text}</div>;
    }

    sortedEntities.forEach((entity, index) => {
      try {
        // Get indices safely, handling different possible formats
        const metadata = typeof entity.metadata === 'string'
          ? JSON.parse(entity.metadata)
          : entity.metadata;
        
        const indices = Array.isArray(metadata.indices) 
          ? metadata.indices 
          : (metadata.indices ? JSON.parse(JSON.stringify(metadata.indices)) : [0, 0]);
        
        const [start, end] = indices;

        console.log(`[Tweet Rendering DEBUG] Processing entity ${index}:`, {
          type: entity.type,
          text: entity.text,
          start,
          end,
          lastIndex
        });

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
                  window.open(`https://x.com/${entity.text}`, '_blank', 'noopener,noreferrer');
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
                  window.open(`https://x.com/hashtag/${entity.text}`, '_blank', 'noopener,noreferrer');
                }}
              >
                #{entity.text}
              </span>
            );
            break;
          case 'url':
            // For URLs, we'll render them inline if they're not Twitter URLs
            // Twitter URLs will be rendered as embeds separately
            if (entity.expandedUrl) {
              // Check if it's a shortened URL (t.co, bit.ly, etc.)
              const isShortened = isShortUrl(entity.text || '');
              
              // Hide shortened URLs completely in the rendered text
              if (isShortened) {
                // Skip rendering the URL text completely
                break;
              }
              
              // For regular URLs, show them as clickable links
              segments.push(
                <span
                  key={`entity-${index}`}
                  className="text-primary hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(entity.expandedUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {entity.displayUrl || entity.text}
                </span>
              );
            } else {
              // If no expanded URL, use the original text as a fallback
              segments.push(
                <span
                  key={`entity-${index}`}
                  className="text-primary hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(entity.text, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {formatDisplayUrl(entity.text)}
                </span>
              );
            }
            break;
          default:
            // For unknown entity types, just render the text
            segments.push(
              <span key={`entity-${index}`}>
                {entity.text}
              </span>
            );
        }

        lastIndex = end;
      } catch (error) {
        console.error(`[Tweet Rendering ERROR] Error processing entity ${index}:`, error);
        // Skip this entity and continue with the next one
      }
    });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-end">
          {text.slice(lastIndex)}
        </span>
      );
    }

    console.log('[Tweet Rendering DEBUG] Final segments:', {
      segmentsCount: segments.length
    });

    // If we somehow ended up with no segments, return the plain text as a fallback
    if (segments.length === 0) {
      console.warn('[Tweet Rendering WARN] No segments created, falling back to plain text');
      return <div className="whitespace-pre-wrap break-words">{text}</div>;
    }

    return (
      <div className="whitespace-pre-wrap break-words">
        {segments}
      </div>
    );
  }, []);

  function formatDate(date: string | undefined) {
    if (!date) return 'Just now';
    
    try {
      // Try to parse the date
      const tweetDate = new Date(date);
      const now = new Date();
      
      // Check if the date is valid
      if (isNaN(tweetDate.getTime())) {
        console.warn('[Tweet Rendering] Invalid date format:', date);
        return 'Unknown date';
      }
      
      // Check if the date is in the future (which would be an error)
      if (tweetDate > now) {
        console.warn('[Tweet Rendering] Future date detected:', date);
        return 'Just now';
      }
      
      // Calculate time difference in milliseconds
      const diffMs = now.getTime() - tweetDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      // Format based on how old the tweet is
      if (diffMinutes < 60) {
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        // For older tweets, show the actual date in a more readable format
        return tweetDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch (error) {
      console.error('[Tweet Rendering] Error formatting date:', error);
      return 'Unknown date';
    }
  }

  function formatNumber(num: number | undefined) {
    if (typeof num !== 'number') return '0';
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);
  }

  // Memoize the renderMedia function to prevent unnecessary re-renders
  const renderMedia = React.useCallback((entities: TweetEntity[]) => {
    const mediaEntities = entities.filter(e => e.type === 'media');
    if (!mediaEntities?.length) return null;

    console.log('[Tweet Rendering] Processing media entities:', {
      count: mediaEntities.length,
      entities: mediaEntities.map(e => ({
        type: e.type,
        mediaKey: e.mediaKey,
        metadata: e.metadata,
        url: e.url,
        expandedUrl: e.expandedUrl
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
            metadata,
            url: entity.url,
            expandedUrl: entity.expandedUrl
          });

          // Try different paths for the image URL in order of preference
          const imageUrl = entity.expandedUrl || // Direct image URL
                          metadata?.direct_url || // Fallback to stored direct URL
                          metadata?.preview_image_url || // Then preview image
                          metadata?.url || // Then regular URL
                          entity.url; // Finally entity URL

          if (!imageUrl) {
            console.warn('[Tweet Rendering] No image URL found for media entity:', {
              mediaKey: entity.mediaKey,
              metadata,
              entity
            });
            return null;
          }

          const width = metadata?.width || 0;
          const height = metadata?.height || 0;
          const aspectRatio = width && height ? width / height : 16 / 9;

          return (
            <div 
              key={entity.mediaKey || index}
              className="relative overflow-hidden rounded-lg cursor-pointer"
              style={{
                width: '100%',
                maxWidth: '400px',
                aspectRatio: String(aspectRatio)
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(imageUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              <Image
                src={imageUrl}
                alt={metadata?.alt_text || 'Tweet media'}
                fill
                className="object-cover hover:opacity-90 transition-opacity"
                sizes="(max-width: 400px) 100vw, 400px"
              />
            </div>
          );
        })}
      </div>
    );
  }, []);

  // Memoize the renderUrlPreviews function to prevent unnecessary re-renders
  const renderUrlPreviews = React.useCallback((entities: TweetEntity[], tweetId?: string) => {
    // Add detailed logging at the start of the function
    console.log('[Tweet Rendering DEBUG] renderUrlPreviews called:', {
      entitiesCount: entities?.length || 0,
      urlEntitiesCount: entities?.filter(e => e.type === 'url').length || 0,
      tweetId
    });
    
    // Ensure URL entities have the correct structure
    const enhancedEntities = entities.map(entity => {
      if (entity.type === 'url' && entity.url && !entity.expandedUrl) {
        console.log('[Tweet Rendering DEBUG] Enhancing URL entity with missing expandedUrl:', entity.url);
        return {
          ...entity,
          expandedUrl: entity.url,
          displayUrl: formatDisplayUrl(entity.url)
        };
      }
      return entity;
    });
    
    // Log enhanced entities
    console.log('[Tweet Rendering DEBUG] Enhanced URL entities:', {
      originalCount: entities.filter(e => e.type === 'url').length,
      enhancedCount: enhancedEntities.filter(e => e.type === 'url').length
    });
    
    // Deduplicate URL entities by their expanded URL
    const uniqueUrlEntities = enhancedEntities
      .filter(e => e.type === 'url' && e.expandedUrl) // Only include entities with expanded URLs
      .filter(e => {
        // Skip URLs that expand to Twitter/X URLs as they will be handled separately
        if (e.expandedUrl?.includes('twitter.com') || e.expandedUrl?.includes('x.com')) {
          console.log('[Tweet Rendering DEBUG] Skipping Twitter URL:', e.expandedUrl);
          
          // If this is a self-reference (links to the current tweet), skip it
          if (tweetId) {
            try {
              const match = e.expandedUrl?.match(/\/status\/(\d+)/);
              const urlTweetId = match ? match[1] : null;
              if (urlTweetId === tweetId) {
                console.log('[Tweet Rendering DEBUG] Skipping self-referential URL:', e.expandedUrl);
                return false;
              }
            } catch (err) {
              // Ignore extraction errors
            }
          }
          
          return false;
        }
        return true;
      })
      .reduce((acc: TweetEntity[], entity) => {
        const exists = acc.find(e => e.expandedUrl === entity.expandedUrl);
        if (!exists) acc.push(entity);
        return acc;
      }, []);

    console.log('[Tweet Rendering DEBUG] Unique URL entities after filtering:', {
      uniqueCount: uniqueUrlEntities.length,
      entities: uniqueUrlEntities.map(e => ({
        id: e.id,
        url: e.url,
        expandedUrl: e.expandedUrl
      }))
    });

    if (!uniqueUrlEntities?.length) {
      console.log('[Tweet Rendering DEBUG] No unique URL entities to render');
      return null;
    }

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
      <div className="mt-3 space-y-3">
        {uniqueUrlEntities.map((entity, index) => {
          const entityKey = entity.expandedUrl || entity.url || entity.id;
          const isLoading = isLoadingUrlPreviews[entityKey];
          
          console.log('[Tweet Rendering DEBUG] Rendering URL preview:', {
            index,
            entityKey,
            isLoading,
            url: entity.url,
            expandedUrl: entity.expandedUrl
          });
          
          if (isLoading) {
            return <UrlPreviewShimmer key={`shimmer-${entityKey}`} />;
          }
          
          // Parse metadata safely, handling different formats
          let metadata: any = {};
          try {
            if (typeof entity.metadata === 'string') {
              metadata = JSON.parse(entity.metadata);
            } else if (entity.metadata && typeof entity.metadata === 'object') {
              metadata = entity.metadata;
            }
            
            // Check for nested metadata structures
            if (metadata.metadata && typeof metadata.metadata === 'object') {
              metadata = { ...metadata, ...metadata.metadata };
            }
            
            // Check for title/description in different locations
            if (metadata.title_value && !metadata.title) {
              metadata.title = metadata.title_value;
            }
            
            if (metadata.description_value && !metadata.description) {
              metadata.description = metadata.description_value;
            }
            
            // Check for images in different locations
            if (!metadata.images && metadata.image) {
              metadata.images = [{ url: metadata.image }];
            }
            
            console.log('[Tweet Rendering DEBUG] Parsed URL preview metadata:', {
              hasMetadata: true,
              title: metadata?.title,
              description: metadata?.description?.substring(0, 50),
              hasImages: !!(metadata?.images?.length || metadata?.image)
            });
          } catch (error) {
            console.error('[Tweet Rendering ERROR] Error parsing metadata:', error);
            metadata = {};
          }

          // If no metadata, create a basic preview with just the URL
          if (!metadata?.title && !metadata?.description && !metadata?.images?.length && !metadata?.image) {
            console.log('[Tweet Rendering DEBUG] No metadata, creating basic preview for URL:', entity.expandedUrl || entity.url);
            
            // Get the domain from the expanded URL
            const domain = (() => {
              try {
                return new URL(entity.expandedUrl || entity.url || '').hostname;
              } catch (e) {
                return entity.displayUrl || '';
              }
            })();
            
            return (
              <div
                key={entity.expandedUrl || entity.url || index}
                className="rounded-lg border overflow-hidden hover:bg-accent/5 transition-colors cursor-pointer p-3"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(entity.expandedUrl || entity.url, '_blank', 'noopener,noreferrer');
                }}
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate">
                    {entity.displayUrl || domain || entity.expandedUrl || entity.url}
                  </span>
                </div>
              </div>
            );
          }

          // Get the domain from the expanded URL
          const domain = (() => {
            try {
              return new URL(entity.expandedUrl || '').hostname;
            } catch (e) {
              return entity.displayUrl || '';
            }
          })();

          // Check if this is a shortened URL that's been expanded
          const isExpandedShortUrl = isShortUrl(entity.url || '');

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
              <div className="flex flex-col sm:flex-row">
                {(metadata.images?.[0]?.url || metadata.image) && (
                  <div className="relative sm:w-1/3 h-[120px] sm:h-auto bg-accent/5">
                    <Image
                      src={metadata.images?.[0]?.url || metadata.image}
                      alt={metadata.title || 'Link preview'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 400px) 100vw, 400px"
                    />
                  </div>
                )}
                <div className="p-3 sm:p-4 flex-1">
                  {/* Visual indicator for expanded short URLs */}
                  {isExpandedShortUrl && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <span className="text-primary font-medium">{entity.url}</span>
                      <span>→</span>
                      <span>{domain}</span>
                    </div>
                  )}
                  
                  {metadata.title && (
                    <h4 className="font-medium text-sm mb-2 line-clamp-2">
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
                    {domain}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [isLoadingUrlPreviews]);

  const UrlPreviewShimmer = () => (
    <div className="mt-3 rounded-lg border overflow-hidden animate-pulse">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-1/3 h-[120px] bg-accent/10"></div>
        <div className="p-3 sm:p-4 flex-1 space-y-3">
          <div className="h-4 bg-accent/10 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-accent/10 rounded w-full"></div>
            <div className="h-3 bg-accent/10 rounded w-5/6"></div>
          </div>
          <div className="h-3 bg-accent/10 rounded w-1/4"></div>
        </div>
      </div>
    </div>
  );

  const renderTweet = (tweet: Tweet) => {
    const entities = tweet.entities || [];
    
    console.log('[Tweet Rendering DEBUG] renderTweet called:', {
      tweetId: tweet.id,
      textLength: tweet.text?.length || 0,
      textPreview: tweet.text ? (tweet.text.substring(0, 50) + (tweet.text.length > 50 ? '...' : '')) : 'No text',
      entitiesCount: entities.length
    });
    
    try {
      // Log detailed entity information
      entities.forEach((entity, index) => {
        if (entity.type === 'url') {
          console.log('[Tweet Rendering DEBUG] URL entity details:', {
            index,
            url: entity.url,
            expandedUrl: entity.expandedUrl,
            displayUrl: entity.displayUrl,
            metadata: entity.metadata ? 'present' : 'missing',
            type: entity.type
          });
        }
      });
      
      // Enhanced Twitter URL detection with self-reference filtering
      const twitterUrls = entities
        .filter(e => {
          // Check if it's a URL entity
          if (e.type !== 'url') return false;
          
          // Check if it has an expanded URL
          if (!e.expandedUrl) return false;
          
          // Check if it's a Twitter/X URL
          const isTwitterDomain = 
            e.expandedUrl.includes('twitter.com/') || 
            e.expandedUrl.includes('x.com/');
          
          // Check if it's a status URL (tweet)
          const isStatusUrl = e.expandedUrl.includes('/status/');
          
          // Extract the tweet ID from the URL to check if it's self-referential
          let urlTweetId = null;
          try {
            const match = e.expandedUrl.match(/\/status\/(\d+)/);
            urlTweetId = match ? match[1] : null;
          } catch (err) {
            // Ignore extraction errors
          }
          
          // Skip if this URL points to the current tweet (self-reference)
          const isSelfReference = urlTweetId === tweet.id;
          
          console.log('[Tweet Rendering DEBUG] Twitter URL check:', {
            url: e.url,
            expandedUrl: e.expandedUrl,
            isTwitterDomain,
            isStatusUrl,
            urlTweetId,
            currentTweetId: tweet.id,
            isSelfReference,
            result: isTwitterDomain && isStatusUrl && !isSelfReference
          });
          
          // Only include Twitter URLs that aren't self-references
          return isTwitterDomain && isStatusUrl && !isSelfReference;
        })
        .reduce((acc: string[], entity) => {
          const url = entity.expandedUrl;
          if (url && !acc.includes(url)) {
            console.log('[Tweet Rendering DEBUG] Adding Twitter URL for embedding:', url);
            acc.push(url);
          }
          return acc;
        }, []);

      console.log('[Tweet Rendering DEBUG] Twitter URLs for embedding:', {
        count: twitterUrls.length,
        urls: twitterUrls
      });

      // Only render Twitter embeds if there are any
      const twitterEmbedsSection = twitterUrls.length > 0 ? (
        <div className="mt-3 space-y-3">
          {twitterUrls.map((twitterUrl, embedIndex) => {
            console.log('[Tweet Rendering DEBUG] Creating Twitter embed for URL:', {
              index: embedIndex,
              url: twitterUrl
            });
            
            // Extract tweet ID from URL for direct embedding
            const tweetId = (() => {
              try {
                // Extract the tweet ID from the URL
                const match = twitterUrl.match(/\/status\/(\d+)/);
                return match ? match[1] : null;
              } catch (e) {
                return null;
              }
            })();
            
            console.log('[Tweet Rendering DEBUG] Extracted tweet ID:', tweetId);
            
            // For Twitter embeds, use the tweet ID directly if available
            if (tweetId) {
              return (
                <div 
                  key={`${tweet.id}-embed-${embedIndex}`}
                  className="rounded-lg border border-border/50 overflow-hidden relative"
                >
                  {/* Loading state indicator */}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 tweet-embed-loading">
                    <div className="h-5 w-5 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                  </div>
                  <blockquote 
                    className="twitter-tweet" 
                    data-conversation="none"
                    data-theme="dark"
                    data-align="center"
                    data-dnt="true"
                  >
                    <a href={`https://twitter.com/i/status/${tweetId}`}></a>
                  </blockquote>
                </div>
              );
            }
            
            // Fallback to using the full URL if tweet ID extraction failed
            return (
              <div 
                key={`${tweet.id}-embed-${embedIndex}`}
                className="rounded-lg border border-border/50 overflow-hidden relative"
              >
                {/* Loading state indicator */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 tweet-embed-loading">
                  <div className="h-5 w-5 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <blockquote 
                  className="twitter-tweet" 
                  data-conversation="none"
                  data-theme="dark"
                  data-align="center"
                  data-dnt="true"
                >
                  <a href={twitterUrl}></a>
                </blockquote>
              </div>
            );
          })}
        </div>
      ) : null;

      // Check if tweet is long (> 280 characters)
      const isLongTweet = tweet.text.length > 280;
      const isExpanded = expandedTweets[tweet.id] || false;
      const displayText = isLongTweet && !isExpanded 
        ? tweet.text.substring(0, 280) + '...' 
        : tweet.text;

      console.log('[Tweet Rendering DEBUG] About to render tweet text:', {
        displayTextLength: displayText?.length || 0,
        isLongTweet,
        isExpanded
      });

      // Render the tweet content
      const tweetContent = (
        <div className="whitespace-pre-wrap break-words">
          {renderTweetText(displayText, entities)}
        </div>
      );

      // Render media content if available
      const mediaContent = renderMedia(entities);
      
      // Render URL previews if available - pass the tweet ID to filter out self-references
      const urlPreviewsContent = renderUrlPreviews(entities, tweet.id);

      const result = (
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="text-sm">
              {tweetContent}
              {isLongTweet && (
                <button 
                  onClick={(e) => toggleTweetExpansion(tweet.id, e)}
                  className="text-xs text-primary mt-1 hover:underline"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
              {mediaContent}
              {urlPreviewsContent}
              {twitterEmbedsSection}
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

      return result;
    } catch (error) {
      console.error('[Tweet Rendering ERROR] Error rendering tweet:', error);
      return (
        <div className="text-red-500 text-sm">
          Error rendering tweet. Please try refreshing the page.
        </div>
      );
    }
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
                disabled={isPosting}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handlePost} 
                  disabled={!message.trim() || isPosting}
                >
                  {isPosting ? "Posting..." : "Post to X & Blog"}
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
            setApi={(api) => {
              // Set up a listener for slide changes to reload Twitter widgets
              if (api) {
                let debounceTimer: NodeJS.Timeout;
                api.on('select', () => {
                  // Debounce the reload to prevent multiple rapid calls
                  clearTimeout(debounceTimer);
                  debounceTimer = setTimeout(() => {
                    console.log('[Tweet Rendering] Carousel slide changed, loading Twitter widgets');
                    loadTwitterWidgets();
                    
                    // Don't force reload on every slide change, it's too aggressive
                  }, 500);
                });
              }
            }}
          >
            {(() => {
              performance.start('tweet_rendering', { 
                tweetCount: tweets.length,
                operation: 'batch_render'
              });

              const renderedTweets = tweets.map((tweet, index) => (
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
                    <div className="flex items-center justify-between h-10 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-8 h-8 shrink-0">
                          <Image
                            src={profileConfig.profileImage}
                            alt={profileConfig.username}
                            fill
                            className="rounded-full object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                          <p className="font-medium text-sm leading-tight truncate">{profileConfig.displayName}</p>
                          <p className="text-xs text-muted-foreground leading-tight truncate">@{profileConfig.username}</p>
                        </div>
                      </div>
                      <span 
                        className="text-primary hover:text-primary/80 transition-colors text-lg font-bold ml-2 shrink-0"
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
                            <a href={`https://x.com/i/status/${ref.id}`}></a>
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
                          ? formatDate(tweet.created_at)
                          : 'Just now'
                        }
                      </time>
                    </div>
                  </div>
                </Card3D>
              ));

              performance.end('tweet_rendering', {
                tweetCount: tweets.length,
                operation: 'batch_render'
              });

              return renderedTweets;
            })()}
          </Carousel>
        </div>
      )}
    </section>
  )
}

export default BlogSection 
