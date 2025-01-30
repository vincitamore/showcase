import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi, TweetV2, TweetEntitiesV2 } from 'twitter-api-v2'
import { 
  getCachedTweets, 
  getSelectedTweets, 
  updateSelectedTweets,
  SELECTED_TWEET_COUNT 
} from '@/lib/tweet-storage'
import type { Tweet, TweetEntity } from '@prisma/client'
import { logger } from '@/lib/logger'

// Define the Tweet type with entities
type TweetWithEntities = Tweet & {
  entities: TweetEntity[];
};

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

// Helper function to check if a tweet has entities
function hasTweetEntities(tweet: TweetV2): boolean {
  if (!tweet.entities) return false;

  // Check for various entity types
  const hasUrls = !!tweet.entities.urls?.length;
  const hasMentions = !!tweet.entities.mentions?.length;
  const hasHashtags = !!tweet.entities.hashtags?.length;
  const hasAnnotations = !!tweet.entities.annotations?.length;
  const hasCashtags = !!tweet.entities.cashtags?.length;

  logger.debug('Tweet entity check', {
    tweetId: tweet.id,
    entities: {
      urls: hasUrls,
      mentions: hasMentions,
      hashtags: hasHashtags,
      annotations: hasAnnotations,
      cashtags: hasCashtags
    }
  });

  return hasUrls || hasMentions || hasHashtags || hasAnnotations || hasCashtags;
}

