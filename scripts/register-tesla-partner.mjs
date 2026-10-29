/** Run with credentials in the environment. Never print tokens or private keys. */
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { config, requestPartnerToken, hostedKey } from './tesla-partner.mjs';

try {
  const settings = config();
  const token = await requestPartnerToken(settings);
  console.log('Tesla partner token: OK (token not displayed).');
  if (!process.argv.includes('--check-token')) {
    const publicKey = await hostedKey(settings.domain);
    console.log('Tesla public key: accessible anonymously, P-256.');
    if (!process.argv.includes('--check')) {
      const publishedPem = await readFile(new URL('../public/.well-known/appspecific/com.tesla.3p.public-key.pem', import.meta.url), 'utf8');
      const expectedPublicKey = createPublicKey(publishedPem).export({ type: 'spki', format: 'pem' });
      if (publicKey !== expectedPublicKey) throw new Error('Hosted public key differs from the reviewed repository key. Registration cancelled.');
      // Registration sends only the public key domain. The private key stays with its owner.
      const privatePem = process.env.TESLA_PARTNER_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (privatePem) {
        let privateKey;
        try { privateKey = createPrivateKey(privatePem); } catch { throw new Error('Invalid partner private key.'); }
        if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Partner private key must use P-256.');
        if (createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }) !== publicKey) throw new Error('Hosted public key does not match the existing private key.');
      }
      const response = await fetch(new URL('/api/1/partner_accounts', settings.audience), {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: settings.domain }), redirect: 'error', signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error(`Tesla partner registration HTTP ${response.status}. Check domain and allowed origins in Tesla Developer.`);
      console.log('Tesla partner registration: OK.');
    }
  }
} catch (error) {
  // All explicit errors contain only allowlisted diagnostics, never provider bodies.
  console.error(error instanceof Error && error.name === 'Error' ? error.message : 'Tesla request failed (network or timeout).');
  process.exitCode = 1;
}
