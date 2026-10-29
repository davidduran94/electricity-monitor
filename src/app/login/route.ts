import { NextRequest, NextResponse } from 'next/server';
import { audience, callbackUrl, encrypt, exchangeTeslaToken, secureCookie } from '../../lib/tesla-oauth';

export async function GET(request: NextRequest) {
  const base = new URL('/', request.url);
  const state = request.nextUrl.searchParams.get('state');
  const expected = request.cookies.get('tesla_oauth_state')?.value;
  const code = request.nextUrl.searchParams.get('code');
  if (!state || !expected || state !== expected || !code)
    return NextResponse.redirect(new URL('/?tesla=authorization_failed&reason=state', base));
  try {
    const tokens = await exchangeTeslaToken(new URLSearchParams({
      grant_type: 'authorization_code', client_id: process.env.TESLA_CLIENT_ID || '',
      client_secret: process.env.TESLA_CLIENT_SECRET || '', code,
      audience, redirect_uri: callbackUrl
    }));
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('Missing tokens');
    const response = NextResponse.redirect(new URL('/?tesla=connected', base));
    response.cookies.set('tesla_session', encrypt({
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000
    }), { ...secureCookie, maxAge: 60 * 60 * 24 * 80 });
    response.cookies.delete('tesla_oauth_state');
    return response;
  } catch (error) {
    const reason = error instanceof Error && error.message === 'Missing tokens' ? 'missing_tokens'
      : error instanceof Error && error.message.includes('TESLA_SESSION_SECRET') ? 'session_config'
      : error instanceof Error && error.message.includes('Tesla OAuth token exchange failed') ? 'token_exchange'
      : 'callback_error';
    console.error('Tesla OAuth callback failed', { reason });
    const response = NextResponse.redirect(new URL(`/?tesla=authorization_failed&reason=${reason}`, base));
    response.cookies.delete('tesla_oauth_state');
    return response;
  }
}
