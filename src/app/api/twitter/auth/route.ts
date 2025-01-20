import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookieStore = cookies();
  
  try {
    if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_API_SECRET) {
      throw new Error('Missing Twitter credentials');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? 'https://' + process.env.VERCEL_URL 
        : 'http://localhost:3000'
    );

    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_API_SECRET,
    });

    const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
      `${baseUrl}/api/twitter/callback`,
      { scope: ['tweet.read', 'tweet.write', 'users.read'] }
    );
    
    cookieStore.set('x_oauth_state', state, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });
    
    cookieStore.set('x_oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/'
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate authentication URL';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 