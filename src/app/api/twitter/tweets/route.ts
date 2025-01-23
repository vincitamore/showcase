import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi, TweetV2 } from 'twitter-api-v2'
import { getCachedTweets, getSelectedTweets } from '@/lib/blob-storage'

export const dynamic = 'force-dynamic'

// Helper function to check if a tweet has entities with URLs
function hasTweetEntities(tweet: TweetV2): boolean {
  return !!tweet.entities?.urls && tweet.entities.urls.length > 0
}

// Helper function to safely convert dates
function safeISOString(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn('[Twitter] Invalid date found:', dateStr);
      return undefined;
    }
    return date.toISOString();
  } catch (error) {
    console.warn('[Twitter] Error parsing date:', dateStr, error);
    return undefined;
  }
}

// Helper function to validate and clean tweet data
function validateTweet(tweet: any): TweetV2 {
  // Ensure created_at is a valid date if it exists
  if (tweet.created_at) {
    tweet.created_at = safeISOString(tweet.created_at);
  }
  
  // Ensure required fields exist
  if (!tweet.id || !tweet.text || !Array.isArray(tweet.edit_history_tweet_ids)) {
    console.warn('[Twitter] Invalid tweet structure:', tweet);
    throw new Error('Invalid tweet structure');
  }

  return tweet as TweetV2;
}

// Helper function to get random items from array with priority for tweets with entities
function getRandomItems<T extends TweetV2>(array: T[], count: number): T[] {
  if (!array?.length || count <= 0) {
    return [];
  }

  // Validate and clean tweets before processing
  const validTweets = array.filter(tweet => {
    try {
      validateTweet(tweet);
      return true;
    } catch (error) {
      console.warn('[Twitter] Filtering out invalid tweet:', tweet?.id);
      return false;
    }
  });

  // Separate tweets with and without entities
  const tweetsWithEntities = validTweets.filter(hasTweetEntities)
  const tweetsWithoutEntities = validTweets.filter(tweet => !hasTweetEntities(tweet))
  
  console.log('Tweet selection stats:', {
    totalTweets: validTweets.length,
    withEntities: tweetsWithEntities.length,
    withoutEntities: tweetsWithoutEntities.length
  })
  
  // If we have enough tweets with entities, use those first
  if (tweetsWithEntities.length >= count) {
    const shuffled = [...tweetsWithEntities].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }
  
  // Otherwise, fill remaining slots with tweets without entities
  const shuffledWithEntities = [...tweetsWithEntities].sort(() => 0.5 - Math.random())
  const shuffledWithoutEntities = [...tweetsWithoutEntities].sort(() => 0.5 - Math.random())
  const remaining = count - shuffledWithEntities.length
  
  return [
    ...shuffledWithEntities,
    ...shuffledWithoutEntities.slice(0, remaining)
  ]
}

export async function GET() {
  try {
    console.log('Fetching cached tweets...')
    const cachedData = await getCachedTweets()
    
    if (!cachedData?.tweets || cachedData.tweets.length === 0) {
      console.log('No cached tweets found')
      return NextResponse.json({ tweets: [] })
    }
    
    // Get selected tweets with full data including entities
    const selectedTweets = await getSelectedTweets()
    console.log('Selected tweets response:', selectedTweets)
    
    if (selectedTweets && selectedTweets.tweets && selectedTweets.tweets.length > 0) {
      // Validate and clean selected tweets
      const validSelectedTweets = selectedTweets.tweets.filter(tweet => {
        try {
          validateTweet(tweet);
          return true;
        } catch (error) {
          console.warn('[Twitter] Filtering out invalid selected tweet:', tweet?.id);
          return false;
        }
      });

      console.log('Using selected tweets with entities:', {
        count: validSelectedTweets.length,
        tweets: validSelectedTweets.map(t => ({
          id: t.id,
          text: t.text.substring(0, 50) + '...',
          hasEntities: hasTweetEntities(t),
          urlCount: t.entities?.urls?.length || 0
        }))
      })
      return NextResponse.json({ tweets: validSelectedTweets })
    }
    
    // Fallback to random tweets from cache, prioritizing those with entities
    const tweetsToReturn = getRandomItems(cachedData.tweets, Math.min(4, cachedData.tweets.length))
    
    console.log('Returning tweets:', {
      availableInCache: cachedData.tweets.length,
      returning: tweetsToReturn.length,
      tweets: tweetsToReturn.map(t => ({
        id: t.id,
        text: t.text.substring(0, 50) + '...',
        hasEntities: hasTweetEntities(t),
        urlCount: t.entities?.urls?.length || 0
      }))
    })
    
    return NextResponse.json({ tweets: tweetsToReturn })
  } catch (error) {
    console.error('Error getting selected tweets:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch tweets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
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