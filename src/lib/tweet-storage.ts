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

type CacheType = (typeof CACHE_TYPES)[keyof typeof CACHE_TYPES]

// Helper function to safely convert to Prisma JSON
function toPrismaJson<T>(data: T) {
  if (data === null) return null;
  return JSON.parse(JSON.stringify(data));
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
  // Ensure created_at is a valid date
  let createdAt: Date
  try {
    createdAt = tweet.created_at ? new Date(tweet.created_at) : new Date()
    if (isNaN(createdAt.getTime())) {
      console.warn('[Twitter Storage] Invalid date found in tweet:', tweet.id)
      createdAt = new Date()
    }
  } catch (error) {
    console.warn('[Twitter Storage] Error parsing date for tweet:', tweet.id, error)
    createdAt = new Date()
  }

  return {
    id: tweet.id,
    text: tweet.text,
    createdAt,
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
  console.log(`[Twitter Storage] Caching ${tweets.length} tweets of type ${type}`)

  const cache = await (prisma as any).tweetCache.create({
    data: {
      type,
      expiresAt: type === CACHE_TYPES.CURRENT ? new Date(Date.now() + FIFTEEN_MINUTES) : null,
      isActive: true
    }
  })

  for (const tweet of tweets) {
    try {
      const tweetData = await convertTweetForStorage(tweet)
      const createdTweet = await (prisma as any).tweet.upsert({
        where: { id: tweet.id },
        create: tweetData,
        update: tweetData
      })

      await (prisma as any).tweetCache.update({
        where: { id: cache.id },
        data: {
          tweets: {
            connect: { id: createdTweet.id }
          }
        }
      })

      if (hasTweetEntities(tweet) && tweet.entities) {
        await storeTweetEntities(tweet.id, tweet.entities)
      }
    } catch (error) {
      console.error('[Twitter Storage] Error caching tweet:', tweet.id, error)
    }
  }

  return cache
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
  return (prisma as any).twitterRateLimit.upsert({
    where: {
      endpoint
    },
    create: {
      endpoint,
      resetAt,
      remaining
    },
    update: {
      resetAt,
      remaining,
      lastUpdated: new Date()
    }
  })
}

export async function getRateLimit(endpoint: string) {
  return (prisma as any).twitterRateLimit.findUnique({
    where: {
      endpoint
    }
  })
}

export async function canMakeRequest(endpoint: string): Promise<boolean> {
  const rateLimit = await getRateLimit(endpoint)
  if (!rateLimit) return true

  const now = new Date()
  if (now > rateLimit.resetAt) return true
  return rateLimit.remaining > 0
} 