import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCert } from './certs.mjs';
import { genKey, pem, makeCert, SKIP_OPENSSL } from './fixtures.mjs';

const get = (checks, id) => checks.find((c) => c.id === id);
const opts = { skip: SKIP_OPENSSL };
const NOW = Date.now();

test('RSA 2048 fails bit length', opts, () => {
  const k = genKey('rsa2048');
  const c = inspectCert(Buffer.from(makeCert(k.privateKey).pem), { alg: 'PS256' });
  assert.equal(get(c, 'bit-length').status, 'fail');
  assert.match(get(c, 'bit-length').evidence, /^E-4[67]$/);
});

test('RSA 3072 with PS256 passes everything applicable', opts, () => {
  const k = genKey('rsa3072');
  const c = inspectCert(Buffer.from(makeCert(k.privateKey).pem), { alg: 'PS256' });
  for (const id of ['input-format', 'bit-length', 'alg-match', 'validity', 'validity-span']) assert.equal(get(c, id).status, 'pass', id);
  assert.equal(get(c, 'curve').status, 'skip');
  assert.equal(get(c, 'key-match').status, 'skip');
});

test('RSA 3072 with ES256 fails alg-match; RS256 fails citing E-44', opts, () => {
  const k = genKey('rsa3072');
  const buf = Buffer.from(makeCert(k.privateKey).pem);
  assert.equal(get(inspectCert(buf, { alg: 'ES256' }), 'alg-match').status, 'fail');
  const rs = get(inspectCert(buf, { alg: 'RS256' }), 'alg-match');
  assert.equal(rs.status, 'fail');
  assert.equal(rs.evidence, 'E-44');
});

test('P-256 with ES256 passes; with ES384 fails curve', opts, () => {
  const k = genKey('p256');
  const buf = Buffer.from(makeCert(k.privateKey).pem);
  const ok = inspectCert(buf, { alg: 'ES256' });
  for (const id of ['bit-length', 'curve', 'alg-match']) assert.equal(get(ok, id).status, 'pass', id);
  const bad = get(inspectCert(buf, { alg: 'ES384' }), 'curve');
  assert.equal(bad.status, 'fail');
  assert.equal(bad.evidence, 'E-45');
});

test('P-384 with ES384 passes with the not-measured note', opts, () => {
  const k = genKey('p384');
  const c = inspectCert(Buffer.from(makeCert(k.privateKey).pem), { alg: 'ES384' });
  assert.equal(get(c, 'curve').status, 'pass');
  assert.match(get(c, 'curve').detail, /listed by Oracle, not measured/);
});

test('5-year validity warns about the two-year shortening', opts, () => {
  const k = genKey('p256');
  const c = inspectCert(Buffer.from(makeCert(k.privateKey, { days: 5 * 365 }).pem), { alg: 'ES256' });
  const v = get(c, 'validity-span');
  assert.equal(v.status, 'warn');
  assert.match(v.detail, /two years/);
  assert.equal(v.evidence, 'E-49');
});

test('expired certificate fails; not-yet-valid fails', opts, () => {
  const k = genKey('p256');
  const old = makeCert(k.privateKey, { notBefore: '20200101000000Z', notAfter: '20210101000000Z' });
  assert.equal(get(inspectCert(Buffer.from(old.pem), { alg: 'ES256' }), 'validity').status, 'fail');
  const future = makeCert(k.privateKey, { notBefore: '20400101000000Z', notAfter: '20410101000000Z' });
  assert.equal(get(inspectCert(Buffer.from(future.pem), { alg: 'ES256' }), 'validity').status, 'fail');
});

test('DER input is parsed', opts, () => {
  const k = genKey('p256');
  const c = inspectCert(makeCert(k.privateKey).der, { alg: 'ES256' });
  assert.equal(get(c, 'input-format').status, 'pass');
  assert.match(get(c, 'input-format').detail, /DER/);
  assert.equal(get(c, 'curve').status, 'pass');
});

test('PEM chain: first certificate is used and says so', opts, () => {
  const a = genKey('p256');
  const b = genKey('rsa2048');
  const chain = makeCert(a.privateKey).pem + makeCert(b.privateKey).pem;
  const c = inspectCert(Buffer.from(chain), { alg: 'ES256' });
  assert.match(get(c, 'input-format').detail, /first of 2/);
  assert.equal(get(c, 'curve').status, 'pass');
});

