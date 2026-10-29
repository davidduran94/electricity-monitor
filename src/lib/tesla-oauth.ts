import { cookies } from 'next/headers';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const callbackUrl = 'https://electricity-monitor-smoky.vercel.app/login';
export const audience = process.env.TESLA_FLEET_API_BASE_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
export const scopes = 'openid offline_access vehicle_device_data vehicle_charging_cmds';
export const secureCookie = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };

function key() {
  const secret = process.env.TESLA_SESSION_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error('TESLA_SESSION_SECRET must be 64 hexadecimal characters');
  return Buffer.from(secret, 'hex');
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function decrypt<T>(value: string): T {
  const raw = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()) as T;
}
export type TeslaTokens = { access_token: string; refresh_token: string; expires_at: number };
export async function getTeslaTokens(): Promise<TeslaTokens | null> {
  const jar = await cookies();
  const value = jar.get('tesla_session')?.value;
  if (!value) return null;
  try { return decrypt<TeslaTokens>(value); } catch { return null; }
}
export async function exchangeTeslaToken(params: URLSearchParams) {
  const response = await fetch('https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(), cache: 'no-store', signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('Tesla OAuth token exchange failed');
  return response.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}
