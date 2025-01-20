import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    
    const cookieStore = cookies();
    const storedState = cookieStore.get('x_oauth_state')?.value;
    const codeVerifier = cookieStore.get('x_oauth_code_verifier')?.value;
    
    if (!state || !code || !storedState || !codeVerifier) {
      console.error('Missing OAuth parameters:', { state, code, storedState, codeVerifier });
      return NextResponse.redirect(new URL('/error?message=Invalid+authentication+state', request.url));
    }
    
    if (state !== storedState) {
      console.error('State mismatch:', { state, storedState });
      return NextResponse.redirect(new URL('/error?message=Invalid+authentication+state', request.url));
    }
    
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_oauth_code_verifier');
    
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_API_SECRET!,
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
    
    cookieStore.set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });
    
    if (refreshToken) {
      cookieStore.set('x_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
      });
    }
    
    const redirectUrl = new URL('/blog', request.url);
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorUrl = new URL('/error?message=Authentication+failed', request.url);
    return NextResponse.redirect(errorUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
} 