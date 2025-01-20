import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchTechTweets, postTweet } from '@/lib/x-api'
import { TwitterApi } from 'twitter-api-v2'

export async function GET() {
  try {
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
      return NextResponse.json(
        { error: 'Twitter API credentials not configured' },
        { status: 500 }
      )
    }

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    })

    const user = await client.v2.userByUsername('NCUamoyer')
    
    if (!user.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const tweets = await client.v2.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      expansions: ['author_id', 'attachments.media_keys'],
      'tweet.fields': ['created_at', 'text', 'public_metrics'],
      'user.fields': ['profile_image_url', 'username'],
      max_results: 10,
    })

    return NextResponse.json(tweets.data)
  } catch (error) {
    console.error('Error fetching tweets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tweets' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const accessToken = cookies().get('x_access_token')?.value;
    
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

    const tweet = await postTweet(text, accessToken)
    return NextResponse.json(tweet)
  } catch (error) {
    console.error('Error posting tweet:', error)
    return NextResponse.json(
      { error: 'Failed to post tweet' },
      { status: 500 }
    )
  }
} 