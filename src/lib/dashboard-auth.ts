export const SESSION_COOKIE = 'electricity_auth';
const encoder = new TextEncoder();
const maxAgeSeconds = 60 * 60 * 24 * 7;
function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function signingKey(): Promise<CryptoKey | null> {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function createSession(): Promise<string> {
  const key = await signingKey();
  if (!key) throw new Error('DASHBOARD_SESSION_SECRET is missing or too short');
  const payload = base64url(encoder.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + maxAgeSeconds, nonce: crypto.randomUUID() })));
  const signature = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
  return payload + '.' + signature;
}
export async function validSession(token?: string): Promise<boolean> {
  if (!token || token.length > 1024) return false;
  const key = await signingKey();
  if (!key) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    if (!(await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(parts[0])))) return false;
    const json = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return typeof data.exp === 'number' && data.exp > Date.now() / 1000 && data.exp <= Date.now() / 1000 + maxAgeSeconds;
  } catch { return false; }
}
export const sessionMaxAge = maxAgeSeconds;
