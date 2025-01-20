import { NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/x-api';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';

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
      `${baseUrl}/api/twitter/auth-callback`,
      { scope: ['tweet.read', 'tweet.write', 'users.read'] }
    );
    
    const cookieStore = cookies();
    cookieStore.set('x_oauth_state', state, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });
    
    cookieStore.set('x_oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
} 