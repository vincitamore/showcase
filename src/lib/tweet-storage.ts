import { prisma } from '@/lib/db'
import { TweetV2, TweetEntitiesV2, MediaObjectV2, ApiV2Includes } from 'twitter-api-v2'
import type { PrismaClient as PrismaClientType } from '@prisma/client'

// Constants
export const FIFTEEN_MINUTES = 15 * 60 * 1000 // 15 minutes in milliseconds
export const MAX_TWEETS = 100
export const SELECTED_TWEET_COUNT = 10
export const CACHE_TYPES = {
  CURRENT: 'current',
  PREVIOUS: 'previous',
  SELECTED: 'selected'
} as const

// New constants for tweet limiting and selection
export const DAILY_TWEET_FETCH_LIMIT = 4 // Fetch only 4 tweets per day
export const TECH_SCORE_THRESHOLD = 0.5 // Minimum tech relevance score to be considered (0-1)

// Default rate limits per endpoint (requests per 15 minutes)
export const DEFAULT_RATE_LIMITS = {
  'users/by/username': 900,
  'users/:id/tweets': 1500,
  'default': 100
} as const

// Tech-related keywords for filtering
export const TECH_KEYWORDS = [
  'tech', 'technology', 'software', 'development', 'code', 'coding', 'programming',
  'developer', 'engineer', 'cybersecurity', 'security', 'infosec', 'javascript', 'typescript',
  'python', 'java', 'csharp', 'c#', 'react', 'angular', 'vue', 'nodejs', 'node.js', 
  'database', 'sql', 'nosql', 'cloud', 'aws', 'azure', 'gcp', 'devops', 'github',
  'git', 'stackoverflow', 'docker', 'kubernetes', 'k8s', 'api', 'microservices',
  'frontend', 'backend', 'fullstack', 'web', 'app', 'mobile', 'ios', 'android',
  'machine learning', 'ml', 'ai', 'artificial intelligence', 'data science',
  'algorithm', 'framework', 'library', 'package', 'module', 'function', 'agile',
  'scrum', 'kanban', 'ci/cd', 'architecture', 'infrastructure', 'networking',
  'network', 'encryption', 'protocol', 'server', 'client', 'authentication',
  'authorization', 'cache', 'performance', 'optimization', 'responsive',
  'scalable', 'testing', 'debug', 'open source', 'oss', 'hardware', 'automation',
  'linux', 'windows', 'unix', 'macos', 'ui', 'ux', 'user interface', 'design'
]

type CacheType = (typeof CACHE_TYPES)[keyof typeof CACHE_TYPES]

// New Twitter quota tracking functions
// Get today's quota usage
export async function getTwitterQuotaUsage(): Promise<{ used: number; limit: number; date: Date }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('[Twitter Storage] Getting quota usage for date:', today.toISOString());
  
  try {
    const quotaUsage = await prisma.twitterQuotaUsage.findUnique({
      where: { date: today }
    });
    
    if (quotaUsage) {
      console.log('[Twitter Storage] Found existing quota usage:', {
        date: quotaUsage.date.toISOString(),
        used: quotaUsage.used,
        limit: quotaUsage.limit
      });
      return quotaUsage;
    }
    
    // Create new quota usage record for today
    console.log('[Twitter Storage] Creating new quota usage record for today');
    return prisma.twitterQuotaUsage.create({
      data: {
        date: today,
        used: 55,
        limit: 100 // Monthly limit of 100 posts
      }
    });
  } catch (error) {
    console.error('[Twitter Storage] Error getting quota usage:', error);
    // Return a default object if there's an error
    return {
      date: today,
      used: 0,
      limit: 100
    };
  }
}

