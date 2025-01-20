import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cookieStore = cookies();
  
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    
    const storedState = cookieStore.get('x_oauth_state')?.value;
    const codeVerifier = cookieStore.get('x_oauth_code_verifier')?.value;
    
    if (!state || !code || !storedState || !codeVerifier) {
      throw new Error('Missing OAuth parameters');
    }
    
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }
    
    // Clean up OAuth cookies
    cookieStore.delete('x_oauth_state', { path: '/' });
    cookieStore.delete('x_oauth_code_verifier', { path: '/' });
    
    if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_API_SECRET) {
      throw new Error('Missing Twitter credentials');
    }
    
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_API_SECRET,
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? 'https://' + process.env.VERCEL_URL 
        : 'http://localhost:3000'
    );
    
    const { accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: `${baseUrl}/api/twitter/auth-callback`,
    });
    
    // Set access token cookie
    cookieStore.set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    });
    
    // Set refresh token if available
    if (refreshToken) {
      cookieStore.set('x_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
      });
    }
    
    return NextResponse.redirect(new URL('/blog', request.url), {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Clean up any remaining OAuth cookies on error
    cookieStore.delete('x_oauth_state', { path: '/' });
    cookieStore.delete('x_oauth_code_verifier', { path: '/' });
    
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(new URL(`/error?message=${encodeURIComponent(errorMessage)}`, request.url), {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
} 