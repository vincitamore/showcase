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
    console.log('Fetching selected tweets...')
    const selectedData = await getSelectedTweets()
    
    if (!selectedData) {
      console.log('No selected tweets found')
      return NextResponse.json({ tweets: [] })
    }
    
    console.log('Returning selected tweets:', {
      count: selectedData.tweets.length,
      timestamp: new Date(selectedData.timestamp).toISOString()
    })
    
    return NextResponse.json({ tweets: selectedData.tweets })
  } catch (error) {
    console.error('Error fetching selected tweets:', error)
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