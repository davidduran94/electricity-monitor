import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { config, requestPartnerToken, hostedKey, tokenUrl } from './tesla-partner.mjs';
const settings = config({TESLA_CLIENT_ID:'id',TESLA_CLIENT_SECRET:'secret+&='});
test('form encoding preserves credentials and uses documented audience without command scopes', async () => {
  const token = await requestPartnerToken(settings, async (url, options) => {
    assert.equal(url, tokenUrl);
    assert.equal(options.body.get('client_secret'), 'secret+&=');
    assert.equal(options.body.get('audience'), settings.audience);
    assert.equal(options.body.has('scope'), false);
    assert.equal(options.redirect, 'error');
    return Response.json({access_token:'hidden'});
  });
  assert.equal(token, 'hidden');
});
test('reports allowlisted error without leaking provider description', async () => {
  await assert.rejects(requestPartnerToken(settings, async () => Response.json({error:'invalid_audience',error_description:'secret-value',access_token:'hidden'}, {status:400})), {message:'Partner token HTTP 400; Tesla error: invalid_audience'});
  await assert.rejects(requestPartnerToken(settings, async () => Response.json({error:'secret-value'}, {status:400})), {message:'Partner token HTTP 400; Tesla error: unrecognized_error'});
});
test('rejects unsafe audience and whitespace before transmitting credentials', () => {
  assert.throws(() => config({TESLA_CLIENT_ID:'id',TESLA_CLIENT_SECRET:'secret',TESLA_FLEET_API_BASE_URL:'https://example.com'}));
  assert.throws(() => config({TESLA_CLIENT_ID:'id',TESLA_CLIENT_SECRET:'secret\n'}));
});
test('public key must be anonymous P-256 PEM, not login redirect or HTML', async () => {
  await assert.rejects(hostedKey(settings.domain, async () => new Response('',{status:302})), /HTTP 302/);
  await assert.rejects(hostedKey(settings.domain, async () => new Response('<html>Login</html>')), /not valid PEM/);
  const {publicKey} = generateKeyPairSync('ec', {namedCurve:'prime256v1'});
  const pem = publicKey.export({type:'spki',format:'pem'});
  assert.equal(await hostedKey(settings.domain, async () => new Response(pem)), pem);
  const rsa = generateKeyPairSync('rsa', {modulusLength:2048}).publicKey.export({type:'spki',format:'pem'});
  await assert.rejects(hostedKey(settings.domain, async () => new Response(rsa)), /P-256/);
});
