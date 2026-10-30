import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getTeslaTokens } from '../../../../../lib/tesla-oauth';
import { teslaRequest } from '../../../../../lib/tesla';
import { database, vehicleKey } from '../../../../../lib/home-charging-db';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json({ message: 'Origen no autorizado.' }, { status: 403, headers });
  const tokens = await getTeslaTokens();
  if (!tokens || tokens.expires_at <= Date.now())
    return NextResponse.json({ message: 'Vuelve a conectar Tesla.' }, { status: 401, headers });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object')
      return NextResponse.json({ message: 'Datos inválidos.' }, { status: 400, headers });
    const input = body as Record<string, unknown>;
    const id = input.vehicleId;
    const location = input.location;
    const energy = input.energyKwh;
    const date = input.date;
    if (typeof id !== 'string' || !/^\d{1,30}$/.test(id) ||
        location !== 'home' || typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof energy !== 'number' || !Number.isFinite(energy) || energy <= 0 || energy > 300)
      return NextResponse.json({ message: 'Revisa fecha, lugar y energía (kWh).' }, { status: 400, headers });
    const start = new Date(date + 'T12:00:00-06:00');
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date ||
        start.getTime() > Date.now())
      return NextResponse.json({ message: 'Selecciona una fecha válida, no futura.' }, { status: 400, headers });
    const vehicles = await teslaRequest('/api/1/vehicles', tokens.access_token);
    const vehicle = vehicles.response?.find((v: { id_s?: string; id?: number }) => String(v.id_s ?? v.id) === id);
    if (!vehicle?.vin) return NextResponse.json({ message: 'Vehículo no autorizado.' }, { status: 403, headers });
    const sql = database();
    const rows = await sql`INSERT INTO electricity_charging_sessions
      (id, vehicle_id, source, started_at, ended_at, energy_kwh, cost_amount, currency, cost_is_estimate)
      VALUES (${randomUUID()}, ${vehicleKey(vehicle.vin)}, 'home', ${start.toISOString()},
        ${start.toISOString()}, ${energy}, NULL, 'MXN', false)
      RETURNING id`;
    return NextResponse.json({ saved: rows.length === 1 }, { status: 201, headers });
  } catch {
    return NextResponse.json({ message: 'No se pudo guardar la carga manual en Neon.' }, { status: 502, headers });
  }
}
