import { NextResponse } from 'next/server';
import { getTeslaTokens } from '../../../../lib/tesla-oauth';
import { teslaRequest } from '../../../../lib/tesla';
export const dynamic = 'force-dynamic';
export async function GET() {
  const tokens = await getTeslaTokens();
  if (!tokens) return NextResponse.json({ connected: false, message: 'Conecta tu cuenta Tesla.' }, { status: 401 });
  if (tokens.expires_at <= Date.now()) return NextResponse.json({ connected: false, message: 'La sesión ha caducado. Vuelve a conectar Tesla.' }, { status: 401 });
  try {
    const result = await teslaRequest('/api/1/vehicles', tokens.access_token);
    const vehicles = (result.response || []).map((v: { display_name?: string; state?: string; id_s?: string; vin?: string }) => ({
      displayName: v.display_name || 'Tesla', state: v.state, id: v.id_s, vinLast4: v.vin?.slice(-4)
    }));
    return NextResponse.json({ connected: true, vehicles }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ connected: false, message: 'Tesla no respondió.' }, { status: 502 }); }
}
