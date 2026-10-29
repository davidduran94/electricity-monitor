import { NextResponse } from 'next/server';
export async function POST() {
  const response = NextResponse.json({ connected: false });
  response.cookies.delete('tesla_session');
  return response;
}
