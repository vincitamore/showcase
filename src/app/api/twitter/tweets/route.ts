import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi } from 'twitter-api-v2'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Twitter API credentials not configured' },
        { status: 500 }
      )
    }

    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    })

    const user = await client.v2.userByUsername('NCUamoyer')
    
    if (!user.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const timeline = await client.v2.userTimeline(user.data.id, {
      exclude: ['replies', 'retweets'],
      expansions: ['author_id', 'attachments.media_keys'],
      'tweet.fields': ['created_at', 'text', 'public_metrics'],
      'user.fields': ['profile_image_url', 'username'],
      max_results: 10,
    })

    const tweets = timeline.data.data || []
    return NextResponse.json(tweets)
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