import { NextRequest, NextResponse } from 'next/server';
import { audience, encrypt, exchangeTeslaToken, getTeslaTokens, secureCookie } from '../../../../lib/tesla-oauth';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Origen no autorizado.' }, { status: 403 });
  const previous = await getTeslaTokens();
  if (!previous?.refresh_token) return NextResponse.json({ connected: false }, { status: 401 });
  if (!process.env.TESLA_CLIENT_ID || !process.env.TESLA_CLIENT_SECRET)
    return NextResponse.json({ error: 'Tesla OAuth no configurado.' }, { status: 503 });
  try {
    const next = await exchangeTeslaToken(new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.TESLA_CLIENT_ID,
      client_secret: process.env.TESLA_CLIENT_SECRET,
      refresh_token: previous.refresh_token,
      audience
    }));
    const response = NextResponse.json({ connected: true });
    response.cookies.set('tesla_session', encrypt({
      access_token: next.access_token,
      refresh_token: next.refresh_token || previous.refresh_token,
      expires_at: Date.now() + next.expires_in * 1000
    }), { ...secureCookie, maxAge: 60 * 60 * 24 * 80 });
    return response;
  } catch {
    return NextResponse.json({ error: 'No se pudo renovar la sesión de Tesla.' }, { status: 502 });
  }
}
