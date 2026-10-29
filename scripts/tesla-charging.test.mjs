import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/tesla-charging.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { chargingHistory, chargeSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('missing measurements stay null and zero remains a valid measurement', () => {
  const data = chargeSnapshot({ response: { charge_state: { charge_energy_added: 0, charger_power: null, battery_range: 100, timestamp: 1793303000000 } } });
  assert.equal(data.energyAddedKwh, 0);
  assert.equal(data.powerKw, null);
  assert.equal(data.batteryLevel, null);
  assert.equal(data.batteryRangeKm, 160.9344);
  assert.equal(data.timestamp, '2026-10-29T19:43:20.000Z');
  assert.equal(chargeSnapshot({ response: {} }), null);
});
test('history projects only display fields and does not infer kWh from unlabelled energy', () => {
  const result = chargingHistory({ data: [{ vin:'PRIVATE-VIN', invoice:'PRIVATE-INVOICE', chargeStartDateTime:'2026-10-29T12:00:00Z', siteLocationName:'Estación', energyUsed:35000, fees:[{ unit:'kWh', usageBase:'35' }], totalDue:0, currency:'MXN' }] });
  assert.equal(result.events[0].energyKwh, 35);
  assert.equal(result.events[0].amount, 0);
  assert.equal(result.events[0].startedAt, '2026-10-29T12:00:00.000Z');
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(chargingHistory({ data:[{energyUsed:35000}] }).events[0].energyKwh, null);
});
test('empty history is distinct from an unsupported response and invalid dates', () => {
  assert.deepEqual(chargingHistory({ response: { data:[] } }), { events:[], hasMore:false });
  assert.throws(() => chargingHistory({unexpected:[]}), /Unsupported/);
  assert.equal(chargingHistory({data:[{startTime:'bad-date',totalDue:'not-a-number'}]}).events[0].startedAt, null);
  assert.equal(chargingHistory({data:[{totalDue:false}]}).events[0].amount, null);
});
test('page is bounded and never invents a complete-history total', () => {
  const result = chargingHistory({data:Array.from({length:21},()=>({}))});
  assert.equal(result.events.length,20);
  assert.equal(result.hasMore,true);
  assert.equal('totalEnergy' in result,false);
});
