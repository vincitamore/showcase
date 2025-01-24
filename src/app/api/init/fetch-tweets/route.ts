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
import { TwitterApiv2, TweetV2, TweetPublicMetricsV2, TweetEntitiesV2 } from 'twitter-api-v2';

// Interface to match TweetV2 structure but only include what we need
interface StoredTweet {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
  created_at?: string;
  public_metrics?: TweetPublicMetricsV2;
  entities?: TweetEntitiesV2;
}

function convertToStoredTweet(tweet: TweetV2): StoredTweet {
  // Ensure created_at is a valid ISO string if it exists
  let created_at: string | undefined;
  if (tweet.created_at) {
    try {
      // Parse and validate the date
      const date = new Date(tweet.created_at);
      if (isNaN(date.getTime())) {
        console.warn('[Init] Invalid date found in tweet:', tweet.id);
        created_at = undefined;
      } else {
        created_at = date.toISOString();
      }
    } catch (error) {
      console.warn('[Init] Error parsing date for tweet:', tweet.id, error);
      created_at = undefined;
    }
  }

  // Process entities if they exist
  let entities: TweetEntitiesV2 | undefined;
  if (tweet.entities) {
    try {
      // Deep clone and validate entities
      const clonedEntities = JSON.parse(JSON.stringify(tweet.entities));
      entities = {
        urls: [],
        mentions: [],
        hashtags: [],
        cashtags: [],
        annotations: []
      };

      // Process URLs
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

      // Process mentions
      if (Array.isArray(clonedEntities.mentions)) {
        entities.mentions = clonedEntities.mentions.map((mention: any) => ({
          start: mention.start || mention.indices?.[0] || 0,
          end: mention.end || mention.indices?.[1] || 0,
          username: mention.username || '',
          id: mention.id || ''
        }));
      }

      // Process hashtags
      if (Array.isArray(clonedEntities.hashtags)) {
        entities.hashtags = clonedEntities.hashtags.map((hashtag: any) => ({
          start: hashtag.start || hashtag.indices?.[0] || 0,
          end: hashtag.end || hashtag.indices?.[1] || 0,
          tag: hashtag.tag || hashtag.text || ''
        }));
      }

      // Process cashtags
      if (Array.isArray(clonedEntities.cashtags)) {
        entities.cashtags = clonedEntities.cashtags.map((cashtag: any) => ({
          start: cashtag.start || cashtag.indices?.[0] || 0,
          end: cashtag.end || cashtag.indices?.[1] || 0,
          tag: cashtag.tag || cashtag.text || ''
        }));
      }

      // Process annotations
      if (Array.isArray(clonedEntities.annotations)) {
        entities.annotations = clonedEntities.annotations.map((annotation: any) => ({
          start: annotation.start || annotation.indices?.[0] || 0,
          end: annotation.end || annotation.indices?.[1] || 0,
          probability: annotation.probability || 0,
          type: annotation.type || '',
          normalized_text: annotation.normalized_text || ''
        }));
      }

      console.log('[Init] Processed entities for tweet:', {
        id: tweet.id,
        entityTypes: Object.keys(entities),
        urlCount: entities.urls.length,
        mentionCount: entities.mentions.length,
        hashtagCount: entities.hashtags.length,
        annotationCount: entities.annotations.length,
        cashtagCount: entities.cashtags.length
      });
    } catch (error) {
      console.warn('[Init] Error processing entities:', error);
      entities = undefined;
    }
  }

  return {
    id: tweet.id,
    text: tweet.text,
    edit_history_tweet_ids: tweet.edit_history_tweet_ids,
    created_at,
    public_metrics: tweet.public_metrics,
    entities
  };
}

// Helper function to get random items from array
function getRandomItems<T>(array: T[], count: number): T[] {
  if (!array?.length || count <= 0) {
    return [];
  }
  // Ensure we don't try to get more items than exist
  const safeCount = Math.min(count, array.length);
  return [...array].sort(() => Math.random() - 0.5).slice(0, safeCount);
}

async function searchBuildTweets(client: TwitterApiv2): Promise<StoredTweet[]> {
  console.log('[Init] Searching for .build tweets...');
  const paginator = await client.search('.build', {
    'tweet.fields': ['created_at', 'public_metrics', 'entities'],
    'user.fields': ['profile_image_url', 'username', 'name'],
    'media.fields': ['url', 'preview_image_url'],
    expansions: ['author_id', 'attachments.media_keys'],
    max_results: 10,
  });

  const page = await paginator.fetchNext();
  if (!page?.data) {
    console.log('[Init] No .build tweets found');
    return [];
  }

  const tweets = Array.isArray(page.data) ? page.data : [page.data];
  console.log('[Init] Found .build tweets:', {
    count: tweets.length,
    withEntities: tweets.filter(t => !!t.entities).length,
    sampleTweet: tweets[0] ? {
      id: tweets[0].id,
      text: tweets[0].text.substring(0, 50) + '...',
      hasEntities: !!tweets[0].entities,
      urlCount: tweets[0].entities?.urls?.length || 0
    } : null
  });
  return tweets.map(tweet => convertToStoredTweet(tweet));
}

