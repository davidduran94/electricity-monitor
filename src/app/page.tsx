'use client';
import TeslaInsights from '../components/TeslaInsights';
import { useEffect, useMemo, useState } from 'react';
import { Zap, HousePlug, CarFront, ReceiptText, BatteryCharging, Activity, PlusCircle, Download, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Bill = { id: string; from: string; to: string; kwh: number; mxn: number; paid: boolean };
type Charge = { id: string; date: string; kwh: number; cost: number };
const format = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);
const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #475569', background: '#080d09', color: '#e7ffe9', width: '100%', boxSizing: 'border-box' };
const panel: React.CSSProperties = { background: '#101813', border: '1px solid #24402b', borderRadius: 14, padding: 20 };
export default function Home() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [ready, setReady] = useState(false);
  const [tesla, setTesla] = useState<{connected:boolean;expired?:boolean}>({connected:false});
  const [teslaStatus, setTeslaStatus] = useState('');
  const [teslaChecking, setTeslaChecking] = useState(true);
  const [teslaVehicles, setTeslaVehicles] = useState<Array<{id:string;displayName:string;state?:string;vinLast4?:string}>>([]);
  useEffect(() => {
    let active = true;
    async function loadTesla() {
      try {
        let res = await fetch('/api/tesla/account', {cache:'no-store'});
        let session = await res.json();
        if (session.connected && session.expired) {
          const refreshed = await fetch('/api/tesla/refresh', {method:'POST', headers:{'Content-Type':'application/json'}});
          if (refreshed.ok) session = {connected:true,expired:false};
        }
        if (!active) return;
        setTesla(session);
        if (!session.connected) setTeslaStatus('No hay una sesión Tesla activa en este navegador. Si ya autorizaste, la sesión no se guardó o la autorización falló.');
        if (session.connected && !session.expired) {
          res = await fetch('/api/tesla/status', {cache:'no-store'});
          const data = await res.json();
          if (active) {
            if (res.ok) {
              setTeslaVehicles(data.vehicles || []);
              setTeslaStatus((data.vehicles || []).length === 0 ? 'La cuenta está conectada, pero Tesla no devolvió vehículos. Comprueba que el Model 3 esté vinculado a esta cuenta y que Fleet API tenga acceso.' : '');
            } else setTeslaStatus(data.message || 'No se pudo consultar Tesla.');
          }
        }
      } catch { if (active) setTeslaStatus('No se pudo consultar la conexión Tesla.'); }
      finally { if (active) setTeslaChecking(false); }
    }
    loadTesla();
    return () => { active = false; };
  }, []);
  async function disconnectTesla() {
    const res = await fetch('/api/tesla/disconnect', {method:'POST',headers:{'Content-Type':'application/json'}});
    if (res.ok) { setTesla({connected:false}); setTeslaVehicles([]); setTeslaStatus('Cuenta desconectada.'); }
  }
  const [bill, setBill] = useState({ from: '', to: '', kwh: '', mxn: '', paid: false });
  const [charge, setCharge] = useState({ date: '', kwh: '', cost: '' });
  useEffect(() => {
    try {
      setBills(JSON.parse(localStorage.getItem('electricity-bills') || '[]'));
      setCharges(JSON.parse(localStorage.getItem('electricity-charges') || '[]'));
    } catch { /* Ignore invalid previous browser data. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem('electricity-bills', JSON.stringify(bills)); }, [bills, ready]);
  useEffect(() => { if (ready) localStorage.setItem('electricity-charges', JSON.stringify(charges)); }, [charges, ready]);
  const totals = useMemo(() => ({
    kwh: bills.reduce((s, x) => s + x.kwh, 0),
    mxn: bills.reduce((s, x) => s + x.mxn, 0),
    teslaKwh: charges.reduce((s, x) => s + x.kwh, 0),
    teslaCost: charges.reduce((s, x) => s + x.cost, 0)
  }), [bills, charges]);
  const chartData = [...bills].sort((a, b) => a.from.localeCompare(b.from)).map(x => ({ name: x.from, 'Consumo CFE (kWh)': x.kwh, 'Pago CFE (MXN)': x.mxn }));
  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) window.location.assign('/acceso');
  }
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ bills, charges, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'electricity-monitor.json'; a.click(); URL.revokeObjectURL(url);
  };
  return <main style={{ maxWidth: 1100, margin: 'auto', padding: '28px 16px', color:'#e7ffe9' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 28 }}>
      <div><h1 style={{ margin: 0 }}>⚡ Electricity Monitor</h1><p style={{ color: '#a3b7a6' }}>Casa · Tesla Model 3 · CFE</p></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button onClick={exportData} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>⬇ Exportar respaldo JSON</button>
        <button onClick={logout} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', borderColor:'#7f1d1d' }}>Cerrar sesión</button>
      </div>
    </header>
    {tesla.connected && !tesla.expired && <p style={{fontSize:13,color:'#a3b7a6'}}>¿El historial devuelve HTTP 400? <a href="/api/tesla/connect?history=1" style={{color:'#f87171'}}>Volver a autorizar Tesla con permiso de carga</a>. Tesla solicitará confirmar los permisos.</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 290px), 1fr))',gap:16,marginBottom:22,alignItems:'stretch'}}>
    <section style={{ ...panel, minWidth: 0, borderColor: '#7f1d1d' }}>
      <h2 style={{display:'flex',alignItems:'center',gap:10}}><CarFront color='#f87171' /> Conexión Tesla Fleet</h2>
      <p>{tesla.connected && !tesla.expired ? 'Cuenta Tesla conectada' : 'Conecta tu Tesla para consultar información de tu vehículo.'}</p>
      {teslaChecking && <p role="status">Comprobando sesión Tesla...</p>}
      {teslaStatus && <p role="status">{teslaStatus}</p>}
      <p style={{fontSize:13,color:'#a3b7a6'}}>Estado de autorización: {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tesla') === 'authorization_failed' ? `La autorización falló (motivo: ${new URLSearchParams(window.location.search).get('reason') || 'no especificado'}).` : typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tesla') === 'connected' ? 'Tesla regresó y el servidor intentó guardar la sesión.' : 'Sin resultado de autorización en la URL.'}</p>
      {teslaVehicles.map((v,i) => <p key={i}>{v.displayName} · {v.state || 'Estado desconocido'} · VIN terminado en {v.vinLast4 || '—'}</p>)}
      {tesla.connected && !tesla.expired
        ? <button type="button" onClick={disconnectTesla} style={{...inputStyle,width:'auto',cursor:'pointer'}}>Desconectar Tesla</button>
        : <a href="/api/tesla/connect" style={{display:'inline-block',padding:'12px 18px',background:'#b91c1c',color:'white',borderRadius:8,textDecoration:'none'}}>Conectar Tesla</a>}
    </section>
    {tesla.connected && !tesla.expired && <TeslaInsights vehicles={teslaVehicles} cfePeriods={bills.map(({ id, from, to, kwh, mxn }) => ({ id, from, to, kwh, mxn }))} />}
    </div>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
      {([['Consumo CFE', format(totals.kwh) + ' kWh', <HousePlug size={22} color='#4ade80' />], ['Pagos CFE', money(totals.mxn), <ReceiptText size={22} color='#4ade80' />], ['Cargas Tesla', format(totals.teslaKwh) + ' kWh', <BatteryCharging size={22} color='#4ade80' />], ['Costo Tesla estimado', money(totals.teslaCost), <Zap size={22} color='#4ade80' />]] as const).map(([label, value, icon]) =>
        <div key={label} style={panel}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', color: '#a3b7a6' }}><span>{label}</span>{icon}</div><h2 style={{ marginBottom: 0 }}>{value}</h2></div>)}
    </section>
    <p style={{ color: '#a3b7a6', fontSize: 13 }}>Totales de los registros capturados, no lecturas en vivo. Las cargas en casa ya forman parte del consumo de CFE; no se suman nuevamente.</p>
    <section style={{ ...panel, marginTop: 22 }}><h2 style={{display:'flex',alignItems:'center',gap:10}}><Activity color='#4ade80' /> Histórico de recibos</h2>
      <div style={{ height: 290 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#24402b" /><XAxis dataKey="name" stroke="#c9f7d2" /><YAxis stroke="#c9f7d2" /><Tooltip /><Legend /><Bar dataKey="Consumo CFE (kWh)" fill="#4ade80" /><Bar dataKey="Pago CFE (MXN)" fill="#a3e635" /></BarChart></ResponsiveContainer></div>
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginTop: 22 }}>
      <section style={panel}><h2 style={{display:'flex',alignItems:'center',gap:10}}><ReceiptText color='#4ade80' /> Agregar recibo CFE</h2><form style={{ display: 'grid', gap: 10 }} onSubmit={e => { e.preventDefault(); if (!bill.from || !bill.to || Number(bill.kwh) < 0 || Number(bill.mxn) < 0 || !bill.kwh || !bill.mxn || bill.to < bill.from) return; setBills(x => [...x, { id: crypto.randomUUID(), from: bill.from, to: bill.to, kwh: Number(bill.kwh), mxn: Number(bill.mxn), paid: bill.paid }]); setBill({ from: '', to: '', kwh: '', mxn: '', paid: false }); }}>
        <label>Inicio del periodo<input type="date" required style={inputStyle} value={bill.from} onChange={e => setBill({ ...bill, from: e.target.value })} /></label>
        <label>Fin del periodo<input type="date" required style={inputStyle} value={bill.to} onChange={e => setBill({ ...bill, to: e.target.value })} /></label>
        <label>Consumo (kWh)<input type="number" min="0" step="0.01" required style={inputStyle} value={bill.kwh} onChange={e => setBill({ ...bill, kwh: e.target.value })} /></label>
        <label>Importe (MXN)<input type="number" min="0" step="0.01" required style={inputStyle} value={bill.mxn} onChange={e => setBill({ ...bill, mxn: e.target.value })} /></label>
        <label><input type="checkbox" checked={bill.paid} onChange={e => setBill({ ...bill, paid: e.target.checked })} /> Recibo pagado</label>
        <button style={{ ...inputStyle, cursor: 'pointer', background: '#15803d' }}>Guardar recibo</button></form>
      </section>
      <section style={panel}><h2 style={{display:'flex',alignItems:'center',gap:10}}><CarFront color='#4ade80' /> Registrar carga Tesla en casa</h2><form style={{ display: 'grid', gap: 10 }} onSubmit={e => { e.preventDefault(); if (!charge.date || !charge.kwh || Number(charge.kwh) <= 0 || Number(charge.cost) < 0) return; setCharges(x => [...x, { id: crypto.randomUUID(), date: charge.date, kwh: Number(charge.kwh), cost: Number(charge.cost || 0) }]); setCharge({ date: '', kwh: '', cost: '' }); }}>
        <label>Fecha<input type="date" required style={inputStyle} value={charge.date} onChange={e => setCharge({ ...charge, date: e.target.value })} /></label>
        <label>Energía (kWh)<input type="number" min="0.01" step="0.01" required style={inputStyle} value={charge.kwh} onChange={e => setCharge({ ...charge, kwh: e.target.value })} /></label>
        <label>Costo estimado (MXN)<input type="number" min="0" step="0.01" style={inputStyle} value={charge.cost} onChange={e => setCharge({ ...charge, cost: e.target.value })} /></label>
        <button style={{ ...inputStyle, cursor: 'pointer', background: '#15803d' }}>Guardar carga</button></form>
        <p style={{ fontSize: 13, color: '#a3b7a6' }}>El costo es una estimación introducida por ti; la tarifa CFE puede ser escalonada.</p>
      </section>
    </div>
    <section style={{ ...panel, marginTop: 22 }}><h2 style={{display:'flex',alignItems:'center',gap:10}}><HousePlug color='#4ade80' /> Recibos registrados</h2>{bills.length === 0 ? <p>Aún no hay recibos.</p> : bills.map(x => <div key={x.id} style={{ borderTop: '1px solid #24402b', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span>{x.from} a {x.to} · {format(x.kwh)} kWh · {money(x.mxn)} · {x.paid ? 'Pagado' : 'Pendiente'}</span><button onClick={() => setBills(a => a.filter(v => v.id !== x.id))}>Eliminar</button></div>)}</section>
    <section style={{ ...panel, marginTop: 16 }}><h2 style={{display:'flex',alignItems:'center',gap:10}}><BatteryCharging color='#4ade80' /> Cargas registradas</h2>{charges.length === 0 ? <p>Aún no hay cargas.</p> : charges.map(x => <div key={x.id} style={{ borderTop: '1px solid #24402b', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span>{x.date} · {format(x.kwh)} kWh · {money(x.cost)}</span><button onClick={() => setCharges(a => a.filter(v => v.id !== x.id))}>Eliminar</button></div>)}</section>
  </main>;
}
