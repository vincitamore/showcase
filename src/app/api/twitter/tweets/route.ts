import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi, TweetV2 } from 'twitter-api-v2'
import { getCachedTweets, getSelectedTweets } from '@/lib/blob-storage'

export const dynamic = 'force-dynamic'

// Helper function to check if a tweet has entities with URLs
function hasTweetEntities(tweet: TweetV2): boolean {
  return !!tweet.entities?.urls && tweet.entities.urls.length > 0
}

// Helper function to validate and clean tweet data
function validateTweet(tweet: TweetV2): TweetV2 | null {
  try {
    // Handle null/undefined
    if (!tweet) {
      console.warn('[Twitter] Null or undefined tweet');
      return null;
    }

    // Create a clean copy of the tweet
    const cleanTweet = {
      id: tweet.id,
      text: tweet.text,
      edit_history_tweet_ids: tweet.edit_history_tweet_ids,
      entities: tweet.entities,
      public_metrics: tweet.public_metrics
    } as TweetV2;

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
    validDates: validTweets.filter(t => !!t.created_at).length
  });
  
  // If we have enough tweets with entities, use those first
  if (tweetsWithEntities.length >= count) {
    const shuffled = [...tweetsWithEntities].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  // Otherwise, fill remaining slots with tweets without entities
  const shuffledWithEntities = [...tweetsWithEntities].sort(() => 0.5 - Math.random());
  const shuffledWithoutEntities = [...tweetsWithoutEntities].sort(() => 0.5 - Math.random());
  const remaining = count - shuffledWithEntities.length;
  
  return [
    ...shuffledWithEntities,
    ...shuffledWithoutEntities.slice(0, remaining)
  ];
}

export async function GET() {
  try {
    console.log('Fetching cached tweets...');
    const cachedData = await getCachedTweets();
    
    if (!cachedData?.tweets || !Array.isArray(cachedData.tweets) || cachedData.tweets.length === 0) {
      console.log('No cached tweets found');
      return NextResponse.json({ tweets: [] });
    }

    // Validate tweets before aggregating
    const validTweets = cachedData.tweets
      .map(tweet => validateTweet(tweet))
      .filter((tweet): tweet is TweetV2 => tweet !== null);

    console.log('Aggregated unique tweets:', {
      totalBlobs: cachedData.tweets.length,
      uniqueTweets: new Set(validTweets.map(t => t.id)).size,
      withEntities: validTweets.filter(t => hasTweetEntities(t)).length,
      validDates: validTweets.filter(t => !!t.created_at).length,
      tweetIds: validTweets.map(t => t.id)
    });
    
    // Get selected tweets with full data including entities
    const selectedTweets = await getSelectedTweets();
    console.log('Getting selected tweets...');
    
    if (selectedTweets?.tweets && Array.isArray(selectedTweets.tweets) && selectedTweets.tweets.length > 0) {
      // Validate and clean selected tweets
      const validSelectedTweets = selectedTweets.tweets
        .map(tweet => validateTweet(tweet))
        .filter((tweet): tweet is TweetV2 => tweet !== null);

      if (validSelectedTweets.length > 0) {
        console.log('Using selected tweets:', {
          count: validSelectedTweets.length,
          tweets: validSelectedTweets.map(t => ({
            id: t.id,
            text: t.text.substring(0, 50) + '...',
            hasEntities: hasTweetEntities(t),
            urlCount: t.entities?.urls?.length || 0,
            hasDate: !!t.created_at
          }))
        });
        return NextResponse.json({ tweets: validSelectedTweets });
      }
    }
    
    // Fallback to random tweets from cache, prioritizing those with entities
    const tweetsToReturn = getRandomItems(validTweets, Math.min(4, validTweets.length));
    
    console.log('Returning tweets:', {
      availableInCache: validTweets.length,
      returning: tweetsToReturn.length,
      tweets: tweetsToReturn.map(t => ({
        id: t.id,
        text: t.text.substring(0, 50) + '...',
        hasEntities: hasTweetEntities(t),
        urlCount: t.entities?.urls?.length || 0,
        hasDate: !!t.created_at
      }))
    });
    
    return NextResponse.json({ tweets: tweetsToReturn });
  } catch (error) {
    console.error('Error getting selected tweets:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch tweets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const accessToken = cookies().get('x_access_token')?.value
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { text } = await req.json()
    
    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const client = new TwitterApi(accessToken)
    const tweet = await client.v2.tweet(text)
    return NextResponse.json(tweet)
  } catch (error) {
    console.error('Error posting tweet:', error)
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    )
  }
} 