'use client';
import { useEffect, useRef, useState } from 'react';
import { BatteryCharging, History, Gauge, RefreshCw } from 'lucide-react';
import type { ChargingEvent } from '../lib/tesla-charging';

type Vehicle = { id: string; displayName: string; vinLast4?: string };
type Snapshot = { batteryLevel: number | null; chargingState: string | null; chargeLimit: number | null; energyAddedKwh: number | null; powerKw: number | null; batteryRangeKm: number | null; timestamp: string | null };
type HistoryResult = { events?: ChargingEvent[]; hasMore?: boolean; requiresConsent?: boolean; message?: string; diagnosticCode?: string };
const panel = { background: '#101813', border: '1px solid #24402b', borderRadius: 14, padding: 20, minWidth: 0 };
const muted = { color: '#a3b7a6', fontSize: 13 };
const button = { padding: '10px 14px', borderRadius: 8, border: '1px solid #475569', background: '#080d09', color: '#e7ffe9', cursor: 'pointer' };
const num = (value: number | null, unit: string) => value === null ? 'Sin dato' : `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Fecha no disponible';
const states: Record<string, string> = { Charging: 'Cargando', Complete: 'Carga completada', Stopped: 'Carga detenida', Disconnected: 'Desconectado', NoPower: 'Sin alimentación', Starting: 'Iniciando carga' };
function price(event: ChargingEvent) {
  if (event.amount === null || !event.currency || !/^[A-Z]{3}$/.test(event.currency)) return 'Importe no disponible';
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: event.currency }).format(event.amount); } catch { return 'Moneda no disponible'; }
}
export default function TeslaInsights({ vehicles }: { vehicles: Vehicle[] }) {
  const [preferredVehicle, setPreferredVehicle] = useState('');
  // Vehicles arrive after the session request. Resolve the default from current props,
  // so the visible option and the identifier sent to both APIs always agree.
  const selected = vehicles.some(vehicle => vehicle.id === preferredVehicle)
    ? preferredVehicle : vehicles[0]?.id || '';
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [chargeMessage, setChargeMessage] = useState('');
  const [chargeLoading, setChargeLoading] = useState(false);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [homeEvents, setHomeEvents] = useState<Array<{id:string;started_at:string;ended_at:string|null;energy_kwh:number|null}>>([]);
  const [homeMessage, setHomeMessage] = useState('');
  const [homeLoading, setHomeLoading] = useState(false);
  async function loadHome() {
    if (!selected) return;
    setHomeLoading(true);
    try {
      const res = await fetch(`/api/tesla/home?vehicleId=${encodeURIComponent(selected)}`, {cache:'no-store'});
      const data = await res.json();
      if (res.ok) { setHomeEvents(data.events || []); setHomeMessage(''); }
      else setHomeMessage(data.message || 'No se pudo consultar Neon.');
    } catch { setHomeMessage('No se pudo consultar Neon.'); }
    finally { setHomeLoading(false); }
  }
  async function recordHome() {
    if (!selected) return;
    setHomeLoading(true);
    try {
      const res = await fetch(`/api/tesla/home?vehicleId=${encodeURIComponent(selected)}`, {method:'POST'});
      const data = await res.json();
      setHomeMessage(res.ok ? 'Lectura doméstica guardada. Aún no es una sesión completa.' : data.message || 'No se pudo guardar.');
      if (res.ok) await loadHome();
    } catch { setHomeMessage('No se pudo guardar la lectura.'); }
    finally { setHomeLoading(false); }
  }
  const selection = useRef(selected);
  useEffect(() => {
    selection.current = selected;
    setSnapshot(null); setChargeMessage(''); setHistory(null); setPage(1);
  }, [selected]);
  async function loadCharge() {
    const id = selected;
    if (!id) return;
    setChargeLoading(true); setChargeMessage('');
    try {
      const response = await fetch(`/api/tesla/charge?vehicleId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (selection.current !== id) return;
      setSnapshot(response.ok ? data.charge ?? null : null);
      setChargeMessage(data.message || (response.ok ? '' : 'No se pudo consultar la lectura de carga.'));
    } catch { if (selection.current === id) { setSnapshot(null); setChargeMessage('No se pudo contactar con Tesla. Intenta de nuevo.'); } }
    finally { setChargeLoading(false); }
  }
  async function loadHistory(nextPage: number) {
    const id = selected;
    if (!id) return;
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/tesla/history?vehicleId=${encodeURIComponent(id)}&page=${nextPage}`, { cache: 'no-store' });
      const data = await response.json();
      if (selection.current !== id) return;
      setHistory(data); if (response.ok) setPage(nextPage);
    } catch { if (selection.current === id) setHistory({ message: 'No se pudo contactar con Tesla. Intenta de nuevo.' }); }
    finally { setHistoryLoading(false); }
  }
  if (!vehicles.length) return null;
  return <div style={{ display: 'grid', gap: 16, marginBottom: 22 }}>
    <div>
      <label htmlFor="tesla-vehicle">Vehículo para las consultas</label>{' '}
      <select id="tesla-vehicle" value={selected} disabled={chargeLoading || historyLoading} onChange={e => setPreferredVehicle(e.target.value)} style={{ ...button, maxWidth: '100%' }}>
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.displayName} · {v.vinLast4 || '—'}</option>)}
      </select>
    </div>
    <section style={panel} aria-labelledby="tesla-charge-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="tesla-charge-heading" style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0 }}><BatteryCharging color="#4ade80" aria-hidden /> Última lectura de carga</h2>
        <button type="button" style={button} disabled={chargeLoading || !selected} onClick={loadCharge}><RefreshCw size={14} aria-hidden /> {chargeLoading ? 'Consultando…' : 'Consultar carga'}</button>
      </div>
      <p style={muted}>Consulta la última lectura enviada a Tesla. Puede tener varias horas de antigüedad.</p>
      {chargeMessage && <p role="status">{chargeMessage}</p>}
      {snapshot ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {[['Batería', num(snapshot.batteryLevel, '%')], ['Energía añadida en la sesión reportada', num(snapshot.energyAddedKwh, 'kWh')], ['Potencia de carga', num(snapshot.powerKw, 'kW')], ['Autonomía estimada por Tesla', num(snapshot.batteryRangeKm, 'km')]].map(([label, value]) => <div key={label}><p style={muted}>{label}</p><strong style={{ fontSize: 23 }}>{value}</strong></div>)}
        </div>
        <p>{snapshot.chargingState ? states[snapshot.chargingState] || 'Estado de carga no reconocido' : 'Estado no disponible'} · Límite: {num(snapshot.chargeLimit, '%')}</p>
        <p style={muted}>Lectura del vehículo: {date(snapshot.timestamp)}. La energía añadida a la batería no incluye necesariamente todas las pérdidas de carga ni equivale al consumo facturado por CFE.</p>
      </> : !chargeMessage && <p>Pulsa «Consultar carga» para ver batería, energía añadida y potencia.</p>}
    </section>
    <section style={panel} aria-labelledby="tesla-home-heading">
      <h2 id="tesla-home-heading"><BatteryCharging color="#4ade80" aria-hidden /> Cargas en casa · Neon</h2>
      <p style={muted}>Confirma que el vehículo está cargando en casa antes de registrar una lectura. Una lectura no equivale a una sesión terminada; las sesiones automáticas aún requieren monitoreo continuo.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button type="button" style={button} disabled={homeLoading} onClick={recordHome}>Registrar lectura en casa</button>
        <button type="button" style={button} disabled={homeLoading} onClick={loadHome}>Consultar registros Neon</button>
      </div>
      {homeMessage && <p role="status">{homeMessage}</p>}
      <p style={muted}>Sesiones domésticas completas registradas: {homeEvents.length}. Las lecturas aisladas todavía no se contabilizan como sesiones.</p>
    </section>
    <section style={panel} aria-labelledby="tesla-history-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="tesla-history-heading" style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0 }}><History color="#4ade80" aria-hidden /> Últimas cargas de Tesla</h2>
        <button type="button" style={button} disabled={historyLoading || !selected} onClick={() => loadHistory(1)}>{historyLoading ? 'Consultando…' : 'Consultar historial'}</button>
      </div>
      <p style={muted}>Muestra las sesiones que Tesla devuelve para tu cuenta. No representa un historial completo de cargas en casa ni el consumo al conducir.</p>
      {history?.message && <p role="status">{history.message}{history.diagnosticCode ? ` (Código: ${history.diagnosticCode})` : ''}</p>}
      {(!history || history.requiresConsent) && <div>
        <a href="/api/tesla/connect?history=1" style={{ ...button, display: 'inline-block', textDecoration: 'none', background: '#15803d' }}>Autorizar historial en Tesla</a>
        <p style={muted}>Tesla agrupa el historial y los controles de carga en un mismo permiso. Este dashboard solo realiza consultas. Si Tesla rechaza el permiso, debe estar habilitado para tu aplicación en Tesla Developer.</p>
      </div>}
      {history?.events && (history.events.length ? <>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: 560 }}>
          <caption style={{ textAlign: 'left', padding: '10px 0', color: '#a3b7a6' }}>Sesiones devueltas por Tesla · página {page}</caption>
          <thead><tr>{['Fecha de inicio', 'Estación', 'Energía', 'Importe'].map(label => <th key={label} scope="col" style={{ padding: '12px 8px', borderBottom: '1px solid #475569' }}>{label}</th>)}</tr></thead>
          <tbody>{history.events.map(event => <tr key={event.id}><td style={{ padding: '14px 8px', borderBottom: '1px solid #24402b' }}>{date(event.startedAt)}</td><td>{event.site || 'Sin estación reportada'}</td><td>{num(event.energyKwh, 'kWh')}</td><td>{price(event)}</td></tr>)}</tbody>
        </table></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" style={button} disabled={historyLoading || page <= 1} onClick={() => loadHistory(page - 1)}>Más recientes</button>
          <button type="button" style={button} disabled={historyLoading || !history.hasMore} onClick={() => loadHistory(page + 1)}>Más antiguas</button>
        </div>
      </> : <p role="status">Tesla no devolvió sesiones en esta página. Esto no significa que no hayas cargado el coche en casa.</p>)}
    </section>
    <section style={panel} aria-labelledby="tesla-driving-heading">
      <h2 id="tesla-driving-heading" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 0 }}><Gauge color="#4ade80" aria-hidden /> Consumo al conducir</h2>
      <p>Sin historial de trayectos conectado.</p>
      <p style={muted}>Para mostrar Wh/km y kWh por trayecto necesitamos registrar energía y distancia durante la conducción o importar datos de un servicio que ya los haya guardado. La conexión de la cuenta por sí sola no recupera esos trayectos anteriores.</p>
    </section>
  </div>;
}
