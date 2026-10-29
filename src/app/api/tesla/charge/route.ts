import { NextRequest, NextResponse } from 'next/server';
import { getTeslaTokens } from '../../../../lib/tesla-oauth';
import { teslaRequest } from '../../../../lib/tesla';
import { chargeSnapshot } from '../../../../lib/tesla-charging';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  const tokens = await getTeslaTokens();
  if (!tokens || tokens.expires_at <= Date.now()) return NextResponse.json({ message: 'Vuelve a conectar tu cuenta Tesla.' }, { status: 401, headers });
  const id = request.nextUrl.searchParams.get('vehicleId');
  if (!id || !/^\d{1,30}$/.test(id)) return NextResponse.json({ message: 'Selecciona un vehículo válido.' }, { status: 400, headers });
  try {
    const vehicles = await teslaRequest('/api/1/vehicles', tokens.access_token);
    const vehicle = vehicles.response?.find((v: { id_s?: string; id?: number }) => String(v.id_s ?? v.id) === id);
    if (!vehicle?.vin) return NextResponse.json({ message: 'Vehículo no autorizado.' }, { status: 403, headers });
    // Read Tesla's last reported state without polling or waking the vehicle.
    const data = await teslaRequest(`/api/1/vehicles/${vehicle.vin}/vehicle_data_cached`, tokens.access_token);
    const charge = chargeSnapshot(data);
    return NextResponse.json({ available: Boolean(charge), charge, message: charge ? undefined : 'Tesla todavía no tiene una lectura de carga disponible.' }, { headers });
  } catch (error) {
    const status = error instanceof Error ? /HTTP (\d{3})/.exec(error.message)?.[1] : undefined;
    const message = status === '404' || status === '412' ? 'Tesla no tiene una lectura guardada para este vehículo. El coche no se ha despertado.'
      : status === '401' ? 'Vuelve a conectar tu cuenta Tesla.'
      : status === '429' ? 'Tesla limitó las consultas. Espera unos minutos antes de actualizar.'
      : 'No se pudo consultar la última lectura de carga. Intenta actualizar más tarde.';
    return NextResponse.json({ available: false, message }, { status: status === '404' || status === '412' ? 200 : status === '401' ? 401 : 502, headers });
  }
}
