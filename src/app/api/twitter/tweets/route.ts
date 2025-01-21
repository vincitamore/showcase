import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { TwitterApi } from 'twitter-api-v2'
import { getCachedTweets, getSelectedTweets } from '@/lib/blob-storage'

export const dynamic = 'force-dynamic'

// Helper function to get random items from array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export async function GET() {
  try {
    console.log('Fetching cached tweets...')
    const cachedData = await getCachedTweets()
    
    if (!cachedData?.tweets) {
      console.log('No cached tweets found')
      return NextResponse.json({ tweets: [] })
    }
    
    // Get up to 4 random tweets from cache
    const randomTweets = [...cachedData.tweets]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
    
    console.log('Returning cached tweets:', {
      available: cachedData.tweets.length,
      returning: randomTweets.length
    })
    
    return NextResponse.json({ tweets: randomTweets })
  } catch (error) {
    console.error('Error fetching cached tweets:', error)
    return NextResponse.json({ tweets: [] })
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