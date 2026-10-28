'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Bill = { id: string; from: string; to: string; kwh: number; mxn: number; paid: boolean };
type Charge = { id: string; date: string; kwh: number; cost: number };
const format = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);
const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: 'white', width: '100%', boxSizing: 'border-box' };
const panel: React.CSSProperties = { background: '#18243a', border: '1px solid #334155', borderRadius: 14, padding: 20 };
export default function Home() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [ready, setReady] = useState(false);
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
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ bills, charges, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'electricity-monitor.json'; a.click(); URL.revokeObjectURL(url);
  };
  return <main style={{ maxWidth: 1100, margin: 'auto', padding: '28px 16px' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 28 }}>
      <div><h1 style={{ margin: 0 }}>⚡ Electricity Monitor</h1><p style={{ color: '#94a3b8' }}>Casa · Tesla Model 3 · CFE</p></div>
      <button onClick={exportData} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Exportar respaldo JSON</button>
    </header>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
      {([['Consumo CFE', format(totals.kwh) + ' kWh'], ['Pagos CFE', money(totals.mxn)], ['Cargas Tesla', format(totals.teslaKwh) + ' kWh'], ['Costo Tesla estimado', money(totals.teslaCost)]] as const).map(([label, value]) =>
        <div key={label} style={panel}><div style={{ color: '#94a3b8' }}>{label}</div><h2 style={{ marginBottom: 0 }}>{value}</h2></div>)}
    </section>
    <p style={{ color: '#94a3b8', fontSize: 13 }}>Totales de los registros capturados, no lecturas en vivo. Las cargas en casa ya forman parte del consumo de CFE; no se suman nuevamente.</p>
    <section style={{ ...panel, marginTop: 22 }}><h2>Histórico de recibos</h2>
      <div style={{ height: 290 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#334155" /><XAxis dataKey="name" stroke="#cbd5e1" /><YAxis stroke="#cbd5e1" /><Tooltip /><Legend /><Bar dataKey="Consumo CFE (kWh)" fill="#38bdf8" /><Bar dataKey="Pago CFE (MXN)" fill="#34d399" /></BarChart></ResponsiveContainer></div>
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16, marginTop: 22 }}>
      <section style={panel}><h2>Agregar recibo CFE</h2><form style={{ display: 'grid', gap: 10 }} onSubmit={e => { e.preventDefault(); if (!bill.from || !bill.to || Number(bill.kwh) < 0 || Number(bill.mxn) < 0 || !bill.kwh || !bill.mxn || bill.to < bill.from) return; setBills(x => [...x, { id: crypto.randomUUID(), from: bill.from, to: bill.to, kwh: Number(bill.kwh), mxn: Number(bill.mxn), paid: bill.paid }]); setBill({ from: '', to: '', kwh: '', mxn: '', paid: false }); }}>
        <label>Inicio del periodo<input type="date" required style={inputStyle} value={bill.from} onChange={e => setBill({ ...bill, from: e.target.value })} /></label>
        <label>Fin del periodo<input type="date" required style={inputStyle} value={bill.to} onChange={e => setBill({ ...bill, to: e.target.value })} /></label>
        <label>Consumo (kWh)<input type="number" min="0" step="0.01" required style={inputStyle} value={bill.kwh} onChange={e => setBill({ ...bill, kwh: e.target.value })} /></label>
        <label>Importe (MXN)<input type="number" min="0" step="0.01" required style={inputStyle} value={bill.mxn} onChange={e => setBill({ ...bill, mxn: e.target.value })} /></label>
        <label><input type="checkbox" checked={bill.paid} onChange={e => setBill({ ...bill, paid: e.target.checked })} /> Recibo pagado</label>
        <button style={{ ...inputStyle, cursor: 'pointer', background: '#0369a1' }}>Guardar recibo</button></form>
      </section>
      <section style={panel}><h2>Registrar carga Tesla en casa</h2><form style={{ display: 'grid', gap: 10 }} onSubmit={e => { e.preventDefault(); if (!charge.date || !charge.kwh || Number(charge.kwh) <= 0 || Number(charge.cost) < 0) return; setCharges(x => [...x, { id: crypto.randomUUID(), date: charge.date, kwh: Number(charge.kwh), cost: Number(charge.cost || 0) }]); setCharge({ date: '', kwh: '', cost: '' }); }}>
        <label>Fecha<input type="date" required style={inputStyle} value={charge.date} onChange={e => setCharge({ ...charge, date: e.target.value })} /></label>
        <label>Energía (kWh)<input type="number" min="0.01" step="0.01" required style={inputStyle} value={charge.kwh} onChange={e => setCharge({ ...charge, kwh: e.target.value })} /></label>
        <label>Costo estimado (MXN)<input type="number" min="0" step="0.01" style={inputStyle} value={charge.cost} onChange={e => setCharge({ ...charge, cost: e.target.value })} /></label>
        <button style={{ ...inputStyle, cursor: 'pointer', background: '#0369a1' }}>Guardar carga</button></form>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>El costo es una estimación introducida por ti; la tarifa CFE puede ser escalonada.</p>
      </section>
    </div>
    <section style={{ ...panel, marginTop: 22 }}><h2>Recibos registrados</h2>{bills.length === 0 ? <p>Aún no hay recibos.</p> : bills.map(x => <div key={x.id} style={{ borderTop: '1px solid #334155', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span>{x.from} a {x.to} · {format(x.kwh)} kWh · {money(x.mxn)} · {x.paid ? 'Pagado' : 'Pendiente'}</span><button onClick={() => setBills(a => a.filter(v => v.id !== x.id))}>Eliminar</button></div>)}</section>
    <section style={{ ...panel, marginTop: 16 }}><h2>Cargas registradas</h2>{charges.length === 0 ? <p>Aún no hay cargas.</p> : charges.map(x => <div key={x.id} style={{ borderTop: '1px solid #334155', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span>{x.date} · {format(x.kwh)} kWh · {money(x.cost)}</span><button onClick={() => setCharges(a => a.filter(v => v.id !== x.id))}>Eliminar</button></div>)}</section>
  </main>;
}
