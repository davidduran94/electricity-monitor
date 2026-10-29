import { NextResponse } from 'next/server';
import { teslaRequest } from '../../../../lib/tesla';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TESLA_ACCESS_TOKEN;
  const vin = process.env.TESLA_VIN;
  if (!token || !vin) return NextResponse.json({ connected: false, message: 'Tesla no configurado.' }, { status: 503 });
  try {
    const result = await teslaRequest(`/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data?endpoints=charge_state`, token);
    const charge = result?.response?.charge_state;
    if (!charge) return NextResponse.json({ connected: true, available: false, message: 'Estado de carga no disponible; el vehículo podría estar dormido.' });
    return NextResponse.json({ connected: true, available: true, batteryLevel: charge.battery_level, chargingState: charge.charging_state, chargeLimit: charge.charge_limit_soc, batteryRange: charge.battery_range }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ connected: false, message: 'No se pudo leer la carga. Tesla puede requerir autorización o que el vehículo esté despierto.' }, { status: 502 });
  }
}
