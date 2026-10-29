import { config, requestPartnerToken } from './tesla-partner.mjs';
const settings = config();
for (const [label, scope] of [['original scopes', 'openid vehicle_device_data vehicle_charging_cmds'], ['registration without scopes', undefined]]) {
  try { await requestPartnerToken(settings, fetch, scope); console.log(`Tesla ${label}: OK (token not displayed).`); }
  catch (error) { console.error(`Tesla ${label}: ${error.name === 'Error' ? error.message : 'network error'}`); }
}