// Update quota usage
export async function updateTwitterQuotaUsage(tweetsCount: number): Promise<{ used: number; limit: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('[Twitter Storage] Updating quota usage:', {
    date: today.toISOString(),
    incrementBy: tweetsCount
  });
  
  try {
    const quotaUsage = await prisma.twitterQuotaUsage.upsert({
      where: { date: today },
      update: {
        used: { increment: tweetsCount },
        updatedAt: new Date()
      },
      create: {
        date: today,
        used: tweetsCount,
        limit: 100
      }
    });
    
    console.log('[Twitter Storage] Updated quota usage:', {
      date: quotaUsage.date.toISOString(),
      used: quotaUsage.used,
      limit: quotaUsage.limit,
      remaining: quotaUsage.limit - quotaUsage.used
    });
    
    return { used: quotaUsage.used, limit: quotaUsage.limit };
  } catch (error) {
    console.error('[Twitter Storage] Error updating quota usage:', error);
    // Return a default object if there's an error
    return { used: tweetsCount, limit: 100 };
  }
}

// Helper function to safely convert to Prisma JSON
function toPrismaJson<T>(data: T) {
  if (data === null || data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

// Helper function to validate and format dates
function toValidDate(date: Date | string | number | null | undefined): Date {
  if (!date) {
    console.warn('[Twitter Storage] No date provided, using current date as fallback');
    return new Date();
  }
  
  try {
    // Add a 5-minute buffer to prevent false positives for "future" dates
    // due to slight clock differences between systems
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes in milliseconds
    const futureThreshold = new Date(now.getTime() + bufferMs);
    
    // If it's already a Date object, just validate it
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        console.warn('[Twitter Storage] Invalid Date object:', date);
        return new Date();
      }
      
      // Check if date is significantly in the future (beyond our buffer)
      if (date > futureThreshold) {
        console.warn('[Twitter Storage] Future date detected, using current date instead:', date);
        return now;
      }
      
      return date;
    }
    
    // If it's a number, treat it as a timestamp
    if (typeof date === 'number') {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        console.warn('[Twitter Storage] Invalid timestamp:', date);
        return new Date();
      }
      
      // Check if date is significantly in the future
      if (parsed > futureThreshold) {
        console.warn('[Twitter Storage] Future date from timestamp detected, using current date instead:', date);
        return now;
      }
      
      return parsed;
    }
    
    // If it's a string, try to parse it
    if (typeof date === 'string') {
      console.log('[Twitter Storage] Parsing date string:', date);
      
      // Check if it's an ISO string format
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(date)) {
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
          console.warn('[Twitter Storage] Invalid ISO date string:', date);
          return new Date();
        }
        
        // Check if date is significantly in the future
        if (parsed > futureThreshold) {
          console.warn('[Twitter Storage] Future date from ISO string detected, using current date instead:', date);
          return now;
        }
        
        return parsed;
      }
      
      // Check if it's a timestamp string
      if (/^\d+$/.test(date)) {
        const timestamp = parseInt(date, 10);
        const parsed = new Date(timestamp);
        if (isNaN(parsed.getTime())) {
          console.warn('[Twitter Storage] Invalid timestamp string:', date);
          return new Date();
        }
        
        // Check if date is significantly in the future
        if (parsed > futureThreshold) {
          console.warn('[Twitter Storage] Future date from timestamp string detected, using current date instead:', date);
          return now;
        }
        
        return parsed;
      }
      
      // Try Twitter's date format (e.g., "Wed Oct 10 20:19:24 +0000 2018")
      if (date.includes('+0000') || date.match(/\w{3} \w{3} \d{1,2} \d{2}:\d{2}:\d{2}/)) {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          // Check if date is significantly in the future
          if (parsed > futureThreshold) {
            console.warn('[Twitter Storage] Future date from Twitter format detected, using current date instead:', date);
            return now;
          }
          
          return parsed;
        }
      }
      
      // Try standard date parsing
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        console.warn('[Twitter Storage] Invalid date string:', date);
        return new Date();
      }
      
      // Check if date is significantly in the future
      if (parsed > futureThreshold) {
        console.warn('[Twitter Storage] Future date from standard parsing detected, using current date instead:', date);
        return now;
      }
      
      return parsed;
    }
    
    // Fallback for unknown types
    console.warn('[Twitter Storage] Unhandled date type:', typeof date, date);
    return new Date();
  } catch (error) {
    console.error('[Twitter Storage] Error parsing date:', date, error);
    return new Date();
  }
}

