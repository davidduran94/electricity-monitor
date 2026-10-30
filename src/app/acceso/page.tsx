'use client';
import { useState } from 'react';
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message || 'No se pudo iniciar sesión.'); return; }
      window.location.assign('/');
    } catch { setMessage('No se pudo conectar con el servidor.'); }
    finally { setLoading(false); }
  }
  const input: React.CSSProperties = { width:'100%', boxSizing:'border-box', padding:12, borderRadius:8, background:'#080d09', color:'#e7ffe9', border:'1px solid #475569' };
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20}}>
    <section style={{width:'100%',maxWidth:390,padding:28,background:'#101813',border:'1px solid #7f1d1d',borderRadius:16}}>
      <h1 style={{marginTop:0}}>⚡ Electricity Monitor</h1>
      <p style={{color:'#a3b7a6'}}>Acceso privado</p>
      <form onSubmit={submit} style={{display:'grid',gap:16}}>
        <label>Usuario<input style={{...input,marginTop:6}} autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label>
        <label>Contraseña<input style={{...input,marginTop:6}} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button type="submit" disabled={loading} style={{...input,background:'#b91c1c',cursor:'pointer',fontWeight:700}}>{loading?'Validando…':'Iniciar sesión'}</button>
        {message && <p role="alert" style={{color:'#fca5a5'}}>{message}</p>}
      </form>
    </section>
  </main>;
}
