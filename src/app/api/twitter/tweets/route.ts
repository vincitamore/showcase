import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi, TweetV2, TweetEntitiesV2 } from 'twitter-api-v2'
import { getCachedTweets, getSelectedTweets, SELECTED_TWEET_COUNT } from '@/lib/tweet-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

// Helper function to check if a tweet has entities with URLs
function hasTweetEntities(tweet: TweetV2): boolean {
  // Log the full entities structure for debugging
  console.log('[Twitter] Checking entities for tweet:', {
    id: tweet.id,
    hasEntities: !!tweet.entities,
    entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
    urlCount: tweet.entities?.urls?.length || 0,
    fullEntities: tweet.entities
  });

  // Check for any type of entity, not just URLs
  if (!tweet.entities) return false;

  // Check for various entity types that exist in TweetEntitiesV2
  const hasUrls = !!tweet.entities.urls?.length;
  const hasMentions = !!tweet.entities.mentions?.length;
  const hasHashtags = !!tweet.entities.hashtags?.length;
  const hasAnnotations = !!tweet.entities.annotations?.length;
  const hasCashtags = !!tweet.entities.cashtags?.length;

  const hasAnyEntity = hasUrls || hasMentions || hasHashtags || hasAnnotations || hasCashtags;

  // Log detailed entity presence
  console.log('[Twitter] Entity detection result:', {
    id: tweet.id,
    hasUrls,
    hasMentions,
    hasHashtags,
    hasAnnotations,
    hasCashtags,
    hasAnyEntity
  });

  return hasAnyEntity;
}

// Helper function to validate and clean tweet data
function validateTweet(tweet: TweetV2): TweetV2 | null {
  try {
    // Handle null/undefined
    if (!tweet) {
      console.warn('[Twitter] Null or undefined tweet');
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
    console.log('[Twitter] Validating tweet:', {
      id: tweet.id,
      hasEntities: !!tweet.entities,
      entityTypes: tweet.entities ? Object.keys(tweet.entities) : [],
      fullTweet: tweet
    });

    // Ensure required fields exist
    if (!cleanTweet.id || !cleanTweet.text || !Array.isArray(cleanTweet.edit_history_tweet_ids)) {
      console.warn('[Twitter] Invalid tweet structure:', {
        id: tweet.id,
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
              console.warn('[Twitter] Invalid date found in tweet:', {
                id: tweet.id,
                date: tweet.created_at,
                timestamp
              });
            }
          } else {
            console.warn('[Twitter] Invalid date format in tweet:', {
              id: tweet.id,
              date: tweet.created_at
            });
          }
        }
      } catch (error) {
        console.warn('[Twitter] Error parsing date for tweet:', {
          id: tweet.id,
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
        console.log('[Twitter] Processed entities:', {
          id: tweet.id,
          entityTypes: Object.keys(entities),
          urlCount: entities.urls.length,
          mentionCount: entities.mentions.length,
          hashtagCount: entities.hashtags.length,
          annotationCount: entities.annotations.length,
          cashtagCount: entities.cashtags.length
        });
      } catch (error) {
        console.warn('[Twitter] Error processing entities:', {
          id: tweet.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return cleanTweet;
  } catch (error) {
    console.warn('[Twitter] Error validating tweet:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tweet: tweet?.id
    });
    return null;
  }
}

// Helper function to get random items from array with priority for tweets with entities
function getRandomItems(array: TweetV2[], count: number): TweetV2[] {
  if (!array?.length || count <= 0) {
    console.warn('[Twitter] Invalid input for getRandomItems:', {
      arrayLength: array?.length,
      requestedCount: count
    });
    return [];
  }

  // Validate and clean tweets before processing
  const validTweets = array
    .map(tweet => validateTweet(tweet))
    .filter((tweet): tweet is TweetV2 => tweet !== null);

  if (validTweets.length === 0) {
    console.warn('[Twitter] No valid tweets found after validation');
    return [];
  }

  // Separate tweets with and without entities
  const tweetsWithEntities = validTweets.filter(hasTweetEntities);
  const tweetsWithoutEntities = validTweets.filter(tweet => !hasTweetEntities(tweet));
  
  console.log('Tweet selection stats:', {
    totalTweets: validTweets.length,
    withEntities: tweetsWithEntities.length,
    withoutEntities: tweetsWithoutEntities.length,
    validDates: validTweets.filter(t => !!t.created_at).length,
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
    result.push(...shuffledWithoutEntities.slice(0, remaining));
  }
  
  console.log('Final tweet selection:', {
    selectedCount: result.length,
    withEntities: result.filter(hasTweetEntities).length,
    withoutEntities: result.filter(t => !hasTweetEntities(t)).length
  });
  
  return result;
}

function logStatus(message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:mm:ss only
  console.log(`[API ${timestamp}] ${message}`, data ? JSON.stringify(data) : '');
}

export async function GET() {
  try {
    // First try to get selected tweets
    const selectedTweets = await getSelectedTweets();
    if (selectedTweets?.length) {
      console.log('[Twitter] Using selected tweets:', {
        count: selectedTweets.length,
        ids: selectedTweets.map(t => t.id)
      });
      return NextResponse.json({ tweets: selectedTweets });
    }

    // If no selected tweets, get cached tweets
    const cachedTweets = await getCachedTweets();
    if (!cachedTweets?.tweets?.length) {
      console.warn('[Twitter] No cached tweets found');
      return NextResponse.json({ tweets: [] });
    }

    // Get random tweets from the cache, prioritizing those with entities
    const selectedFromCache = getRandomItems(cachedTweets.tweets, SELECTED_TWEET_COUNT);
    console.log('[Twitter] Selected tweets from cache:', {
      totalCached: cachedTweets.tweets.length,
      selected: selectedFromCache.length,
      ids: selectedFromCache.map(t => t.id)
    });

    return NextResponse.json({ tweets: selectedFromCache });
  } catch (error) {
    console.error('[Twitter] Error getting tweets:', error);
    return NextResponse.json({ tweets: [] });
  }
}

export async function POST(req: Request) {
  try {
    const accessToken = cookies().get('x_access_token')?.value;
    
    if (!accessToken) {
      logStatus('Missing access token');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { text } = await req.json();
    
    if (!text?.trim()) {
      logStatus('Missing tweet text');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const client = new TwitterApi(accessToken);
    const tweet = await client.v2.tweet(text);
    logStatus('Tweet posted', { id: tweet.data.id });
    return NextResponse.json(tweet);
  } catch (error) {
    logStatus('Error posting tweet', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    );
  }
} 