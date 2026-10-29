import { NextRequest, NextResponse } from 'next/server';
import { getTeslaTokens } from '../../../../lib/tesla-oauth';
import { teslaRequest } from '../../../../lib/tesla';
import { chargingHistory } from '../../../../lib/tesla-charging';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  const tokens = await getTeslaTokens();
  if (!tokens || tokens.expires_at <= Date.now()) return NextResponse.json({ message: 'Vuelve a conectar tu cuenta Tesla.' }, { status: 401, headers });
  const id = request.nextUrl.searchParams.get('vehicleId');
  const page = request.nextUrl.searchParams.get('page') || '1';
  if (!id || !/^\d{1,30}$/.test(id) || !/^[1-9]\d{0,3}$/.test(page)) return NextResponse.json({ message: 'Selecciona un vehículo y una página válidos.' }, { status: 400, headers });
  try {
    const result = await teslaRequest('/api/1/vehicles', tokens.access_token);
    const vehicle = result.response?.find((v: { id_s?: string; id?: number }) => String(v.id_s ?? v.id) === id);
    if (!vehicle?.vin) return NextResponse.json({ message: 'Vehículo no autorizado.' }, { status: 403, headers });
    const params = new URLSearchParams({ vin: vehicle.vin, pageNo: page, pageSize: '20', sortBy: 'startTime', sortOrder: 'DESC' });
    const data = await teslaRequest(`/api/1/dx/charging/history?${params}`, tokens.access_token);
    return NextResponse.json({ ...chargingHistory(data), page: Number(page) }, { headers });
  } catch (error) {
    const status = error instanceof Error ? /HTTP (\d{3})/.exec(error.message)?.[1] : undefined;
    const requiresConsent = status === '403';
    const message = requiresConsent ? 'Tesla requiere permiso de historial de carga. Autoriza el acceso para consultar tus sesiones.'
      : status === '401' ? 'La sesión Tesla caducó. Vuelve a conectar tu cuenta.'
      : status === '429' ? 'Tesla limitó las consultas. Espera unos minutos antes de actualizar.'
      : error instanceof Error && error.message === 'Unsupported Tesla charging history format' ? 'Tesla devolvió un formato de historial que todavía no podemos mostrar. No se han generado registros estimados.'
      : 'No se pudo recuperar el historial de Tesla. Intenta actualizar más tarde.';
    return NextResponse.json({ message, requiresConsent }, { status: status === '401' ? 401 : requiresConsent ? 403 : 502, headers });
  }
}
