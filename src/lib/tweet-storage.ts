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

// Helper function to safely convert to Prisma JSON
function toPrismaJson<T>(data: T) {
  if (data === null || data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

// Helper function to validate and format dates
function toValidDate(date: Date | string | number | null | undefined): Date {
  if (!date) return new Date();
  
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      console.warn('[Twitter Storage] Invalid date:', date);
      return new Date();
    }
    return parsed;
  } catch (error) {
    console.warn('[Twitter Storage] Error parsing date:', date, error);
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

  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: toValidDate(tweet.created_at),
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

// Helper function to clean up duplicate entities
async function cleanupDuplicateEntities() {
  console.log('[Twitter Storage] Starting entity cleanup:', {
    timestamp: new Date().toISOString(),
    step: 'start'
  });

  // Get all tweets with their entities
  const tweets = await prisma.tweet.findMany({
    include: {
      entities: true
    }
  }) as PrismaTweet[];

  console.log('[Twitter Storage] Found tweets to clean:', {
    tweetCount: tweets.length,
    timestamp: new Date().toISOString(),
    step: 'tweets-found'
  });

  let totalDuplicatesRemoved = 0;

  for (const tweet of tweets) {
    try {
      // Group entities by their type and text to find duplicates
      const entityGroups = tweet.entities.reduce<Record<string, Array<{ id: string }>>>((acc, entity) => {
        const key = `${entity.type}-${entity.text}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({ id: entity.id });
        return acc;
      }, {} as Record<string, Array<{ id: string }>>);

      // For each group of duplicate entities, keep one and delete the rest
      for (const [key, entities] of Object.entries(entityGroups)) {
        if (entities.length > 1) {
          // Keep the first entity and delete the rest
          const [_keep, ...duplicates] = entities;
          if (duplicates.length > 0) {
            const duplicateIds = duplicates.map(d => d.id);

            console.log('[Twitter Storage] Removing duplicates for tweet:', {
              tweetId: tweet.id,
              entityKey: key,
              duplicateCount: duplicateIds.length,
              duplicateIds,
              timestamp: new Date().toISOString(),
              step: 'pre-delete'
            });

            await prisma.tweetEntity.deleteMany({
              where: {
                id: {
                  in: duplicateIds
                }
              }
            });

            totalDuplicatesRemoved += duplicateIds.length;

            console.log('[Twitter Storage] Removed duplicates for tweet:', {
              tweetId: tweet.id,
              entityKey: key,
              duplicatesRemoved: duplicateIds.length,
              timestamp: new Date().toISOString(),
              step: 'duplicates-removed'
            });
          }
        }
      }
    } catch (error) {
      console.error('[Twitter Storage] Error cleaning duplicates for tweet:', {
        tweetId: tweet.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        step: 'error'
      });
      // Continue with next tweet even if this one fails
      continue;
    }
  }

  console.log('[Twitter Storage] Entity cleanup complete:', {
    totalTweets: tweets.length,
    totalDuplicatesRemoved,
    timestamp: new Date().toISOString(),
    step: 'complete'
  });
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

  // Clean up duplicate entities first
  await cleanupDuplicateEntities();

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
      // First, delete any existing entities for this tweet to prevent duplicates
      await (prisma as any).tweetEntity.deleteMany({
        where: { tweetId: tweet.id }
      });

      const tweetData = await convertTweetForStorage(tweet, includes);
      const createdTweet = await (prisma as any).tweet.upsert({
        where: { id: tweet.id },
        create: {
          ...tweetData,
          entities: {
            create: tweetData.entities.create
          }
        },
        update: {
          ...tweetData,
          entities: {
            deleteMany: {},
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
}

// Get rate limit info
export async function getRateLimit(endpoint: string) {
  const startTime = Date.now();
  
  console.log('[Twitter Storage] Fetching rate limit:', {
    endpoint,
    timestamp: new Date().toISOString(),
    step: 'pre-fetch'
  });

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
  }

  return rateLimit;
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