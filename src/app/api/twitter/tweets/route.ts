import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi } from 'twitter-api-v2'
import { getCachedTweets } from '@/lib/blob-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Fetching cached tweets...')
    const cachedData = await getCachedTweets()
    
    console.log('Cached data:', {
      hasCachedData: !!cachedData,
      tweetCount: cachedData?.tweets?.length ?? 0
    })
    
    if (!cachedData?.tweets) {
      // Return empty array instead of 404
      return NextResponse.json([])
    }

    return NextResponse.json(cachedData.tweets)
  } catch (error) {
    console.error('Error fetching cached tweets:', error)
    // Return empty array on error instead of 500
    return NextResponse.json([])
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