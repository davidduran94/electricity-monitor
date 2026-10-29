import { createPublicKey } from 'node:crypto';

export const tokenUrl = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token';
const audiences = new Set(['https://fleet-api.prd.na.vn.cloud.tesla.com', 'https://fleet-api.prd.eu.vn.cloud.tesla.com']);
const errors = new Set(['invalid_request', 'invalid_client', 'invalid_grant', 'invalid_scope', 'invalid_audience', 'unauthorized_client', 'unsupported_grant_type', 'access_denied', 'server_error', 'temporarily_unavailable']);
export function config(env = process.env) {
  const audience = env.TESLA_FLEET_API_BASE_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
  if (!audiences.has(audience)) throw new Error('TESLA_FLEET_API_BASE_URL must be an official Fleet API origin without a trailing slash.');
  const clientId = env.TESLA_CLIENT_ID;
  const clientSecret = env.TESLA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('TESLA_CLIENT_ID and TESLA_CLIENT_SECRET are required.');
  if (clientId !== clientId.trim() || clientSecret !== clientSecret.trim()) throw new Error('Tesla credentials contain leading or trailing whitespace. Correct them in Vercel.');
  const domain = env.TESLA_PARTNER_DOMAIN || 'electricity-monitor-smoky.vercel.app';
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain) || domain.includes('..')) throw new Error('TESLA_PARTNER_DOMAIN must be a hostname.');
  return { audience, clientId, clientSecret, domain };
}
export async function requestPartnerToken(settings, request = fetch, scope) {
  const response = await request(tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // No scope is needed for partner registration; Tesla documents it as optional.
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: settings.clientId, client_secret: settings.clientSecret, audience: settings.audience, ...(scope ? { scope } : {}) }),
    redirect: 'error', signal: AbortSignal.timeout(12000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = errors.has(data.error) ? data.error : 'unrecognized_error';
    // Never log raw provider bodies: they can contain credentials or tokens.
    throw new Error(`Partner token HTTP ${response.status}; Tesla error: ${code}`);
  }
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('Tesla returned no partner access token.');
  return data.access_token;
}
export async function hostedKey(domain, request = fetch) {
  const response = await request(`https://${domain}/.well-known/appspecific/com.tesla.3p.public-key.pem`, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
  if (response.status !== 200) throw new Error(`Public key HTTP ${response.status}; it must be accessible without Vercel login or redirects.`);
  let key;
  try { key = createPublicKey(await response.text()); } catch { throw new Error('Hosted public key is not valid PEM.'); }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Hosted public key must use P-256.');
  return key.export({ type: 'spki', format: 'pem' });
}