// Helper function to safely convert date to ISO string
function toSafeISOString(date: Date | string | number | null | undefined): string {
  return toValidDate(date).toISOString();
}

// Helper function to check if a tweet has entities
function hasTweetEntities(tweet: TweetV2): boolean {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Twitter] Checking entities for tweet:', {
      id: tweet.id,
      hasEntities: !!tweet.entities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
      urlCount: tweet.entities?.urls?.length || 0
    })
  }

  if (!tweet.entities) return false

  const hasUrls = !!tweet.entities.urls?.length
  const hasMentions = !!tweet.entities.mentions?.length
  const hasHashtags = !!tweet.entities.hashtags?.length
  const hasAnnotations = !!tweet.entities.annotations?.length
  const hasCashtags = !!tweet.entities.cashtags?.length

  const hasAnyEntity = hasUrls || hasMentions || hasHashtags || hasAnnotations || hasCashtags

  if (process.env.NODE_ENV === 'development') {
    console.log('[Twitter] Entity detection result:', {
      id: tweet.id,
      hasUrls,
      hasMentions,
      hasHashtags,
      hasAnnotations,
      hasCashtags,
      hasAnyEntity
    })
  }

  return hasAnyEntity
}

// Helper to convert TweetV2 to database format
async function convertTweetForStorage(tweet: TweetV2, includes?: ApiV2Includes) {
  const publicMetrics = toPrismaJson(tweet.public_metrics);
  
  // Log the tweet creation date for debugging
  console.log('[Twitter Storage] Processing tweet for storage:', {
    id: tweet.id,
    created_at: tweet.created_at,
    parsedDate: tweet.created_at ? new Date(tweet.created_at).toISOString() : 'undefined'
  });
  
  // Define the entity create input type
  type EntityCreateInput = {
    type: string;
    text: string;
    url?: string | null;
    expandedUrl?: string | null;
    displayUrl?: string | null;
    mediaKey?: string | null;
    metadata?: any;
    tweet: {
      connect: {
        id: string;
      };
    };
  };

  const entityPromises: Promise<EntityCreateInput>[] = [];

  // Process URLs
  if (tweet.entities?.urls?.length) {
    tweet.entities.urls.forEach(url => {
      entityPromises.push(Promise.resolve({
        type: 'url',
        text: url.url,
        url: url.url,
        expandedUrl: url.expanded_url,
        displayUrl: url.display_url,
        tweet: { connect: { id: tweet.id } },
        metadata: toPrismaJson({
          title: url.title,
          description: url.description,
          images: url.images || []
        })
      }));
    });
  }

  // Process media from attachments
  if (tweet.attachments?.media_keys?.length && includes?.media?.length) {
    const mediaItems = tweet.attachments.media_keys.map(key => {
      const mediaArray = includes?.media;
      if (!mediaArray) return null;
      
      const media = mediaArray.find((m: MediaObjectV2) => m.media_key === key);
      if (!media) return null;
      
      // Enhanced media metadata handling
      const mediaMetadata = {
        type: media.type,
        url: media.url || media.preview_image_url, // Fallback to preview_image_url
        preview_image_url: media.preview_image_url,
        width: media.width,
        height: media.height,
        alt_text: media.alt_text,
        variants: media.variants,
        // Store the direct image URL for photos
        direct_url: media.type === 'photo' ? 
          `https://pbs.twimg.com/media/${media.media_key}?format=jpg&name=large` : 
          null
      };

      return {
        type: 'media',
        text: media.url || media.preview_image_url || '',
        url: mediaMetadata.direct_url || media.url || media.preview_image_url || '',
        expandedUrl: mediaMetadata.direct_url || media.url || media.preview_image_url || '',
        displayUrl: media.url || media.preview_image_url || '',
        mediaKey: media.media_key,
        tweet: { connect: { id: tweet.id } },
        metadata: toPrismaJson(mediaMetadata)
      } as EntityCreateInput;
    }).filter(item => item !== null) as EntityCreateInput[];

    entityPromises.push(...mediaItems.map(item => Promise.resolve(item)));
  }

  const entities = await Promise.all(entityPromises);

  // Ensure we're using a valid date and log it
  const validDate = toValidDate(tweet.created_at);
  console.log('[Twitter Storage] Final date for tweet storage:', {
    id: tweet.id,
    original: tweet.created_at,
    validated: validDate.toISOString(),
    isFuture: validDate > new Date()
  });

  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: validDate,
    publicMetrics,
    entities: {
      create: entities
    }
  };
}

