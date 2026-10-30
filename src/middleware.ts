import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, validSession } from './lib/dashboard-auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/login' || path === '/api/auth/login') return NextResponse.next();
  if (await validSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ message: 'Inicia sesión para continuar.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'] };