test('file with a private key block: key never appears in details', opts, () => {
  const k = genKey('p256');
  const keyPem = pem(k.privateKey);
  const body = keyPem.split('\n').filter((l) => l && !l.startsWith('-----'))[0];
  const file = keyPem + makeCert(k.privateKey).pem;
  const c = inspectCert(Buffer.from(file), { alg: 'ES256' });
  assert.match(get(c, 'input-format').detail, /private key block/);
  assert.equal(get(c, 'curve').status, 'pass');
  assert.ok(!JSON.stringify(c).includes(body));
});

test('garbage input fails input-format in one line', () => {
  const c = inspectCert(Buffer.from('hello world'), { alg: 'ES256' });
  assert.equal(c.length, 1);
  assert.equal(c[0].id, 'input-format');
  assert.equal(c[0].status, 'fail');
  assert.ok(!c[0].detail.includes('\n'));
});

test('matching key passes; mismatched key fails', opts, () => {
  const k = genKey('p256');
  const other = genKey('p256');
  const buf = Buffer.from(makeCert(k.privateKey).pem);
  assert.equal(get(inspectCert(buf, { alg: 'ES256', privateKeyPem: pem(k.privateKey) }), 'key-match').status, 'pass');
  const m = get(inspectCert(buf, { alg: 'ES256', privateKeyPem: pem(other.privateKey) }), 'key-match');
  assert.equal(m.status, 'fail');
  assert.match(m.detail, /key does not match certificate/);
});

test('PKCS#1, PKCS#8 and SEC1 keys are each accepted', opts, () => {
  const rsa = genKey('rsa3072');
  const rbuf = Buffer.from(makeCert(rsa.privateKey).pem);
  for (const type of ['pkcs1', 'pkcs8']) {
    const kp = pem(rsa.privateKey, type);
    assert.match(kp, type === 'pkcs1' ? /BEGIN RSA PRIVATE KEY/ : /BEGIN PRIVATE KEY/);
    assert.equal(get(inspectCert(rbuf, { alg: 'PS256', privateKeyPem: kp }), 'key-match').status, 'pass', type);
  }
  const ec = genKey('p256');
  const ebuf = Buffer.from(makeCert(ec.privateKey).pem);
  const sec1 = pem(ec.privateKey, 'sec1');
  assert.match(sec1, /BEGIN EC PRIVATE KEY/);
  assert.equal(get(inspectCert(ebuf, { alg: 'ES256', privateKeyPem: sec1 }), 'key-match').status, 'pass');
});

test('encrypted PEM key gives a one-line fail with no key material or passphrase', opts, () => {
  const k = genKey('rsa3072');
  const buf = Buffer.from(makeCert(k.privateKey).pem);
  const enc = k.privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'PASSPHRASE_XYZ' });
  const m = get(inspectCert(buf, { alg: 'PS256', privateKeyPem: enc }), 'key-match');
  assert.equal(m.status, 'fail');
  assert.match(m.detail, /passphrase/i);
  assert.ok(!m.detail.includes('\n'));
  assert.ok(!m.detail.includes('PASSPHRASE_XYZ'));
  assert.ok(!m.detail.includes('at '));
});

test('unparseable key gives a one-line fail without echoing it', opts, () => {
  const k = genKey('p256');
  const buf = Buffer.from(makeCert(k.privateKey).pem);
  const m = get(inspectCert(buf, { alg: 'ES256', privateKeyPem: '-----BEGIN PRIVATE KEY-----\nSECRETBITS\n-----END PRIVATE KEY-----' }), 'key-match');
  assert.equal(m.status, 'fail');
  assert.ok(!JSON.stringify(m).includes('SECRETBITS'));
  assert.ok(!m.detail.includes('\n'));
});

test('now option controls validity', opts, () => {
  const k = genKey('p256');
  const buf = Buffer.from(makeCert(k.privateKey, { days: 30 }).pem);
  assert.equal(get(inspectCert(buf, { alg: 'ES256', now: NOW + 60 * 86400e3 }), 'validity').status, 'fail');
});
