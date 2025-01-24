import { list } from '@vercel/blob'
import { prisma } from '../src/lib/db'
import { TweetV2, TweetEntitiesV2, TweetPublicMetricsV2 } from 'twitter-api-v2'
import { Prisma } from '@prisma/client'

// Helper to safely convert objects to Prisma.JsonValue
function toJsonValue<T extends object>(obj: T): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(obj)) as Prisma.JsonValue
}

async function migrateTweets() {
  try {
    console.log('Starting tweet migration...')

    // Get all tweet-related blobs
    const { blobs } = await list({ prefix: 'tweets/' })
    console.log('Found blobs:', blobs.map(b => b.pathname))

    // Process each blob
    for (const blob of blobs) {
      console.log(`Processing ${blob.pathname}...`)
      
      try {
        // Fetch blob content
        const response = await fetch(blob.url)
        if (!response.ok) {
          console.error(`Failed to fetch blob: ${blob.pathname}`)
          continue
        }

        const data = await response.json()
        if (!data?.tweets || !Array.isArray(data.tweets)) {
          console.error(`Invalid data structure in blob: ${blob.pathname}`)
          continue
        }

        // Determine cache type from pathname
        let cacheType = 'previous'
        if (blob.pathname.includes('current')) {
          cacheType = 'current'
        } else if (blob.pathname.includes('selected')) {
          cacheType = 'selected'
        }

        // Create cache entry
        const cache = await prisma.tweetCache.create({
          data: {
            type: cacheType,
            isActive: true,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
          }
        })

        // Process each tweet
        for (const tweet of data.tweets as TweetV2[]) {
          // Ensure created_at is a valid date
          let createdAt: Date
          try {
            createdAt = tweet.created_at ? new Date(tweet.created_at) : new Date()
            if (isNaN(createdAt.getTime())) {
              console.warn('Invalid date found in tweet:', tweet.id)
              createdAt = new Date()
            }
          } catch (error) {
            console.warn('Error parsing date for tweet:', tweet.id, error)
            createdAt = new Date()
          }

          // Convert public metrics to JsonValue
          const publicMetrics = tweet.public_metrics 
            ? toJsonValue(tweet.public_metrics as TweetPublicMetricsV2)
            : Prisma.JsonNull

          // Store tweet
          const storedTweet = await prisma.tweet.upsert({
            where: { id: tweet.id },
            create: {
              id: tweet.id,
              text: tweet.text,
              createdAt,
              publicMetrics,
              editHistoryTweetIds: tweet.edit_history_tweet_ids || [],
              authorId: tweet.author_id || 'unknown'
            },
            update: {
              text: tweet.text,
              createdAt,
              publicMetrics,
              editHistoryTweetIds: tweet.edit_history_tweet_ids || [],
              authorId: tweet.author_id || 'unknown'
            }
          })

          // Connect tweet to cache
          await prisma.tweetCache.update({
            where: { id: cache.id },
            data: {
              tweets: {
                connect: { id: storedTweet.id }
              }
            }
          })

          // Store entities if present
          if (tweet.entities) {
            await storeEntities(tweet.id, tweet.entities)
          }
        }

        console.log(`Successfully processed ${data.tweets.length} tweets from ${blob.pathname}`)
      } catch (error) {
        console.error(`Error processing blob ${blob.pathname}:`, error)
      }
    }

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

async function storeEntities(tweetId: string, entities: TweetEntitiesV2) {
  const entityPromises: Promise<any>[] = []

  if (entities.urls?.length) {
    entityPromises.push(...entities.urls.map(url => 
      prisma.tweetEntity.create({
        data: {
          type: 'url',
          text: url.display_url || url.url,
          url: url.url,
          expandedUrl: url.expanded_url,
          tweetId,
          metadata: toJsonValue(url)
        }
      })
    ))
  }

  if (entities.mentions?.length) {
    entityPromises.push(...entities.mentions.map(mention =>
      prisma.tweetEntity.create({
        data: {
          type: 'mention',
          text: mention.username,
          tweetId,
          metadata: toJsonValue(mention)
        }
      })
    ))
  }

  if (entities.hashtags?.length) {
    entityPromises.push(...entities.hashtags.map(hashtag =>
      prisma.tweetEntity.create({
        data: {
          type: 'hashtag',
          text: hashtag.tag,
          tweetId,
          metadata: toJsonValue(hashtag)
        }
      })
    ))
  }

  await Promise.all(entityPromises)
}

// Run migration
migrateTweets() 