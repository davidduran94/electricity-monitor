import { NextResponse } from 'next/server';
import { teslaRequest } from '../../../../lib/tesla';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TESLA_ACCESS_TOKEN;
  const vin = process.env.TESLA_VIN;
  if (!token || !vin) return NextResponse.json({ connected: false, message: 'Configura TESLA_ACCESS_TOKEN y TESLA_VIN en Vercel.' }, { status: 503 });
  try {
    const vehicles = await teslaRequest('/api/1/vehicles', token);
    const vehicle = vehicles?.response?.find((item: { vin?: string }) => item.vin === vin);
    if (!vehicle) return NextResponse.json({ connected: false, message: 'El VIN configurado no está autorizado para este token.' }, { status: 404 });
    return NextResponse.json({ connected: true, vehicle: { displayName: vehicle.display_name || 'Tesla Model 3', state: vehicle.state, id: vehicle.id_s, vinLast4: vin.slice(-4) } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ connected: false, message: 'No se pudo consultar Tesla. Verifica el token, la región y los permisos.' }, { status: 502 });
  }
}
