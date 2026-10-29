export type ChargingEvent = {
  id: string; startedAt: string | null; endedAt: string | null;
  site: string | null; energyKwh: number | null; amount: number | null; currency: string | null;
};
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}
function text(...values: unknown[]) {
  return values.find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? null;
}
function number(...values: unknown[]) {
  for (const v of values) {
    if (v === null || v === undefined || typeof v === 'boolean' || v === '') continue;
    if (typeof v !== 'number' && typeof v !== 'string') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}
function date(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (value === '') return null;
  const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
// Project only display fields; never forward account identifiers, VINs, invoices or raw responses.
export function chargingHistory(value: unknown) {
  const root = record(value);
  const body = record(root.response ?? value);
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(root.response) ? root.response : Array.isArray(value) ? value : null;
  if (!rows) throw new Error('Unsupported Tesla charging history format');
  const events: ChargingEvent[] = rows.slice(0, 20).map((item, index) => {
    const row = record(item);
    const fees = Array.isArray(row.fees) ? row.fees.map(record) : [];
    const energyFee = fees.find(fee => typeof fee.unit === 'string' && fee.unit.toLowerCase() === 'kwh');
    return {
      id: String(index),
      startedAt: date(row.chargeStartDateTime ?? row.chargingStartTime ?? row.startTime ?? row.start_time),
      endedAt: date(row.chargeStopDateTime ?? row.chargingEndTime ?? row.endTime ?? row.end_time),
      site: text(row.siteLocationName, row.siteName, row.location),
      energyKwh: number(row.energyKwh, energyFee?.usageBase),
      amount: number(row.totalDue, row.totalAmount, row.total_cost),
      currency: text(row.currencyCode, row.currency),
    };
  });
  return { events, hasMore: rows.length >= 20 };
}
export function chargeSnapshot(value: unknown) {
  const state = record(record(record(value).response).charge_state);
  if (!Object.keys(state).length) return null;
  return {
    batteryLevel: number(state.battery_level),
    chargingState: text(state.charging_state),
    chargeLimit: number(state.charge_limit_soc),
    energyAddedKwh: number(state.charge_energy_added),
    powerKw: number(state.charger_power),
    batteryRangeKm: number(state.battery_range) === null ? null : number(state.battery_range)! * 1.609344,
    timestamp: date(state.timestamp),
  };
}
