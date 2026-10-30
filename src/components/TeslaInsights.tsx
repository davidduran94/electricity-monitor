'use client';
import { useEffect, useRef, useState } from 'react';
import { BatteryCharging, History, Gauge, RefreshCw } from 'lucide-react';
import type { ChargingEvent } from '../lib/tesla-charging';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Vehicle = { id: string; displayName: string; vinLast4?: string };
type Snapshot = { batteryLevel: number | null; chargingState: string | null; chargeLimit: number | null; energyAddedKwh: number | null; powerKw: number | null; batteryRangeKm: number | null; timestamp: string | null };
type HistoryResult = { events?: ChargingEvent[]; hasMore?: boolean; requiresConsent?: boolean; message?: string; diagnosticCode?: string; providerCode?: string | null };
const panel = { background: '#101813', border: '1px solid #7f1d1d', borderRadius: 14, padding: 20, minWidth: 0 };
const muted = { color: '#a3b7a6', fontSize: 13 };
const button = { padding: '10px 14px', borderRadius: 8, border: '1px solid #475569', background: '#080d09', color: '#e7ffe9', cursor: 'pointer' };
const num = (value: number | null, unit: string) => value === null ? 'Sin dato' : `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Fecha no disponible';
const states: Record<string, string> = { Charging: 'Cargando', Complete: 'Carga completada', Stopped: 'Carga detenida', Disconnected: 'Desconectado', NoPower: 'Sin alimentación', Starting: 'Iniciando carga' };
function price(event: ChargingEvent) {
  if (event.amount === null || !event.currency || !/^[A-Z]{3}$/.test(event.currency)) return 'Importe no disponible';
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: event.currency }).format(event.amount); } catch { return 'Moneda no disponible'; }
}
export default function TeslaInsights({ vehicles, cfePeriods }: { vehicles: Vehicle[]; cfePeriods: Array<{id:string;from:string;to:string;kwh:number;mxn:number}> }) {
  const [preferredVehicle, setPreferredVehicle] = useState('');
  const [showDriving, setShowDriving] = useState(false);
  // Vehicles arrive after the session request. Resolve the default from current props,
  // so the visible option and the identifier sent to both APIs always agree.
  const selected = vehicles.some(vehicle => vehicle.id === preferredVehicle)
    ? preferredVehicle : vehicles[0]?.id || '';
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [chargeMessage, setChargeMessage] = useState('');
  const [chargeLoading, setChargeLoading] = useState(false);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [snapshotSaveMessage, setSnapshotSaveMessage] = useState('');
  async function saveLatestSnapshot() {
    if (!selected || !snapshot) return;
    const vehicleId = selected;
    setSnapshotSaving(true);
    setSnapshotSaveMessage('');
    try {
      const response = await fetch(`/api/tesla/home?vehicleId=${encodeURIComponent(vehicleId)}`, {method:'POST'});
      const data = await response.json();
      if (selection.current !== vehicleId) return;
      setSnapshotSaveMessage(response.ok ? 'Lectura guardada en Neon. Es una observación, no una sesión de carga completa.' : data.message || 'No se pudo guardar la lectura.');
    } catch { if (selection.current === vehicleId) setSnapshotSaveMessage('No se pudo guardar la lectura en Neon.'); }
    finally { setSnapshotSaving(false); }
  }
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [homeEvents, setHomeEvents] = useState<Array<{id:string;started_at:string;ended_at:string|null;energy_kwh:number|null}>>([]);
  const [homeFetched, setHomeFetched] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  async function deleteHomeRecord(recordId: string) {
    if (!selected) return;
    setHomeLoading(true);
    try {
      const res = await fetch('/api/tesla/home/manual', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicleId: selected, recordId }) });
      const data = await res.json();
      if (!res.ok) { setHomeMessage(data.message || 'No se pudo eliminar el registro.'); return; }
      setHomeEvents(current => current.filter(item => item.id !== recordId));
      setDeleteCandidate(null);
      setHomeMessage('Registro eliminado correctamente.');
    } catch { setHomeMessage('No se pudo eliminar el registro.'); }
    finally { setHomeLoading(false); }
  }
  const [homeMessage, setHomeMessage] = useState('');
  const cfeTotals = [...cfePeriods].sort((a,b) => b.from.localeCompare(a.from)).map(period => {
    const records = homeEvents.filter(event => {
      // CFE receipt dates are inclusive; use the Mexico-local calendar date.
      const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(event.started_at));
      const get = (type: string) => parts.find(part => part.type === type)?.value || '';
      const localDate = `${get('year')}-${get('month')}-${get('day')}`;
      return localDate >= period.from && localDate <= period.to;
    });
    return { ...period, count: records.length, neonKwh: records.reduce((sum, event) => sum + Number(event.energy_kwh || 0), 0) };
  });
  const [homeLoading, setHomeLoading] = useState(false);
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [manualEnergy, setManualEnergy] = useState('');
  async function saveManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const energyKwh = Number(manualEnergy);
    if (!selected || !manualDate || !Number.isFinite(energyKwh) || energyKwh <= 0) { setHomeMessage('Ingresa una fecha y kWh válidos.'); return; }
    setHomeLoading(true);
    try {
      const res = await fetch('/api/tesla/home/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicleId: selected, date: manualDate, location: 'home', energyKwh }) });
      const data = await res.json();
      if (!res.ok) { setHomeMessage(data.message || 'No se pudo guardar.'); return; }
      setManualEnergy('');
      await loadHome();
      setHomeMessage('Carga manual guardada correctamente.');
    } catch { setHomeMessage('No se pudo guardar la carga manual.'); }
    finally { setHomeLoading(false); }
  }
  async function loadHome() {
    const id = selected;
    if (!id) return;
    setHomeLoading(true);
    try {
      const res = await fetch(`/api/tesla/home?vehicleId=${encodeURIComponent(id)}`, {cache:'no-store'});
      const data = await res.json();
      if (selection.current !== id) return;
      if (res.ok) { setHomeEvents(data.events || []); setHomeFetched(true); setHomeMessage(''); }
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
    setSnapshot(null); setChargeMessage(''); setSnapshotSaveMessage(''); setHistory(null); setPage(1);
    setHomeEvents([]); setHomeFetched(false); setHomeMessage(''); setDeleteCandidate(null);
    if (selected) void loadHome();
  }, [selected]);
  async function loadCharge() {
    const id = selected;
    if (!id) return;
    setChargeLoading(true); setChargeMessage(''); setSnapshotSaveMessage('');
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
  return <div style={{ display: 'contents' }}>
    <section style={{...panel, width:'100%', boxSizing:'border-box'}} aria-labelledby="tesla-charge-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="tesla-charge-heading" style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0 }}><BatteryCharging color="#f87171" aria-hidden /> Última lectura de carga</h2>
        <button type="button" style={button} disabled={chargeLoading || !selected} onClick={loadCharge}><RefreshCw size={14} aria-hidden /> {chargeLoading ? 'Consultando…' : 'Consultar carga'}</button>
      </div>
    <div style={{marginBottom:14}}>
      <label htmlFor="tesla-vehicle">Vehículo para las consultas</label>{' '}
      <select id="tesla-vehicle" value={selected} disabled={chargeLoading || historyLoading} onChange={e => setPreferredVehicle(e.target.value)} style={{ ...button, maxWidth: '100%' }}>
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.displayName} · {v.vinLast4 || '—'}</option>)}
      </select>
    </div>
      <p style={muted}>Consulta la última lectura enviada a Tesla. Puede tener varias horas de antigüedad.</p>
      {chargeMessage && <p role="status">{chargeMessage}</p>}
      {snapshot ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {[['Batería', num(snapshot.batteryLevel, '%')], ['Energía añadida en la sesión reportada', num(snapshot.energyAddedKwh, 'kWh')], ['Potencia de carga', num(snapshot.powerKw, 'kW')], ['Autonomía estimada por Tesla', num(snapshot.batteryRangeKm, 'km')]].map(([label, value]) => <div key={label}><p style={muted}>{label}</p><strong style={{ fontSize: 23 }}>{value}</strong></div>)}
        </div>
        <p>{snapshot.chargingState ? states[snapshot.chargingState] || 'Estado de carga no reconocido' : 'Estado no disponible'} · Límite: {num(snapshot.chargeLimit, '%')}</p>
        <p style={muted}>Lectura del vehículo: {date(snapshot.timestamp)}. La energía añadida a la batería no incluye necesariamente todas las pérdidas de carga ni equivale al consumo facturado por CFE.</p>
        <button type="button" style={{...button,background:'#b91c1c'}} disabled={snapshotSaving || chargeLoading || !selected || snapshot.energyAddedKwh === null || !snapshot.timestamp} onClick={() => void saveLatestSnapshot()}>{snapshotSaving ? 'Guardando en Neon…' : 'Guardar última lectura en Neon'}</button>
        <p style={muted}>Confirma que esta lectura corresponde a una carga en casa. Neon valida que la lectura de Tesla tenga menos de 30 minutos; no se agregará a los totales por periodo CFE como una sesión completa.</p>
        {snapshotSaveMessage && <p role="status">{snapshotSaveMessage}</p>}
      </> : !chargeMessage && <p>Pulsa «Consultar carga» para ver batería, energía añadida y potencia.</p>}
    </section>
    <section style={{...panel,minWidth:0}} aria-labelledby="tesla-history-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="tesla-history-heading" style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0 }}><History color="#f87171" aria-hidden /> Últimas cargas de Tesla</h2>
        <button type="button" style={button} disabled={historyLoading || !selected} onClick={() => loadHistory(1)}>{historyLoading ? 'Consultando…' : 'Consultar historial'}</button>
      </div>
      <p style={muted}>Muestra las sesiones que Tesla devuelve para tu cuenta. No representa un historial completo de cargas en casa ni el consumo al conducir.</p>
      {history?.message && <p role="status">{history.message}{history.diagnosticCode ? ` (Código: ${history.diagnosticCode})` : ''}{history.providerCode ? ` · Tesla: ${history.providerCode}` : ''}</p>}
      {(!history || history.requiresConsent) && <div>
        <a href="/api/tesla/connect?history=1" style={{ ...button, display: 'inline-block', textDecoration: 'none', background: '#b91c1c' }}>Autorizar historial en Tesla</a>
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
    <section style={{...panel,gridColumn:'1 / -1'}} aria-labelledby="tesla-home-heading">
      <h2 id="tesla-home-heading"><BatteryCharging color="#f87171" aria-hidden /> Cargas en casa · Neon</h2>
      <p style={muted}>Confirma que el vehículo está cargando en casa antes de registrar una lectura. Una lectura no equivale a una sesión terminada; las sesiones automáticas aún requieren monitoreo continuo.</p>
      <form onSubmit={saveManual} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 18 }}>
        <label>Fecha<br/><input aria-label="Fecha de carga" type="date" required value={manualDate} max={new Date().toLocaleDateString('en-CA')} onChange={e => setManualDate(e.target.value)} style={button} /></label>
        <label>Lugar<br/><select aria-label="Lugar de carga" value="home" disabled style={button}><option value="home">Casa</option></select></label>
        <label>Energía (kWh)<br/><input aria-label="Energía en kWh" type="number" min="0.01" max="300" step="0.01" required value={manualEnergy} onChange={e => setManualEnergy(e.target.value)} placeholder="Ej. 24.5" style={{ ...button, width: 135 }} /></label>
        <button type="submit" style={{ ...button, background: '#b91c1c' }} disabled={homeLoading || !selected}>{homeLoading ? 'Guardando…' : 'Guardar carga manual'}</button>
      </form>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button type="button" style={button} disabled={homeLoading} onClick={recordHome}>Registrar lectura en casa</button>
        <button type="button" style={button} disabled={homeLoading} onClick={loadHome}>Consultar registros Neon</button>
      </div>
      {homeMessage && <p role="status">{homeMessage}</p>}
      <h3 style={{marginTop:24}}>Comparativo CFE vs cargas en Neon por recibo</h3>
      <p style={muted}>Consumo CFE y cargas domésticas en kWh, junto con el pago del recibo y el costo estimado de las cargas a $4 MXN/kWh. Son magnitudes distintas y se muestran en dos gráficas separadas. La energía Tesla ya forma parte del consumo CFE: no se suma nuevamente.</p>
      {!cfePeriods.length ? <p style={muted}>Registra al menos un recibo CFE para visualizar el comparativo.</p> : !homeFetched ? <p style={muted}>Consultando las sesiones en Neon para comparar los periodos…</p> : <>
        <div style={{height:280,width:'100%',minWidth:0}} role="img" aria-label="Comparación por periodo del consumo CFE y las cargas Tesla en kilowatt-hora">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={[...cfeTotals].reverse().map(period => ({period:period.from, 'CFE kWh':period.kwh,'Tesla Neon kWh':period.neonKwh}))} margin={{top:8,right:12,left:0,bottom:8}}><CartesianGrid stroke="#374151" strokeDasharray="3 3"/><XAxis dataKey="period" stroke="#e5e7eb" fontSize={11}/><YAxis stroke="#e5e7eb"/><Tooltip/><Legend/><Bar dataKey="CFE kWh" fill="#f87171"/><Bar dataKey="Tesla Neon kWh" fill="#fbbf24"/></BarChart></ResponsiveContainer>
        </div>
        <div style={{height:280,width:'100%',minWidth:0,marginTop:20}} role="img" aria-label="Comparación por periodo del pago CFE y el costo estimado Tesla en pesos mexicanos">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={[...cfeTotals].reverse().map(period => ({period:period.from,'Pago CFE MXN':period.mxn,'Tesla estimado MXN':Number((period.neonKwh*4).toFixed(2))}))} margin={{top:8,right:12,left:0,bottom:8}}><CartesianGrid stroke="#374151" strokeDasharray="3 3"/><XAxis dataKey="period" stroke="#e5e7eb" fontSize={11}/><YAxis stroke="#e5e7eb"/><Tooltip formatter={(value) => `${Number(value).toFixed(2)} MXN`}/><Legend/><Bar dataKey="Pago CFE MXN" fill="#f87171"/><Bar dataKey="Tesla estimado MXN" fill="#fbbf24"/></BarChart></ResponsiveContainer>
        </div>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Periodo','CFE kWh','CFE MXN','Neon kWh','Tesla estimado MXN'].map(label=><th key={label} style={{padding:'10px 8px',borderBottom:'1px solid #475569'}}>{label}</th>)}</tr></thead><tbody>{cfeTotals.map(period=><tr key={period.id}><td style={{padding:'10px 8px',borderBottom:'1px solid #24402b'}}>{period.from} a {period.to}</td><td>{num(period.kwh,'kWh')}</td><td>{num(period.mxn,'MXN')}</td><td>{num(period.neonKwh,'kWh')}</td><td>{num(period.neonKwh*4,'MXN')}</td></tr>)}</tbody></table></div>
      </>}
      <h3 style={{marginTop:20}}>Energía cargada por periodo de CFE</h3>
      <p style={muted}>Totales de las sesiones domésticas registradas en Neon, según la fecha de cada carga. No incluyen lecturas aisladas ni cargas guardadas solo en este navegador. Los periodos se toman de tus recibos CFE registrados.</p>
      {!cfePeriods.length ? <p style={muted}>Agrega un recibo CFE con fechas de inicio y fin para ver los totales por periodo.</p> : <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Periodo CFE','Cargas','Total cargado'].map(label => <th key={label} style={{padding:'10px 8px',borderBottom:'1px solid #475569'}}>{label}</th>)}</tr></thead><tbody>{cfeTotals.map(period => <tr key={period.id}><td style={{padding:'10px 8px',borderBottom:'1px solid #24402b'}}>{period.from} a {period.to}</td><td>{homeFetched ? period.count : '—'}</td><td><strong>{homeFetched ? num(period.neonKwh,'kWh') : 'Pendiente de consulta'}</strong></td></tr>)}</tbody></table></div>}
      <p style={muted}>Sesiones domésticas registradas: {homeEvents.length}. Las cargas manuales se incluyen; las lecturas aisladas no.</p>
      {homeFetched && (homeEvents.length ? <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Fecha','Lugar','Energía','Acciones'].map(label => <th key={label} scope="col" style={{padding:'10px 8px',borderBottom:'1px solid #475569'}}>{label}</th>)}</tr></thead><tbody>{homeEvents.map(event => <tr key={event.id}><td style={{padding:'10px 8px',borderBottom:'1px solid #24402b'}}>{date(event.started_at)}</td><td>Casa</td><td>{num(event.energy_kwh === null ? null : Number(event.energy_kwh), 'kWh')}</td><td>{deleteCandidate === event.id ? <span><button type="button" style={button} disabled={homeLoading} onClick={() => void deleteHomeRecord(event.id)}>Confirmar eliminación</button> <button type="button" style={button} onClick={() => setDeleteCandidate(null)}>Cancelar</button></span> : <button type="button" style={button} disabled={homeLoading} onClick={() => setDeleteCandidate(event.id)}>Eliminar</button>}</td></tr>)}</tbody></table></div> : <p style={muted}>Aún no hay cargas domésticas registradas para este vehículo.</p>)}
    </section>
    <div style={{gridColumn:'1 / -1'}}><button type="button" aria-expanded={showDriving} onClick={() => setShowDriving(value => !value)} style={{...button,borderColor:'#7f1d1d'}}>{showDriving ? 'Ocultar consumo al conducir' : 'Mostrar consumo al conducir'}</button></div>
    {showDriving && <section style={{...panel,gridColumn:'1 / -1'}} aria-labelledby="tesla-driving-heading">
      <h2 id="tesla-driving-heading" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 0 }}><Gauge color="#f87171" aria-hidden /> Consumo al conducir</h2>
      <p>Sin historial de trayectos conectado.</p>
      <p style={muted}>Para mostrar Wh/km y kWh por trayecto necesitamos registrar energía y distancia durante la conducción o importar datos de un servicio que ya los haya guardado. La conexión de la cuenta por sí sola no recupera esos trayectos anteriores.</p>
    </section>}
  </div>;
}
