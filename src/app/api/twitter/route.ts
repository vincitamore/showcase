import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

// Initialize Twitter client outside the handler to reuse connections
const getTwitterClient = () => {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
  });
  return client;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const client = getTwitterClient();

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        const user = await client.v2.userByUsername(username);
        if (!user.data) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        return NextResponse.json(tweets.data);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Twitter API error:', error);
    return NextResponse.json(
      { error: 'Failed to process Twitter request' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { text, accessToken } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Tweet text is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const client = new TwitterApi(accessToken);
    const tweet = await client.v2.tweet(text);

    return NextResponse.json(tweet.data);
  } catch (error) {
    console.error('Twitter API error:', error);
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    );
  }
} 