// Helper to store tweet entities
async function storeTweetEntities(tweetId: string, entities: TweetEntitiesV2) {
  const entityPromises = entities.urls?.map(url => ({
    type: 'url' as const,
    text: url.display_url || url.url,
    url: url.url,
    expandedUrl: url.expanded_url,
    tweet: { connect: { id: tweetId } },
    metadata: toPrismaJson(url),
    mediaKey: null
  })) || []

  const mentionPromises = entities.mentions?.map(mention => ({
    type: 'mention' as const,
    text: mention.username,
    tweet: { connect: { id: tweetId } },
    metadata: toPrismaJson(mention),
    url: null,
    expandedUrl: null,
    mediaKey: null
  })) || []

  const hashtagPromises = entities.hashtags?.map(hashtag => ({
    type: 'hashtag' as const,
    text: hashtag.tag,
    tweet: { connect: { id: tweetId } },
    metadata: toPrismaJson(hashtag),
    url: null,
    expandedUrl: null,
    mediaKey: null
  })) || []

  const allPromises = [...entityPromises, ...mentionPromises, ...hashtagPromises]
  
  if (allPromises.length > 0) {
    await Promise.all(allPromises.map(data => (prisma as any).tweetEntity.create({ data })))
  }
}

interface PrismaTweet {
  id: string;
  entities: Array<{
    id: string;
    type: string;
    text: string;
  }>;
}

// Added function to score tweets based on tech relevance
export function scoreTweetRelevance(tweet: TweetV2): number {
  if (!tweet.text) return 0;
  
  const text = tweet.text.toLowerCase();
  const hashtags = tweet.entities?.hashtags?.map(h => h.tag.toLowerCase()) || [];
  
  // Count tech keyword mentions in the tweet text
  const textMatches = TECH_KEYWORDS.filter(keyword => 
    text.includes(keyword.toLowerCase())
  ).length;
  
  // Count tech keyword mentions in hashtags
  const hashtagMatches = hashtags.filter(tag =>
    TECH_KEYWORDS.some(keyword => tag.includes(keyword.toLowerCase()))
  ).length;
  
  // Calculate a base score (0-1) based on keyword density
  const textLength = text.split(/\s+/).length || 1; // Prevent division by zero
  const keywordDensity = (textMatches + hashtagMatches) / textLength;
  
  // Quality factors - check for links (often indicates more substantive content)
  const hasLinks = tweet.entities?.urls && tweet.entities.urls.length > 0 ? 0.2 : 0;
  
  // Check tweet length - longer tweets often have more substance
  const lengthBonus = textLength > 15 ? 0.1 : 0;
  
  // Calculate final score (capped at 1.0)
  const rawScore = keywordDensity * 5 + hasLinks + lengthBonus;
  return Math.min(rawScore, 1.0);
}

