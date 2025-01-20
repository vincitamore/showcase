import { NextResponse } from 'next/server';
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

    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    
    const storedState = cookies().get('x_oauth_state')?.value;
    const codeVerifier = cookies().get('x_oauth_code_verifier')?.value;

    if (!state || !code || !storedState || !codeVerifier) {
      return NextResponse.redirect(new URL('/auth-error', baseUrl));
    }

    if (state !== storedState) {
      return NextResponse.redirect(new URL('/auth-error?error=invalid_state', baseUrl));
    }

    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_API_SECRET!,
    });

    const { accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: `${baseUrl}/api/twitter/auth/callback`
    });

    // Clear the OAuth cookies
    cookies().delete('x_oauth_state');
    cookies().delete('x_oauth_code_verifier');

    // Set the access token in an httpOnly cookie
    cookies().set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    if (refreshToken) {
      cookies().set('x_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    // Redirect back to the blog section
    return NextResponse.redirect(new URL('/#blog', baseUrl));
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? 'https://' + process.env.VERCEL_URL 
        : 'http://localhost:3000'
    );
    return NextResponse.redirect(new URL('/auth-error', baseUrl));
  }
} 