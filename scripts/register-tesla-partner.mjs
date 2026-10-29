/**
 * One-time Tesla Fleet partner registration.
 * Run locally with TESLA_CLIENT_ID and TESLA_CLIENT_SECRET in your environment.
 * Requires Node.js 20+. Never commit credentials or private keys.
 */
const domain = process.env.TESLA_PARTNER_DOMAIN || 'electricity-monitor-smoky.vercel.app';
const audience = process.env.TESLA_FLEET_API_BASE_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
const clientId = process.env.TESLA_CLIENT_ID;
const clientSecret = process.env.TESLA_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set TESLA_CLIENT_ID and TESLA_CLIENT_SECRET in your local environment.');
  process.exit(1);
}
const tokenResponse = await fetch('https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret,audience,scope:'openid vehicle_device_data vehicle_charging_cmds'})
});
if (!tokenResponse.ok) {
  console.error('Partner token request failed:', tokenResponse.status);
  process.exit(1);
}
const {access_token} = await tokenResponse.json();
const keyResponse = await fetch('https://' + domain + '/.well-known/appspecific/com.tesla.3p.public-key.pem');
if (!keyResponse.ok) {
  console.error('Public key is not accessible:', keyResponse.status);
  process.exit(1);
}
const response = await fetch(new URL('/api/1/partner_accounts', audience), {
  method:'POST',
  headers:{Authorization:'Bearer ' + access_token,'Content-Type':'application/json'},
  body:JSON.stringify({domain})
});
console.log('Tesla partner registration status:', response.status);
if (!response.ok) {
  console.error('Registration failed; inspect Tesla developer dashboard.');
  process.exit(1);
}
console.log('Partner registration completed for', domain);
