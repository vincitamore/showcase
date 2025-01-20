import { NextResponse } from 'next/server';
import { getReadOnlyClient, postTweet } from '@/lib/x-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username')?.replace('@', '');

    console.log('Twitter API Request:', { action, username });

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'fetch_tweets': {
        if (!username) {
          console.error('Missing username parameter');
          return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        console.log(`Fetching tweets for username: ${username}`);
        const client = await getReadOnlyClient();
        const user = await client.v2.userByUsername(username);
        
        if (!user.data) {
          console.error('User not found:', username);
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log(`Found user ID: ${user.data.id}, fetching timeline...`);
        const tweets = await client.v2.userTimeline(user.data.id, {
          exclude: ['replies', 'retweets'],
          expansions: ['author_id', 'attachments.media_keys'],
          'tweet.fields': ['created_at', 'text', 'public_metrics'],
          'user.fields': ['profile_image_url', 'username'],
          max_results: 10,
        });

        console.log('Tweets fetched successfully:', {
          count: tweets.data.meta?.result_count,
          userId: user.data.id
        });

        return NextResponse.json(tweets.data);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    // Log the full error details
    console.error('Twitter API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      raw: error // Log the raw error object
    });

    // Return a more detailed error response
    return NextResponse.json({
      error: 'Failed to process Twitter request',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.name : 'Unknown'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { text, accessToken } = await request.json();
    console.log('Processing tweet post:', { hasText: !!text, hasToken: !!accessToken });

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Tweet text is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tweet = await postTweet(text, accessToken);
    console.log('Tweet posted successfully:', tweet.id);

    return NextResponse.json(tweet);
  } catch (error) {
    console.error('Tweet post error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { 
        error: 'Failed to post tweet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 