async function getUserTweets(client: TwitterApiv2, username: string): Promise<StoredTweet[]> {
  console.log('[Init] Fetching user tweets...');
  const user = await client.userByUsername(username);
  if (!user?.data) {
    throw new Error('User not found');
  }

  const paginator = await client.userTimeline(user.data.id, {
    exclude: ['replies', 'retweets'],
    'tweet.fields': ['created_at', 'public_metrics', 'entities'],
    'user.fields': ['profile_image_url', 'username', 'name'],
    'media.fields': ['url', 'preview_image_url'],
    expansions: ['author_id', 'attachments.media_keys'],
    max_results: 10,
  });

  const page = await paginator.fetchNext();
  if (!page?.data) {
    console.log('[Init] No user tweets found');
    return [];
  }

  const tweets = Array.isArray(page.data) ? page.data : [page.data];
  console.log('[Init] Found user tweets:', {
    count: tweets.length,
    withEntities: tweets.filter(t => !!t.entities).length,
    sampleTweet: tweets[0] ? {
      id: tweets[0].id,
      text: tweets[0].text.substring(0, 50) + '...',
      hasEntities: !!tweets[0].entities,
      urlCount: tweets[0].entities?.urls?.length || 0
    } : null
  });
  return tweets.map(tweet => convertToStoredTweet(tweet));
}

// This route is called during build/deployment to initialize tweets
export async function GET(request: Request) {
  console.log('[Init] Starting initial tweet fetch...');
  
  try {
    // Verify the request is from our deployment
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('[Init] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if we can make a request based on rate limit
    const canRequest = await canMakeRequest(Date.now());
    if (!canRequest) {
      const lastUpdate = await getRateLimitTimestamp();
      console.log('[Init] Rate limited, last update:', lastUpdate);
      
      // Get cached tweets instead
      const rawCachedTweets = await getCachedTweets();
      const cachedTweets = Array.isArray(rawCachedTweets) ? rawCachedTweets as StoredTweet[] : [];
      if (!cachedTweets.length) {
        return NextResponse.json({ 
          message: 'Rate limited and no cached tweets available'
        });
      }

      // Select random tweets from cache
      const selectedTweets = getRandomItems(cachedTweets, 4);
      await updateSelectedTweets(selectedTweets);

      console.log('[Init] Used cached tweets due to rate limit');
      return NextResponse.json({ 
        success: true,
        tweetsCount: cachedTweets.length,
        selectedCount: selectedTweets.length,
        fromCache: true
      });
    }

    const client = await getReadOnlyClient();
    const username = process.env.NEXT_PUBLIC_TWITTER_USERNAME;
    
    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // Search for .build tweets first
    let tweets = await searchBuildTweets(client as TwitterApiv2);

    // If no .build tweets, get tweets from configured user
    if (tweets.length === 0) {
      tweets = await getUserTweets(client as TwitterApiv2, username);
    }

    if (tweets.length === 0) {
      console.log('[Init] No tweets found');
      return NextResponse.json({ 
        message: 'No tweets found to cache'
      });
    }

    // Validate tweets before caching
    const validTweets = tweets.filter(tweet => {
      // Ensure all required fields are present
      const isValid = tweet.id && tweet.text && Array.isArray(tweet.edit_history_tweet_ids);
      if (!isValid) {
        console.log('[Init] Filtering out invalid tweet:', tweet.id);
      }
      return isValid;
    });

    if (validTweets.length === 0) {
      console.log('[Init] No valid tweets found after filtering');
      return NextResponse.json({ 
        message: 'No valid tweets found to cache'
      });
    }

    // Cache the valid tweets
    await cacheTweets(validTweets);
    await updateRateLimitTimestamp();

    // Select random tweets for display
    const selectedTweets = getRandomItems(validTweets, 4);
    await updateSelectedTweets(selectedTweets);

    console.log('[Init] Successfully cached and selected tweets');
    return NextResponse.json({ 
      success: true,
      tweetsCount: validTweets.length,
      selectedCount: selectedTweets.length,
      fromCache: false
    });
  } catch (error) {
    console.error('[Init] Error during initial tweet fetch:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch initial tweets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
