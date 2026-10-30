import { NextRequest, NextResponse } from 'next/server';
import { getTeslaTokens } from '../../../../lib/tesla-oauth';
import { teslaRequest } from '../../../../lib/tesla';
import { chargeSnapshot } from '../../../../lib/tesla-charging';
import { database, vehicleKey } from '../../../../lib/home-charging-db';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
async function authorizedVehicle(request: NextRequest) {
  const tokens = await getTeslaTokens();
  if (!tokens || tokens.expires_at <= Date.now()) return null;
  const id = request.nextUrl.searchParams.get('vehicleId');
  if (!id || !/^\\d{1,30}$/.test(id)) return null;
  const vehicles = await teslaRequest('/api/1/vehicles', tokens.access_token);
  const vehicle = vehicles.response?.find((v: { id_s?: string; id?: number }) => String(v.id_s ?? v.id) === id);
  if (!vehicle?.vin) return null;
  return { token: tokens.access_token, vin: vehicle.vin as string };
}
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizedVehicle(request);
    if (!auth) return NextResponse.json({ message: 'Conecta tu Tesla para ver las cargas.' }, { status: 401, headers });
    const key = vehicleKey(auth.vin);
    const sql = database();
    const rows = await sql`SELECT id, started_at, ended_at, energy_kwh, cost_amount, currency, cost_is_estimate
      FROM electricity_charging_sessions WHERE vehicle_id = ${key} AND source = 'home'
      ORDER BY started_at DESC LIMIT 100`;
    return NextResponse.json({ events: rows }, { headers });
  } catch {
    return NextResponse.json({ message: 'No se pudo consultar Neon.' }, { status: 502, headers });
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json({ message: 'Origen no autorizado.' }, { status: 403, headers });
  try {
    const auth = await authorizedVehicle(request);
    if (!auth) return NextResponse.json({ message: 'Vuelve a conectar tu Tesla.' }, { status: 401, headers });
    // This is an explicitly user-confirmed HOME observation, not an inferred GPS location.
    const data = await teslaRequest(`/api/1/vehicles/${auth.vin}/vehicle_data_cached`, auth.token);
    const charge = chargeSnapshot(data);
    if (!charge?.timestamp || charge.energyAddedKwh === null || !charge.chargingState)
      return NextResponse.json({ message: 'Tesla no devolvió una lectura de carga completa.' }, { status: 422, headers });
    const observedAt = new Date(charge.timestamp);
    if (Number.isNaN(observedAt.getTime()) || Date.now() - observedAt.getTime() > 30 * 60 * 1000 || observedAt.getTime() > Date.now() + 60000)
      return NextResponse.json({ message: 'La lectura de Tesla es antigua. No se guardó.' }, { status: 422, headers });
    const key = vehicleKey(auth.vin);
    const sql = database();
    // Upsert on exact observation time avoids duplicate records from repeated clicks.
    const rows = await sql`INSERT INTO electricity_home_observations
      (vehicle_id, observed_at, charging_state, energy_added_kwh)
      VALUES (${key}, ${observedAt.toISOString()}, ${charge.chargingState}, ${charge.energyAddedKwh})
      ON CONFLICT (vehicle_id, observed_at) DO UPDATE SET charging_state = EXCLUDED.charging_state,
      energy_added_kwh = EXCLUDED.energy_added_kwh RETURNING observed_at`;
    return NextResponse.json({ recorded: rows.length === 1, observedAt: observedAt.toISOString() }, { headers });
  } catch {
    return NextResponse.json({ message: 'No se pudo guardar la lectura en Neon.' }, { status: 502, headers });
  }
}
