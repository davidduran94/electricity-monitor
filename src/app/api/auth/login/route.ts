import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createSession, SESSION_COOKIE, sessionMaxAge } from '../../../../lib/dashboard-auth';
export const dynamic = 'force-dynamic';
const same = (a: string, b: string) => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'Origen no autorizado.' }, { status: 403 });
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!username || !password || !process.env.DASHBOARD_SESSION_SECRET || process.env.DASHBOARD_SESSION_SECRET.length < 32)
    return NextResponse.json({ message: 'El acceso no está configurado en Vercel.' }, { status: 503 });
  let body: { username?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: 'Solicitud inválida.' }, { status: 400 }); }
  if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 200 || body.password.length > 500 || !same(body.username, username) || !same(body.password, password))
    return NextResponse.json({ message: 'Usuario o contraseña incorrectos.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, await createSession(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: sessionMaxAge });
  return response;
}
