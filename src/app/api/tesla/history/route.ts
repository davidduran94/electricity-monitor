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
    // Diagnostic fallback: Tesla rejected requests containing pagination.
    // Request the minimal VIN-only query to isolate pagination validation.
    const params = new URLSearchParams({ vin: vehicle.vin });
    const endpoint = new URL(`/api/1/dx/charging/history?${params}`, process.env.TESLA_FLEET_API_BASE_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com');
    const upstream = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) {
      // Tesla may provide a structured error code; never return raw upstream text.
      let detail: unknown;
      try { detail = await upstream.json(); } catch { detail = null; }
      const body = detail && typeof detail === 'object' ? detail as Record<string, unknown> : {};
      const nested = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : {};
      const code = [body.error_code, body.code, nested.code].find(v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(v as string));
      console.error('Tesla history upstream failure', { status: upstream.status, providerCode: code || 'not_provided' });
      return NextResponse.json({
        message: upstream.status === 400 ? 'Tesla rechazó la consulta de historial. El diagnóstico ampliado está disponible.' : 'Tesla no pudo devolver el historial.',
        diagnosticCode: `TESLA_HISTORY_HTTP_${upstream.status}`,
        providerCode: code || null
      }, { status: upstream.status === 401 ? 401 : 502, headers });
    }
    const data = await upstream.json();
    return NextResponse.json({ ...chargingHistory(data), page: Number(page) }, { headers });
  } catch (error) {
    const status = error instanceof Error ? /HTTP (\d{3})/.exec(error.message)?.[1] : undefined;
    const requiresConsent = status === '403';
    const diagnosticCode = status ? `TESLA_HISTORY_HTTP_${status}` : error instanceof Error && error.name === 'TimeoutError' ? 'TESLA_HISTORY_TIMEOUT' : error instanceof Error && error.message === 'Unsupported Tesla charging history format' ? 'TESLA_HISTORY_FORMAT' : 'TESLA_HISTORY_UNKNOWN';
    const message = requiresConsent ? 'Tesla requiere permiso de historial de carga. Autoriza el acceso para consultar tus sesiones.'
      : status === '401' ? 'La sesión Tesla caducó. Vuelve a conectar tu cuenta.'
      : status === '429' ? 'Tesla limitó las consultas. Espera unos minutos antes de actualizar.'
      : error instanceof Error && error.message === 'Unsupported Tesla charging history format' ? 'Tesla devolvió un formato de historial que todavía no podemos mostrar. No se han generado registros estimados.'
      : status === '404' ? 'El endpoint de historial no está disponible para esta cuenta o región de Tesla.'
      : status === '400' ? 'Tesla rechazó los parámetros de la consulta de historial.'
      : status === '502' || status === '503' || status === '504' ? 'El servicio de historial de Tesla no está disponible temporalmente.'
      : 'No se pudo recuperar el historial de Tesla. Consulta el código de diagnóstico.';
    console.error('Tesla charging history request failed', { diagnosticCode });
    return NextResponse.json({ message, requiresConsent, diagnosticCode }, { status: status === '401' ? 401 : requiresConsent ? 403 : 502, headers });
  }
}
