import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi } from 'twitter-api-v2'
import { getCachedTweets } from '@/lib/blob-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cachedData = await getCachedTweets()
    
    if (!cachedData || !cachedData.tweets || cachedData.tweets.length === 0) {
      return NextResponse.json({ error: 'No tweets available' }, { status: 404 })
    }

    return NextResponse.json(cachedData.tweets)
  } catch (error) {
    console.error('Error fetching cached tweets:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch cached tweets',
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