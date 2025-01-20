import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    
    // Get stored state and code verifier from cookies
    const storedState = cookies().get('x_oauth_state')?.value;
    const codeVerifier = cookies().get('x_oauth_code_verifier')?.value;
    
    if (!state || !code || !storedState || !codeVerifier) {
      console.error('Missing OAuth parameters:', { state, code, storedState, codeVerifier });
      return NextResponse.redirect('/error?message=Invalid+authentication+state');
    }
    
    if (state !== storedState) {
      console.error('State mismatch:', { state, storedState });
      return NextResponse.redirect('/error?message=Invalid+authentication+state');
    }
    
    // Clear OAuth cookies
    cookies().delete('x_oauth_state');
    cookies().delete('x_oauth_code_verifier');
    
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_API_SECRET!,
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (
      process.env.NODE_ENV === 'production' 
        ? 'https://' + process.env.VERCEL_URL 
        : 'http://localhost:3000'
    );
    
    // Exchange code for access token
    const { accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: `${baseUrl}/api/twitter/auth/callback`,
    });
    
    // Store access token in cookie
    cookies().set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    if (refreshToken) {
      cookies().set('x_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }
    
    // Redirect back to blog section
    return NextResponse.redirect(`${baseUrl}/blog`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect('/error?message=Authentication+failed');
  }
} 