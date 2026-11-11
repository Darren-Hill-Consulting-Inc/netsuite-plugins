import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signAssertion, decodeJwt, lifetimeOf, ALLOWED_ALGS } from './jwt.mjs';
import { genKey, pem } from './fixtures.mjs';

const base = { clientId: 'FAKE_CONSUMER_KEY', certId: 'FAKE_CERT_ID', scopes: ['rest_webservices'], tokenUrl: 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token' };

function verify(token, publicKey, alg) {
  const [h, p, s] = token.split('.');
  const hash = 'sha' + alg.slice(2);
  const opts = alg.startsWith('PS')
    ? { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(alg.slice(2)) / 8 }
    : { key: publicKey, dsaEncoding: 'ieee-p1363' };
  return crypto.verify(hash, Buffer.from(`${h}.${p}`), opts, Buffer.from(s, 'base64url'));
}

test('ALLOWED_ALGS', () => {
  assert.deepEqual(ALLOWED_ALGS, ['PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512']);
});

test('PS256 assertion verifies and carries the expected claims', () => {
  const { privateKey, publicKey } = genKey('rsa3072');
  const t = signAssertion({ ...base, privateKeyPem: pem(privateKey), alg: 'PS256', now: 1_700_000_000_000 });
  assert.ok(verify(t, publicKey, 'PS256'));
  const { header, payload } = decodeJwt(t);
  assert.deepEqual(header, { typ: 'JWT', alg: 'PS256', kid: 'FAKE_CERT_ID' });
  assert.equal(payload.iss, 'FAKE_CONSUMER_KEY');
  assert.deepEqual(payload.scope, ['rest_webservices']);
  assert.equal(payload.aud, base.tokenUrl);
  assert.equal(payload.iat, 1_700_000_000);
  assert.equal(payload.exp - payload.iat, 300);
  assert.equal(lifetimeOf(t), 300);
});

test('ES256 assertion verifies (ieee-p1363)', () => {
  const { privateKey, publicKey } = genKey('p256');
  const t = signAssertion({ ...base, privateKeyPem: pem(privateKey), alg: 'ES256' });
  assert.ok(verify(t, publicKey, 'ES256'));
  assert.equal(Buffer.from(t.split('.')[2], 'base64url').length, 64);
});

test('PS384 verifies with a custom lifetime', () => {
  const { privateKey, publicKey } = genKey('rsa3072');
  const t = signAssertion({ ...base, privateKeyPem: pem(privateKey), alg: 'PS384', lifetimeSec: 600 });
  assert.ok(verify(t, publicKey, 'PS384'));
  assert.equal(lifetimeOf(t), 600);
});

test('RS256 is refused with an evidence citation', () => {
  const { privateKey } = genKey('rsa3072');
  assert.throws(() => signAssertion({ ...base, privateKeyPem: pem(privateKey), alg: 'RS256' }), /RS256.*\[E-44\]/);
  assert.throws(() => signAssertion({ ...base, privateKeyPem: pem(privateKey), alg: 'HS256' }), /\[E-42\]/);
});

test('key and algorithm mismatches are refused before signing', () => {
  const rsa = pem(genKey('rsa3072').privateKey);
  const p256 = pem(genKey('p256').privateKey);
  assert.throws(() => signAssertion({ ...base, privateKeyPem: rsa, alg: 'ES256' }), /needs an EC key/);
  assert.throws(() => signAssertion({ ...base, privateKeyPem: p256, alg: 'PS256' }), /needs an RSA key/);
  assert.throws(() => signAssertion({ ...base, privateKeyPem: p256, alg: 'ES384' }), (e) => /\[E-45\]/.test(e.message) && !e.message.includes('\n'));
  const ed = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => signAssertion({ ...base, privateKeyPem: ed, alg: 'ES256' }), /unsupported private key type/);
});

test('RS384 and RS512 are refused citing the supported list', () => {
  const { privateKey } = genKey('rsa3072');
  assert.throws(() => signAssertion({ ...base, privateKeyPem: pem(privateKey), alg: 'RS512' }), /\[E-42\]/);
});

test('P-521 ES512 and P-384 ES384 sign', () => {
  for (const [kind, alg] of [['p521', 'ES512'], ['p384', 'ES384']]) {
    const { privateKey, publicKey } = genKey(kind);
    assert.ok(verify(signAssertion({ ...base, privateKeyPem: pem(privateKey), alg }), publicKey, alg));
  }
});

test('bad key gives a one-line error without key material', () => {
  const bad = '-----BEGIN PRIVATE KEY-----\nSECRETMATERIALxyz\n-----END PRIVATE KEY-----';
  try {
    signAssertion({ ...base, privateKeyPem: bad, alg: 'PS256' });
    assert.fail('should throw');
  } catch (e) {
    assert.ok(!e.message.includes('SECRETMATERIAL'));
    assert.ok(!e.message.includes('\n'));
  }
});

test('decodeJwt / lifetimeOf tolerate junk', () => {
  assert.throws(() => decodeJwt('nope'), /JWT/);
  assert.equal(lifetimeOf('nope'), null);
  const t = `${Buffer.from('{}').toString('base64url')}.${Buffer.from('{}').toString('base64url')}.x`;
  assert.equal(lifetimeOf(t), null);
});
