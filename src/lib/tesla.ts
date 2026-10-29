const base = process.env.TESLA_FLEET_API_BASE_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
export async function teslaRequest(path: string, accessToken: string) {
  const response = await fetch(new URL(path, base), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Tesla API returned HTTP ${response.status}`);
  return response.json();
}
