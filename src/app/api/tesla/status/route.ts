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
  } catch (error) {
    const status = error instanceof Error ? /HTTP (\d{3})/.exec(error.message)?.[1] : undefined;
    const message = status === '401' ? 'Tesla rechazó la sesión. Vuelve a conectar tu cuenta.'
      : status === '403' ? 'Tesla denegó el acceso a los vehículos (HTTP 403). Revisa los permisos de Fleet API y el registro de la aplicación.'
      : status === '429' ? 'Tesla limitó temporalmente las consultas (HTTP 429). Intenta más tarde.'
      : status ? `No se pudieron consultar los vehículos en Tesla (HTTP ${status}).`
      : 'No se pudo contactar con Tesla Fleet API.';
    return NextResponse.json({ connected: true, vehicles: [], message }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
