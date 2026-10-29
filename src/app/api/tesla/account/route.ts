import { NextResponse } from 'next/server';
import { getTeslaTokens } from '../../../../lib/tesla-oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tokens = await getTeslaTokens();
  return NextResponse.json({
    connected: Boolean(tokens),
    expired: Boolean(tokens && tokens.expires_at <= Date.now()),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