// Cache tweets in the database
export async function cacheTweets(tweets: TweetV2[], type: CacheType = CACHE_TYPES.CURRENT, includes?: ApiV2Includes) {
  console.log(`[Twitter Storage] Caching ${tweets.length} tweets of type ${type}`);

  // Deactivate previous caches of the same type
  await (prisma as any).tweetCache.updateMany({
    where: {
      type,
      isActive: true
    },
    data: {
      isActive: false
    }
  });

  const cache = await (prisma as any).tweetCache.create({
    data: {
      type,
      expiresAt: type === CACHE_TYPES.CURRENT ? new Date(Date.now() + FIFTEEN_MINUTES) : null,
      isActive: true
    }
  });

  // Sort tweets by creation date with newest first
  const sortedTweets = [...tweets].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  for (const tweet of sortedTweets) {
    try {
      // Check if the tweet already exists
      const existingTweet = await (prisma as any).tweet.findUnique({
        where: { id: tweet.id },
        include: { entities: true }
      });

      if (existingTweet) {
        console.log(`[Twitter Storage] Tweet ${tweet.id} already exists with ${existingTweet.entities.length} entities`);
        
        // Only update the tweet if needed, preserve the original createdAt date
        const tweetData = await convertTweetForStorage(tweet, includes);
        
        // Keep the original createdAt date if it exists and is valid
        const createdAt = existingTweet.createdAt && !isNaN(new Date(existingTweet.createdAt).getTime())
          ? existingTweet.createdAt
          : tweetData.createdAt;
        
        // Log entity counts for debugging
        console.log(`[Twitter Storage] Entity counts for tweet ${tweet.id}:`, {
          existingEntities: existingTweet.entities.length,
          newEntitiesBeforeFilter: tweetData.entities.create.length
        });
        
        // Filter out entities that already exist to avoid duplicates
        const newEntities = tweetData.entities.create.filter(newEntity => 
          !existingTweet.entities.some((existingEntity: { type: string; text: string }) => 
            existingEntity.type === newEntity.type && 
            existingEntity.text === newEntity.text
          )
        );
        
        console.log(`[Twitter Storage] Adding ${newEntities.length} new entities to tweet ${tweet.id}`);
        
        // Update the tweet but preserve entities - DO NOT use entities: { set: [] } which would delete existing entities
        const updatedTweet = await (prisma as any).tweet.update({
          where: { id: tweet.id },
          data: {
            text: tweetData.text,
            createdAt: createdAt, // Preserve original date
            publicMetrics: tweetData.publicMetrics,
            // Only add new entities, don't delete existing ones
            entities: newEntities.length > 0 ? {
              create: newEntities
            } : undefined // Skip entity update if no new entities to add
          }
        });

        await (prisma as any).tweetCache.update({
          where: { id: cache.id },
          data: {
            tweets: {
              connect: { id: updatedTweet.id }
            }
          }
        });
      } else {
        // Create new tweet with entities
        const tweetData = await convertTweetForStorage(tweet, includes);
        const createdTweet = await (prisma as any).tweet.create({
          data: {
            ...tweetData,
            entities: {
              create: tweetData.entities.create
            }
          }
        });

        await (prisma as any).tweetCache.update({
          where: { id: cache.id },
          data: {
            tweets: {
              connect: { id: createdTweet.id }
            }
          }
        });
      }
    } catch (error) {
      console.error('[Twitter Storage] Error caching tweet:', {
        id: tweet.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  return cache;
}

// Get cached tweets
export async function getCachedTweets(type: CacheType = CACHE_TYPES.CURRENT) {
  console.log('[Tweet Storage] Getting cached tweets:', {
    type,
    timestamp: new Date().toISOString(),
    step: 'start'
  });

  // First try to get tweets from active cache
  const activeCache = await (prisma as any).tweetCache.findFirst({
    where: {
      type,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    include: {
      tweets: {
        include: {
          entities: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // If we have an active cache with tweets, use it
  if (activeCache?.tweets?.length) {
    console.log('[Tweet Storage] Found active cache:', {
      type,
      cacheId: activeCache.id,
      tweetCount: activeCache.tweets.length,
      timestamp: new Date().toISOString(),
      step: 'active-cache'
    });
    return { tweets: activeCache.tweets };
  }

  // If no active cache or it's empty, get all available tweets
  console.log('[Tweet Storage] No active cache, fetching all tweets:', {
    type,
    timestamp: new Date().toISOString(),
    step: 'fallback'
  });

  const allTweets = await (prisma as any).tweet.findMany({
    include: {
      entities: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: MAX_TWEETS
  });

  console.log('[Tweet Storage] Fetched all tweets:', {
    count: allTweets.length,
    timestamp: new Date().toISOString(),
    step: 'complete'
  });

  return { tweets: allTweets };
}

const TWEET_LIMIT = 100;
const CACHE_LIMIT = 1000;

export async function updateSelectedTweets(tweetIds: string[]) {
  const selectedTweetIds = tweetIds.slice(0, SELECTED_TWEET_COUNT);
  
  // Deactivate previous selected cache
  await (prisma as any).tweetCache.updateMany({
    where: {
      type: CACHE_TYPES.SELECTED,
      isActive: true
    },
    data: {
      isActive: false
    }
  });

  // Create new selected cache
  const cache = await (prisma as any).tweetCache.create({
    data: {
      type: CACHE_TYPES.SELECTED,
      isActive: true,
      tweets: {
        connect: selectedTweetIds.map(id => ({ id }))
      }
    }
  });

  return cache;
}

export async function getSelectedTweets(): Promise<TweetV2[]> {
  console.log('[Tweet Storage] Fetching selected tweets:', {
    timestamp: new Date().toISOString(),
    step: 'start'
  });

  const cache = await (prisma as any).tweetCache.findFirst({
    where: {
      type: CACHE_TYPES.SELECTED,
      isActive: true
    },
    include: {
      tweets: {
        include: {
          entities: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  console.log('[Tweet Storage] Selected tweets query result:', {
    hasCache: !!cache,
    totalTweets: cache?.tweets?.length || 0,
    isActive: cache?.isActive,
    type: cache?.type,
    timestamp: new Date().toISOString(),
    step: 'after-query'
  });
  
  // Ensure we return exactly SELECTED_TWEET_COUNT tweets
  const tweets = cache?.tweets || [];
  
  // Sort by creation date (newer first) with a small boost for newer tweets
  const sortedTweets = [...tweets].sort((a: any, b: any) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    
    // Prioritize newer tweets, but with some randomness to avoid always showing the same ones
    const recencyBoost = Math.random() * 0.3; // Random boost factor between 0-0.3
    const normalizedDateDiff = (dateB - dateA) / (7 * 24 * 60 * 60 * 1000); // Normalize to a week scale
    
    return normalizedDateDiff * (1 + recencyBoost);
  });
  
  if (sortedTweets.length > SELECTED_TWEET_COUNT) {
    console.log('[Tweet Storage] Trimming selected tweets to limit:', {
      total: sortedTweets.length,
      limit: SELECTED_TWEET_COUNT,
      removing: sortedTweets.length - SELECTED_TWEET_COUNT,
      timestamp: new Date().toISOString(),
      step: 'trimming'
    });
    return sortedTweets.slice(0, SELECTED_TWEET_COUNT);
  }
  
  console.log('[Tweet Storage] Returning selected tweets:', {
    count: sortedTweets.length,
    ids: sortedTweets.map((t: TweetV2) => t.id),
    timestamp: new Date().toISOString(),
    step: 'complete'
  });
  
  return sortedTweets;
}

// Rate limit management
export async function updateRateLimit(endpoint: string, resetAt: Date, remaining: number) {
  const startTime = Date.now();
  const validResetAt = toValidDate(resetAt);
  
  console.log('[Twitter Storage] Updating rate limit:', {
    endpoint,
    resetAt: validResetAt.toISOString(),
    remaining,
    timestamp: new Date().toISOString(),
    step: 'pre-update'
  });

  try {
    const result = await (prisma as any).twitterRateLimit.upsert({
      where: {
        endpoint
      },
      create: {
        endpoint,
        resetAt: validResetAt,
        remaining
      },
      update: {
        resetAt: validResetAt,
        remaining
      }
    });

    console.log('[Twitter Storage] Rate limit updated:', {
      endpoint,
      resetAt: validResetAt.toISOString(),
      remaining,
      durationMs: Date.now() - startTime,
      step: 'post-update'
    });

    return result;
  } catch (error) {
    console.error('[Twitter Storage] Error updating rate limit:', {
      endpoint,
      resetAt: validResetAt.toISOString(),
      remaining,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
      step: 'error'
    });
    
    // Return a fallback object with the data we tried to save
    // This allows the application to continue functioning even if the database is unavailable
    return {
      endpoint,
      resetAt: validResetAt,
      remaining,
      lastUpdated: new Date()
    };
  }
}

// Get rate limit info
export async function getRateLimit(endpoint: string) {
  const startTime = Date.now();
  
  console.log('[Twitter Storage] Fetching rate limit:', {
    endpoint,
    timestamp: new Date().toISOString(),
    step: 'pre-fetch'
  });

  try {
    const rateLimit = await (prisma as any).twitterRateLimit.findUnique({
      where: {
        endpoint
      }
    });

    if (rateLimit) {
      console.log('[Twitter Storage] Retrieved rate limit:', {
        endpoint,
        resetAt: toSafeISOString(rateLimit.resetAt),
        remaining: rateLimit.remaining,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        step: 'post-fetch-found'
      });
      return rateLimit;
    } else {
      // Create default rate limit if none exists
      const defaultLimit = DEFAULT_RATE_LIMITS[endpoint as keyof typeof DEFAULT_RATE_LIMITS] || DEFAULT_RATE_LIMITS.default;
      const now = new Date();
      const resetAt = new Date(now.getTime() + FIFTEEN_MINUTES);
      
      console.log('[Twitter Storage] Creating default rate limit:', {
        endpoint,
        defaultLimit,
        resetAt: resetAt.toISOString(),
        timestamp: now.toISOString(),
        durationMs: Date.now() - startTime,
        step: 'creating-default'
      });

      try {
        const newLimit = await (prisma as any).twitterRateLimit.create({
          data: {
            endpoint,
            resetAt,
            remaining: defaultLimit
          }
        });

        console.log('[Twitter Storage] Created default rate limit:', {
          endpoint,
          resetAt: toSafeISOString(newLimit.resetAt),
          remaining: newLimit.remaining,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          step: 'post-fetch-created'
        });

        return newLimit;
      } catch (createError) {
        console.error('[Twitter Storage] Error creating default rate limit:', {
          endpoint,
          error: createError instanceof Error ? createError.message : 'Unknown error',
          durationMs: Date.now() - startTime,
          step: 'create-error'
        });
        
        // Return a fallback object with default values
        return {
          endpoint,
          resetAt,
          remaining: defaultLimit,
          lastUpdated: now
        };
      }
    }
  } catch (error) {
    console.error('[Twitter Storage] Error fetching rate limit:', {
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
      step: 'fetch-error'
    });
    
    // Create a fallback rate limit object with default values
    const defaultLimit = DEFAULT_RATE_LIMITS[endpoint as keyof typeof DEFAULT_RATE_LIMITS] || DEFAULT_RATE_LIMITS.default;
    const now = new Date();
    const resetAt = new Date(now.getTime() + FIFTEEN_MINUTES);
    
    return {
      endpoint,
      resetAt,
      remaining: defaultLimit,
      lastUpdated: now
    };
  }
}

export async function canMakeRequest(endpoint: string): Promise<boolean> {
  const startTime = Date.now();
  
  console.log('[Twitter Storage] Checking if request can be made:', {
    endpoint,
    timestamp: new Date().toISOString(),
    step: 'start-check'
  });

  const rateLimit = await getRateLimit(endpoint);
  const now = new Date();
  
  // If no rate limit info exists, allow the request
  if (!rateLimit) {
    console.log('[Twitter Storage] No rate limit found, allowing request:', {
      endpoint,
      timestamp: now.toISOString(),
      durationMs: Date.now() - startTime,
      step: 'check-no-limit'
    });
    return true;
  }

  const resetAt = toValidDate(rateLimit.resetAt);
  const timeUntilReset = resetAt.getTime() - now.getTime();
  
  // If we're past the reset time, allow the request
  if (now > resetAt) {
    console.log('[Twitter Storage] Rate limit reset time passed:', {
      endpoint,
      resetAt: resetAt.toISOString(),
      now: now.toISOString(),
      remaining: rateLimit.remaining,
      durationMs: Date.now() - startTime,
      step: 'check-reset-passed'
    });
    
    // Reset the rate limit since the reset time has passed
    const defaultLimit = DEFAULT_RATE_LIMITS[endpoint as keyof typeof DEFAULT_RATE_LIMITS] || DEFAULT_RATE_LIMITS.default;
    const newResetAt = new Date(now.getTime() + FIFTEEN_MINUTES);
    
    console.log('[Twitter Storage] Resetting rate limit after expiration:', {
      endpoint,
      oldResetAt: resetAt.toISOString(),
      newResetAt: newResetAt.toISOString(),
      oldRemaining: rateLimit.remaining,
      newRemaining: defaultLimit - 1, // Pre-decrement for the upcoming request
      step: 'reset-rate-limit'
    });
    
    // Update the rate limit in the database
    await updateRateLimit(endpoint, newResetAt, defaultLimit - 1);
    
    return true;
  }

  // If we still have remaining requests, allow the request
  if (rateLimit.remaining > 0) {
    console.log('[Twitter Storage] Requests remaining:', {
      endpoint,
      remaining: rateLimit.remaining,
      resetAt: resetAt.toISOString(),
      timeUntilReset: Math.floor(timeUntilReset / 1000) + 's',
      durationMs: Date.now() - startTime,
      step: 'check-has-remaining'
    });
    return true;
  }

  // We're rate limited
  console.error('[Twitter Storage] Rate limited:', {
    endpoint,
    resetAt: resetAt.toISOString(),
    remaining: rateLimit.remaining,
    timeUntilReset: Math.floor(timeUntilReset / 1000) + 's',
    durationMs: Date.now() - startTime,
    step: 'check-rate-limited'
  });
  return false;
}

// Function to manually reset expired rate limits
export async function resetExpiredRateLimits() {
  const startTime = Date.now();
  console.log('[Twitter Storage] Checking for expired rate limits', {
    timestamp: new Date().toISOString(),
    step: 'start-check'
  });
  
  // Get all rate limits from the database
  const allRateLimits = await (prisma as any).twitterRateLimit.findMany();
  const now = new Date();
  let resetCount = 0;
  
  for (const limit of allRateLimits) {
    const resetAt = toValidDate(limit.resetAt);
    
    // If the reset time has passed, update the rate limit
    if (now > resetAt) {
      const defaultLimit = DEFAULT_RATE_LIMITS[limit.endpoint as keyof typeof DEFAULT_RATE_LIMITS] || DEFAULT_RATE_LIMITS.default;
      const newResetAt = new Date(now.getTime() + FIFTEEN_MINUTES);
      
      console.log('[Twitter Storage] Resetting expired rate limit:', {
        endpoint: limit.endpoint,
        oldResetAt: resetAt.toISOString(),
        newResetAt: newResetAt.toISOString(),
        oldRemaining: limit.remaining,
        newRemaining: defaultLimit,
        step: 'reset-limit'
      });
      
      await (prisma as any).twitterRateLimit.update({
        where: { endpoint: limit.endpoint },
        data: {
          resetAt: newResetAt,
          remaining: defaultLimit
        }
      });
      
      resetCount++;
    }
  }
  
  console.log('[Twitter Storage] Completed rate limit check:', {
    totalLimits: allRateLimits.length,
    resetCount,
    durationMs: Date.now() - startTime,
    step: 'check-complete'
  });
  
  return { checked: allRateLimits.length, reset: resetCount };
} 