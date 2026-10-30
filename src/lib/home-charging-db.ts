import { neon } from '@neondatabase/serverless';
import { createHmac } from 'node:crypto';

export function vehicleKey(vin: string) {
  const secret = process.env.TESLA_SESSION_SECRET;
  if (!secret) throw new Error('Tesla session secret missing');
  return createHmac('sha256', secret).update(vin).digest('hex');
}
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  return neon(process.env.DATABASE_URL);
}
