import { prisma } from '@/lib/db'
import { TweetV2, TweetEntitiesV2 } from 'twitter-api-v2'

// Constants
export const FIFTEEN_MINUTES = 15 * 60 * 1000 // 15 minutes in milliseconds
export const MAX_TWEETS = 100
export const CACHE_TYPES = {
  CURRENT: 'current',
  PREVIOUS: 'previous',
  SELECTED: 'selected'
} as const

// Default rate limits per endpoint (requests per 15 minutes)
export const DEFAULT_RATE_LIMITS = {
  'users/by/username': 900,
  'users/:id/tweets': 1500,
  'default': 100
} as const

type CacheType = (typeof CACHE_TYPES)[keyof typeof CACHE_TYPES]

// Helper function to safely convert to Prisma JSON
function toPrismaJson<T>(data: T) {
  if (data === null) return null;
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
async function convertTweetForStorage(tweet: TweetV2) {
  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: toValidDate(tweet.created_at),
    updatedAt: new Date(),
    publicMetrics: tweet.public_metrics ? toPrismaJson(tweet.public_metrics) : null,
    editHistoryTweetIds: tweet.edit_history_tweet_ids || [],
    authorId: tweet.author_id || 'unknown'
  } as const
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

// Cache tweets in the database
export async function cacheTweets(tweets: TweetV2[], type: CacheType = CACHE_TYPES.CURRENT) {
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

  for (const tweet of tweets) {
    try {
      const tweetData = await convertTweetForStorage(tweet);
      const createdTweet = await (prisma as any).tweet.upsert({
        where: { id: tweet.id },
        create: tweetData,
        update: tweetData
      });

      await (prisma as any).tweetCache.update({
        where: { id: cache.id },
        data: {
          tweets: {
            connect: { id: createdTweet.id }
          }
        }
      });

      if (hasTweetEntities(tweet) && tweet.entities) {
        await storeTweetEntities(tweet.id, tweet.entities);
      }
    } catch (error) {
      console.error('[Twitter Storage] Error caching tweet:', tweet.id, error);
    }
  }

  return cache;
}

// Get cached tweets
export async function getCachedTweets(type: CacheType = CACHE_TYPES.CURRENT) {
  const cache = await (prisma as any).tweetCache.findFirst({
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
  })

  return { tweets: cache?.tweets || [] }
}

// Update selected tweets
export async function updateSelectedTweets(selected: string[]) {
  // Deactivate previous selected cache
  await (prisma as any).tweetCache.updateMany({
    where: {
      type: CACHE_TYPES.SELECTED,
      isActive: true
    },
    data: {
      isActive: false
    }
  })

  // Create new selected cache
  const cache = await (prisma as any).tweetCache.create({
    data: {
      type: CACHE_TYPES.SELECTED,
      isActive: true,
      tweets: {
        connect: selected.map(id => ({ id }))
      }
    }
  })

  return cache
}

// Get selected tweets
export async function getSelectedTweets() {
  const cache = await (prisma as any).tweetCache.findFirst({
    where: {
      type: CACHE_TYPES.SELECTED,
      isActive: true
    },
    include: {
      tweets: {
        include: {
          entities: true
        }
      }
    }
  })

  return { tweets: cache?.tweets || [] }
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