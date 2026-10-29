import { NextRequest, NextResponse } from 'next/server';
import { getTeslaTokens } from '../../../../lib/tesla-oauth';
import { teslaRequest } from '../../../../lib/tesla';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const tokens = await getTeslaTokens();
  if (!tokens || tokens.expires_at <= Date.now()) return NextResponse.json({ connected: false, message: 'Conecta tu cuenta Tesla.' }, { status: 401 });
  const vin = request.nextUrl.searchParams.get('vin');
  if (!vin || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return NextResponse.json({ error: 'VIN inválido.' }, { status: 400 });
  try {
    const vehicles = await teslaRequest('/api/1/vehicles', tokens.access_token);
    if (!vehicles.response?.some((v: { vin?: string }) => v.vin === vin))
      return NextResponse.json({ error: 'Vehículo no autorizado.' }, { status: 403 });
    const data = await teslaRequest(`/api/1/vehicles/${vin}/vehicle_data?endpoints=charge_state`, tokens.access_token);
    const charge = data.response?.charge_state;
    if (!charge) return NextResponse.json({ connected: true, available: false });
    return NextResponse.json({ connected: true, available: true, batteryLevel: charge.battery_level, chargingState: charge.charging_state, chargeLimit: charge.charge_limit_soc, batteryRange: charge.battery_range }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'No se pudo consultar la carga.' }, { status: 502 }); }
}
