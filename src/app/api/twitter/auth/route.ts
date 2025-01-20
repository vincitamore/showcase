import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { cookies } from 'next/headers';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? 'https://' + process.env.VERCEL_URL 
        : 'http://localhost:3000'
    );

    if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_API_SECRET) {
      throw new Error('Missing Twitter credentials');
    }

    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_API_SECRET,
    });

    // Generate OAuth 2.0 URL
    const { url, state, codeVerifier } = client.generateOAuth2AuthLink(
      `${baseUrl}/api/twitter/auth/callback`,
      { scope: ['tweet.read', 'tweet.write', 'users.read'] }
    );

    // Store the state and code verifier in cookies
    cookies().set('x_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    cookies().set('x_oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Twitter auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize authentication' },
      { status: 500 }
    );
  }
} 