// Helper function to validate and clean tweet data
function validateTweet(tweet: TweetV2): TweetV2 | null {
  try {
    // Handle null/undefined
    if (!tweet) {
      logger.warn('Null or undefined tweet');
      return null;
    }

    // Create a clean copy of the tweet with empty entities
    const cleanTweet: TweetV2 = {
      id: tweet.id,
      text: tweet.text,
      edit_history_tweet_ids: tweet.edit_history_tweet_ids,
      public_metrics: tweet.public_metrics,
      entities: {
        urls: [],
        mentions: [],
        hashtags: [],
        cashtags: [],
        annotations: []
      } as TweetEntitiesV2
    };

    // Log the full tweet structure for debugging
    logger.debug('Validating tweet', {
      tweetId: tweet.id,
      hasEntities: !!tweet.entities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
      fullTweet: tweet
    });

    // Ensure required fields exist
    if (!cleanTweet.id || !cleanTweet.text || !Array.isArray(cleanTweet.edit_history_tweet_ids)) {
      logger.warn('Invalid tweet structure', {
        tweetId: tweet.id,
        hasText: !!tweet.text,
        hasEditHistory: Array.isArray(tweet.edit_history_tweet_ids)
      });
      return null;
    }

    // Handle created_at separately
    if (tweet.created_at) {
      try {
        // Try to parse the date, accepting both ISO strings and timestamps
        const date = new Date(tweet.created_at);
        if (!isNaN(date.getTime())) {
          cleanTweet.created_at = date.toISOString();
        } else {
          // If date is invalid, try parsing as a timestamp
          const timestamp = parseInt(tweet.created_at);
          if (!isNaN(timestamp)) {
            const timestampDate = new Date(timestamp);
            if (!isNaN(timestampDate.getTime())) {
              cleanTweet.created_at = timestampDate.toISOString();
            } else {
              logger.warn('Invalid date found in tweet', {
                tweetId: tweet.id,
                date: tweet.created_at,
                timestamp
              });
            }
          } else {
            logger.warn('Invalid date format in tweet', {
              tweetId: tweet.id,
              date: tweet.created_at
            });
          }
        }
      } catch (error) {
        logger.warn('Error parsing date for tweet', {
          tweetId: tweet.id,
          date: tweet.created_at,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Handle entities
    if (tweet.entities) {
      try {
        // Deep clone entities to avoid reference issues
        const clonedEntities = JSON.parse(JSON.stringify(tweet.entities));
        const entities = cleanTweet.entities as TweetEntitiesV2;
        
        // Validate and clean URLs
        if (Array.isArray(clonedEntities.urls)) {
          entities.urls = clonedEntities.urls.map((url: any) => ({
            start: url.start || url.indices?.[0] || 0,
            end: url.end || url.indices?.[1] || 0,
            url: url.url || '',
            expanded_url: url.expanded_url || url.url || '',
            display_url: url.display_url || url.expanded_url || url.url || '',
            title: url.title,
            description: url.description,
            unwound_url: url.unwound_url,
            images: url.images?.map((img: any) => ({
              url: img.url,
              width: img.width || 0,
              height: img.height || 0
            }))
          }));
        }

        // Copy other entity types if they exist
        if (Array.isArray(clonedEntities.mentions)) {
          entities.mentions = clonedEntities.mentions.map((mention: any) => ({
            start: mention.start || mention.indices?.[0] || 0,
            end: mention.end || mention.indices?.[1] || 0,
            username: mention.username || '',
            id: mention.id || ''
          }));
        }
        if (Array.isArray(clonedEntities.hashtags)) {
          entities.hashtags = clonedEntities.hashtags.map((hashtag: any) => ({
            start: hashtag.start || hashtag.indices?.[0] || 0,
            end: hashtag.end || hashtag.indices?.[1] || 0,
            tag: hashtag.tag || hashtag.text || ''
          }));
        }
        if (Array.isArray(clonedEntities.cashtags)) {
          entities.cashtags = clonedEntities.cashtags.map((cashtag: any) => ({
            start: cashtag.start || cashtag.indices?.[0] || 0,
            end: cashtag.end || cashtag.indices?.[1] || 0,
            tag: cashtag.tag || cashtag.text || ''
          }));
        }
        if (Array.isArray(clonedEntities.annotations)) {
          entities.annotations = clonedEntities.annotations.map((annotation: any) => ({
            start: annotation.start || annotation.indices?.[0] || 0,
            end: annotation.end || annotation.indices?.[1] || 0,
            probability: annotation.probability || 0,
            type: annotation.type || '',
            normalized_text: annotation.normalized_text || ''
          }));
        }

        // Log entity processing results
        logger.debug('Processed entities', {
          tweetId: tweet.id,
          entityTypes: Object.keys(entities),
          urlCount: entities.urls.length,
          mentionCount: entities.mentions.length,
          hashtagCount: entities.hashtags.length,
          annotationCount: entities.annotations.length,
          cashtagCount: entities.cashtags.length
        });
      } catch (error) {
        logger.warn('Error processing entities', {
          tweetId: tweet.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return cleanTweet;
  } catch (error) {
    logger.warn('Error validating tweet', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tweetId: tweet?.id
    });
    return null;
  }
}

// Helper function to get random items from array with priority for tweets with entities
function getRandomItems(array: TweetV2[], count: number): TweetV2[] {
  logger.info('Starting tweet selection', {
    inputCount: array?.length,
    requestedCount: count,
    timestamp: new Date().toISOString()
  });

  if (!array?.length || count <= 0) {
    logger.warn('Invalid input for getRandomItems', {
      arrayLength: array?.length,
      requestedCount: count
    });
    return [];
  }

  // Validate and clean tweets before processing
  const validTweets = array
    .map(tweet => {
      const validated = validateTweet(tweet);
      if (!validated) {
        logger.info('Tweet failed validation', { tweetId: tweet.id });
      }
      return validated;
    })
    .filter((tweet): tweet is TweetV2 => tweet !== null);

  logger.info('Validation results', {
    inputCount: array.length,
    validCount: validTweets.length,
    invalidCount: array.length - validTweets.length
  });

  if (validTweets.length === 0) {
    logger.warn('No valid tweets found after validation');
    return [];
  }

  // Separate tweets with and without entities
  const tweetsWithEntities = validTweets.filter(tweet => {
    const hasEntities = hasTweetEntities(tweet);
    logger.debug('Entity check', {
      tweetId: tweet.id,
      hasEntities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : []
    });
    return hasEntities;
  });
  const tweetsWithoutEntities = validTweets.filter(tweet => !hasTweetEntities(tweet));
  
  logger.info('Tweet categorization', {
    totalValid: validTweets.length,
    withEntities: tweetsWithEntities.length,
    withoutEntities: tweetsWithoutEntities.length,
    requestedCount: count
  });
  
  // Shuffle both arrays
  const shuffledWithEntities = [...tweetsWithEntities].sort(() => 0.5 - Math.random());
  const shuffledWithoutEntities = [...tweetsWithoutEntities].sort(() => 0.5 - Math.random());
  
  // Take as many tweets with entities as we can
  const result = shuffledWithEntities.slice(0, count);
  
  // If we need more tweets, fill with tweets without entities
  if (result.length < count) {
    const remaining = count - result.length;
    const additionalTweets = shuffledWithoutEntities.slice(0, remaining);
    logger.info('Adding tweets without entities', {
      needed: remaining,
      available: shuffledWithoutEntities.length,
      adding: additionalTweets.length
    });
    result.push(...additionalTweets);
  }
  
  logger.info('Final selection', {
    totalSelected: result.length,
    withEntities: result.filter(hasTweetEntities).length,
    withoutEntities: result.filter(t => !hasTweetEntities(t)).length,
    selectedIds: result.map(t => t.id)
  });
  
  return result;
}

function logStatus(message: string, data?: Record<string, unknown>) {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timeString = `${hours}:${minutes}:${seconds}`;
  const dataString = data ? ` ${JSON.stringify(data)}` : '';
  logger.info(`API ${timeString} ${message}${dataString}`);
}

export async function GET() {
  logger.info('Starting tweet fetch', {
    route: 'api/twitter/tweets'
  });

  try {
    // First try to get selected tweets
    const selectedTweets = await getSelectedTweets();
    
    // Only use selected tweets if we have enough of them
    if (selectedTweets?.length === SELECTED_TWEET_COUNT) {
      logger.info('Using selected tweets', {
        count: selectedTweets.length,
        tweetIds: selectedTweets.map((t: TweetV2) => t.id)
      });
      return NextResponse.json({ tweets: selectedTweets });
    }

    // If no selected tweets or not enough, get all available tweets
    const cachedTweets = await getCachedTweets();
    
    if (!cachedTweets?.tweets?.length) {
      logger.warn('No cached tweets available', {
        route: 'api/twitter/tweets'
      });
      return NextResponse.json({ tweets: [] });
    }

    logger.info('Using cached tweets', {
      count: cachedTweets.tweets.length,
      tweetIds: cachedTweets.tweets.map((t: TweetWithEntities) => t.id)
    });

    return NextResponse.json({ tweets: cachedTweets.tweets });
  } catch (error) {
    logger.error('Failed to fetch tweets', {
      error: error instanceof Error ? error.message : 'Unknown error',
      route: 'api/twitter/tweets'
    });
    return NextResponse.json({ tweets: [] });
  }
}

export async function POST(req: Request) {
  try {
    const accessToken = cookies().get('x_access_token')?.value;
    
    if (!accessToken) {
      logger.warn('Missing access token for tweet post', {
        route: 'api/twitter/tweets'
      });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { text } = await req.json();
    
    if (!text?.trim()) {
      logger.warn('Missing tweet text', {
        route: 'api/twitter/tweets'
      });
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const client = new TwitterApi(accessToken);
    const tweet = await client.v2.tweet(text);
    
    logger.info('Tweet posted successfully', {
      tweetId: tweet.data.id,
      route: 'api/twitter/tweets'
    });
    
    return NextResponse.json(tweet);
  } catch (error) {
    logger.error('Failed to post tweet', {
      error: error instanceof Error ? error.message : 'Unknown error',
      route: 'api/twitter/tweets'
    });
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    );
  }
} 