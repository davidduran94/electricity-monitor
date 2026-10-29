import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { callbackUrl, scopes, secureCookie } from '../../../../lib/tesla-oauth';

export async function GET() {
  const clientId = process.env.TESLA_CLIENT_ID;
  if (!clientId || !process.env.TESLA_CLIENT_SECRET || !process.env.TESLA_SESSION_SECRET)
    return NextResponse.json({ error: 'Tesla OAuth no está configurado.' }, { status: 503 });
  const state = randomBytes(24).toString('hex');
  const url = new URL('https://auth.tesla.com/oauth2/v3/authorize');
  for (const [key, value] of Object.entries({ response_type: 'code', client_id: clientId, redirect_uri: callbackUrl, scope: scopes, state }))
    url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.set('tesla_oauth_state', state, { ...secureCookie, maxAge: 600 });
  return response;
}
