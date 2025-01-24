import { NextResponse } from 'next/server';
import { getReadOnlyClient } from '@/lib/x-api';
import { 
  cacheTweets,
  getRateLimitTimestamp,
  updateRateLimitTimestamp,
  getCachedTweets,
  canMakeRequest,
  updateSelectedTweets
} from '@/lib/blob-storage';
import { TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2, UserV2, MediaObjectV2 } from 'twitter-api-v2';
import { TwitterApi } from 'twitter-api-v2';

interface TweetWithAuthor extends TweetV2 {
  author?: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
  media?: MediaObjectV2[];
}

// Helper function to extract user data from includes
function extractUserData(includes: any): Map<string, UserV2> {
  if (!includes?.users) return new Map();
  
  const userMap = new Map<string, UserV2>();
  includes.users.forEach((user: UserV2) => {
    if (user.id) {
      userMap.set(user.id, {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
        profile_image_url: user.profile_image_url
      });
    }
  });
  
  return userMap;
}

// Helper function to extract media data from includes
function extractMediaData(includes: any): Map<string, MediaObjectV2> {
  if (!includes?.media) return new Map();
  
  const mediaMap = new Map<string, MediaObjectV2>();
  includes.media.forEach((media: MediaObjectV2) => {
    if (media.media_key) {
      mediaMap.set(media.media_key, media);
    }
  });
  
  return mediaMap;
}

// Helper function to validate and clean tweet data
function validateTweet(
  tweet: TweetV2, 
  userData?: Map<string, UserV2>,
  mediaData?: Map<string, MediaObjectV2>
): TweetWithAuthor | null {
  try {
    const cleanTweet: TweetWithAuthor = {
      ...tweet,
      entities: tweet.entities || {
        urls: [],
        mentions: [],
        hashtags: [],
        cashtags: [],
        annotations: []
      }
    };

    // Add author data if available
    if (tweet.author_id && userData?.has(tweet.author_id)) {
      cleanTweet.author = userData.get(tweet.author_id);
    }

    // Add media data if available
    if (tweet.attachments?.media_keys?.length && mediaData) {
      cleanTweet.media = tweet.attachments.media_keys
        .map(key => mediaData.get(key))
        .filter((media): media is MediaObjectV2 => media !== undefined);
    }

    // Handle created_at - try multiple formats
    if (tweet.created_at) {
      try {
        // First try parsing as ISO string
        const date = new Date(tweet.created_at);
        if (!isNaN(date.getTime())) {
          cleanTweet.created_at = date.toISOString();
        } else {
          // Try parsing as a timestamp
          const timestamp = parseInt(tweet.created_at);
          if (!isNaN(timestamp)) {
            const timestampDate = new Date(timestamp);
            if (!isNaN(timestampDate.getTime())) {
              cleanTweet.created_at = timestampDate.toISOString();
            }
          }
        }
      } catch (error) {
        console.warn('[Init] Error parsing date for tweet:', {
          id: tweet.id,
          date: tweet.created_at,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Set current time if no valid date was found
    if (!cleanTweet.created_at) {
      cleanTweet.created_at = new Date().toISOString();
    }

    return cleanTweet;
  } catch (error) {
    console.error('[Init] Error validating tweet:', {
      id: tweet.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

// Helper function to get random items from an array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// This route is called during build/deployment to initialize tweets
export async function GET(request: Request) {
  try {
    const client = await getReadOnlyClient();
    
    // Search for tweets containing ".build"
    const searchResults = await client.search('.build', {
      'tweet.fields': ['created_at', 'public_metrics', 'entities', 'attachments'],
      'user.fields': ['profile_image_url', 'username', 'name'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['author_id', 'attachments.media_keys'],
      max_results: 10
    });

    // Extract user and media data
    const userData = extractUserData(searchResults.includes);
    const mediaData = extractMediaData(searchResults.includes);

    // Validate and clean tweets
    const tweets = searchResults.data?.data || [];
    const validTweets = tweets
      .map(tweet => validateTweet(tweet, userData, mediaData))
      .filter((tweet): tweet is TweetWithAuthor => tweet !== null);

    console.log('[Init] Validated tweets:', {
      total: tweets.length,
      valid: validTweets.length
    });

    // Cache the valid tweets
    await cacheTweets(validTweets);
    await updateRateLimitTimestamp();

    // Select random tweets for display
    const selectedTweets = getRandomItems(validTweets, 4);
    await updateSelectedTweets(selectedTweets);

    console.log('[Init] Successfully cached and selected tweets:', {
      cached: validTweets.length,
      selected: selectedTweets.length
    });

    return NextResponse.json({ 
      success: true,
      tweetsCount: validTweets.length,
      selectedCount: selectedTweets.length,
      fromCache: false
    });
  } catch (error) {
    console.error('[Init] Error during initial tweet fetch:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ 
      error: 'Failed to fetch initial tweets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
