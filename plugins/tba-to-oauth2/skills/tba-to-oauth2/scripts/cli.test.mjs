// CLI tests against a local mock of the NetSuite token, SuiteQL and certificate endpoints.
// Status codes and bodies follow the measured shapes in references/evidence.md. All values are fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { genKey, pem, makeCert, SKIP_OPENSSL } from './lib/fixtures.mjs';
import { run as checkCert } from './check-cert.mjs';
import { run as checkAssertion } from './check-assertion.mjs';
import { run as m2mCheck } from './m2m-check.mjs';
import { run as refreshCheck } from './refresh-check.mjs';
import { run as rotateCert } from './rotate-cert.mjs';
import { run as verify } from './verify.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ACCOUNT = '1234567_SB1';
const CLIENT_ID = 'FAKE_CLIENT_ID_0123456789abcdef';
const CLIENT_SECRET = 'FAKE_CLIENT_SECRET_do_not_print';
const REFRESH_TOKEN = 'FAKE_REFRESH_TOKEN_do_not_print';
const ROTATED_REFRESH_TOKEN = 'FAKE_ROTATED_REFRESH_TOKEN_do_not_print';
const CERT_ID = 'FAKE_CERT_ID_active_0001';
const REVOKED_CERT_ID = 'FAKE_CERT_ID_revoked_0002';
const NEW_CERT_ID = 'FAKE_CERT_ID_new_0003';
const ENTITY_NAME = 'FAKE_ENTITY_NAME_do_not_print';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = (header, payload) => `${b64(header)}.${b64(payload)}.ZmFrZS1zaWduYXR1cmU`;
const NOW_S = Math.floor(Date.now() / 1000);
const ACCESS_TOKEN = fakeJwt({ alg: 'RS256', typ: 'JWT' }, { sub: 'fake', iat: NOW_S, exp: NOW_S + 3600 });

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tba-cli-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const write = (name, text) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, text, { mode: 0o600 });
  return p;
};

const RSA = genKey('rsa3072');
const KEY_PEM = pem(RSA.privateKey);
const KEY_PATH = write('key.pem', KEY_PEM);
const CERT_PEM = SKIP_OPENSSL ? null : makeCert(RSA.privateKey).pem;
const CERT_PATH = CERT_PEM ? write('cert.pem', CERT_PEM) : null;
const CERT_AND_KEY_PATH = CERT_PEM ? write('integration-2027.pem', `${CERT_PEM}${KEY_PEM}`) : null;
const CERT_NOT_AFTER = CERT_PEM ? new Date(new crypto.X509Certificate(CERT_PEM).validTo).toISOString().slice(0, 10) : '2027-11-11';

const SECRETS = [CLIENT_SECRET, REFRESH_TOKEN, ROTATED_REFRESH_TOKEN, ACCESS_TOKEN, CLIENT_ID, ENTITY_NAME, KEY_PEM.split('\n')[1]];

// ---- mock server ----------------------------------------------------------

const CERT_LIST = [
  { certificate_id: CERT_ID, algorithm: 'RSA', valid_from: '2026-11-01', valid_until: '2028-11-01', revoked: false,
    application: { id: '9', refName: 'FAKE_APP' }, entity: { id: '42', refName: ENTITY_NAME }, role: { id: '3', refName: 'FAKE_ROLE' } },
  { certificate_id: REVOKED_CERT_ID, algorithm: 'EC', valid_from: '2026-11-01', valid_until: '2028-11-01', revoked: true,
    application: { id: '9', refName: 'FAKE_APP' }, entity: { id: '42', refName: ENTITY_NAME }, role: { id: '3', refName: 'FAKE_ROLE' } },
];
const json = (status, body) => ({ status, body: JSON.stringify(body), type: 'application/json' });
const authed = (r) => r.headers.authorization === `Bearer ${ACCESS_TOKEN}`;

const DEFAULTS = {
  'POST token': (r) => {
    const p = new URLSearchParams(r.body);
    if (p.get('grant_type') === 'client_credentials' && p.get('client_assertion')) {
      return json(200, { access_token: ACCESS_TOKEN, expires_in: '3600', token_type: 'Bearer' });
    }
    if (p.get('grant_type') === 'refresh_token' && p.get('refresh_token') === REFRESH_TOKEN) {
      if (p.get('client_id') === CLIENT_ID) {
        return json(200, { access_token: ACCESS_TOKEN, refresh_token: ROTATED_REFRESH_TOKEN, expires_in: '3600', token_type: 'Bearer' });
      }
      const basic = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
      if (r.headers.authorization === basic) return json(200, { access_token: ACCESS_TOKEN, expires_in: '3600', token_type: 'Bearer' });
      return json(400, { error: 'invalid_client' });
    }
    return json(400, { error: 'invalid_request' });
  },
  'POST suiteql': (r) => (authed(r) && r.headers.prefer === 'transient'
    ? json(200, { links: [], count: 1, hasMore: false, items: [{ links: [], ok: '1' }], offset: 0, totalResults: 1 })
    : json(401, { title: 'Unauthorized' })),
  'GET certs': (r) => (authed(r) ? json(200, CERT_LIST) : json(401, { title: 'Unauthorized' })),
  'POST certs': (r) => (authed(r) ? json(200, { certificate_id: NEW_CERT_ID, valid_until: CERT_NOT_AFTER, revoked: false }) : json(401, { title: 'Unauthorized' })),
  'POST revoke': (r) => (authed(r) ? { status: 200, body: 'Successfully revoked', type: 'text/plain' } : json(401, { title: 'Unauthorized' })),
};

function routeOf(pathname) {
  if (pathname === '/services/rest/auth/oauth2/v1/token') return 'token';
  if (pathname === '/services/rest/query/v1/suiteql') return 'suiteql';
  const base = `/services/rest/auth/oauth2/v1/clients/${CLIENT_ID}/certificates`;
  if (pathname === base) return 'certs';
  if (pathname.startsWith(`${base}/`) && pathname.endsWith('/revoke')) return 'revoke';
  return null;
}

async function startMock(overrides = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { pathname } = new URL(req.url, 'http://127.0.0.1');
      const r = { method: req.method, path: pathname, route: routeOf(pathname), headers: req.headers, body };
      requests.push(r);
      const key = `${req.method} ${r.route}`;
      const handler = overrides[key] ?? DEFAULTS[key];
      const out = handler ? handler(r) : { status: 404, body: 'not found', type: 'text/plain' };
      res.writeHead(out.status, { 'Content-Type': out.type ?? 'text/plain' });
      res.end(out.body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    to: (route) => requests.filter((r) => r.route === route),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// ---- harness ---------------------------------------------------------------

function baseEnv(mock) {
  return {
    NS_ACCOUNT_ID: ACCOUNT,
    NS_CLIENT_ID: CLIENT_ID,
    NS_CLIENT_SECRET: CLIENT_SECRET,
    NS_REFRESH_TOKEN: REFRESH_TOKEN,
    NS_CERT_ID: CERT_ID,
    NS_PRIVATE_KEY_PATH: KEY_PATH,
    ...(CERT_PATH ? { NS_CERT_PATH: CERT_PATH } : {}),
    NS_ALG: 'PS256',
    ...(mock ? { NS_BASE_URL: mock.url } : {}),
  };
}

function sink() {
  const s = new PassThrough();
  s.text = '';
  s.on('data', (d) => (s.text += d));
  return s;
}

/** Run a CLI in-process. `typed` is what the fake interactive user types at the prompt. */
async function call(run, argv, { mock, env = {}, typed, isTTY = false, cwd = TMP } = {}) {
  const stdout = sink();
  const stderr = sink();
  const input = new PassThrough();
  if (typed !== undefined) input.write(`${typed}\n`);
  else input.end();
  const code = await run({ argv, env: { ...baseEnv(mock), ...env }, stdout, stderr, input, isTTY, cwd });
  return { code, out: stdout.text, err: stderr.text };
}

/** Status and detail of the report row whose title matches. */
function row(report, title) {
  const line = report.split('\n').find((l) => l.startsWith(`| ${title} |`));
  assert.ok(line, `no row "${title}" in:\n${report}`);
  const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
  return { status: cells[2], detail: cells[3], evidence: cells[4] };
}

const acct = ['--account', ACCOUNT];

// ---- m2m-check -------------------------------------------------------------

test('m2m-check: 200 passes mint, lifetime, select1 and list-certs', async () => {
  const mock = await startMock();
  try {
    const r = await call(m2mCheck, acct, { mock });
    assert.equal(r.code, 0, r.out + r.err);
    for (const t of ['Token request (client credentials)', 'Access token lifetime', 'REST SuiteQL SELECT 1', 'List certificates']) {
      assert.equal(row(r.out, t).status, 'pass', t);
    }
    const life = row(r.out, 'Access token lifetime');
    assert.match(life.detail, /3600/);
    assert.match(life.detail, /documented \[E-25\]/);
    assert.equal(life.evidence, '[E-41]');
    const tok = new URLSearchParams(mock.to('token')[0].body);
    assert.equal(tok.get('grant_type'), 'client_credentials');
    assert.equal(tok.get('client_assertion_type'), 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    const q = mock.to('suiteql')[0];
    assert.equal(q.headers.prefer, 'transient');
    assert.deepEqual(JSON.parse(q.body), { q: 'SELECT 1 AS ok FROM dual' });
    assert.equal(mock.to('certs')[0].method, 'GET');
  } finally {
    await mock.close();
  }
});

test('m2m-check: 400 invalid_grant fails and lists the measured causes', async () => {
  const mock = await startMock({ 'POST token': () => json(400, { error: 'invalid_grant' }) });
  try {
    const r = await call(m2mCheck, acct, { mock });
    assert.equal(r.code, 1);
    const mint = row(r.out, 'Token request (client credentials)');
    assert.equal(mint.status, 'fail');
    assert.match(mint.detail, /invalid_grant/);
    assert.match(mint.detail, /RS256.*\[E-44\]/);
    assert.match(mint.detail, /curve.*\[E-45\]/);
    assert.match(mint.detail, /kid.*\[E-52\]/);
    assert.equal(row(r.out, 'REST SuiteQL SELECT 1').status, 'skip');
    assert.equal(mock.to('suiteql').length, 0);
  } finally {
    await mock.close();
  }
});

test('m2m-check: 400 invalid_client points at a revoked certificate', async () => {
  const mock = await startMock({ 'POST token': () => json(400, { error: 'invalid_client' }) });
  try {
    const r = await call(m2mCheck, acct, { mock });
    assert.equal(r.code, 1);
    assert.match(row(r.out, 'Token request (client credentials)').detail, /revoked.*\[E-60\]/);
  } finally {
    await mock.close();
  }
});

test('m2m-check: 503 HTML body fails with status and a redacted snippet, no crash', async () => {
  const html = `<html><head><title>503 Service Unavailable</title></head><body>upstream ${CLIENT_SECRET} ${CLIENT_ID}</body></html>`;
  const mock = await startMock({ 'POST token': () => ({ status: 503, body: html, type: 'text/html' }) });
  try {
    const r = await call(m2mCheck, acct, { mock });
    assert.equal(r.code, 1);
    const mint = row(r.out, 'Token request (client credentials)');
    assert.equal(mint.status, 'fail');
    assert.match(mint.detail, /HTTP 503, non-JSON response/);
    assert.match(mint.detail, /Service Unavailable/);
    assert.ok(!r.out.includes(CLIENT_SECRET) && !r.out.includes(CLIENT_ID));
    assert.doesNotMatch(r.err, /at .*\.mjs:\d+/);
  } finally {
    await mock.close();
  }
});

test('m2m-check: empty 502 body fails with "empty response"', async () => {
  const mock = await startMock({ 'POST token': () => ({ status: 502, body: '' }) });
  try {
    const r = await call(m2mCheck, acct, { mock });
    assert.equal(r.code, 1);
    assert.match(row(r.out, 'Token request (client credentials)').detail, /HTTP 502, empty response/);
  } finally {
    await mock.close();
  }
});

test('--account that does not match NS_ACCOUNT_ID refuses with exit 2 and no requests', async () => {
  const mock = await startMock();
  try {
    const r = await call(m2mCheck, ['--account', '7654321'], { mock });
    assert.equal(r.code, 2);
    assert.match(r.err, /does not match/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

// ---- refresh-check ---------------------------------------------------------

test('refresh-check confidential: no refresh_token in the response passes as expected', async () => {
  const mock = await startMock();
  try {
    const r = await call(refreshCheck, acct, { mock });
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(row(r.out, 'Token request (refresh token)').status, 'pass');
    const rot = row(r.out, 'Refresh token rotation');
    assert.equal(rot.status, 'pass');
    assert.match(rot.detail, /refresh token not rotated \(expected for confidential clients\)/);
    assert.equal(row(r.out, 'Access token lifetime').evidence, '[E-29]');
    const tok = mock.to('token')[0];
    assert.match(tok.headers.authorization, /^Basic /);
    assert.equal(new URLSearchParams(tok.body).get('client_id'), null);
  } finally {
    await mock.close();
  }
});

test('refresh-check confidential: invalid_grant explains expiry and chain kill', async () => {
  const mock = await startMock({ 'POST token': () => json(400, { error: 'invalid_grant' }) });
  try {
    const r = await call(refreshCheck, acct, { mock });
    assert.equal(r.code, 1);
    assert.match(row(r.out, 'Token request (refresh token)').detail, /\[E-70\].*\[E-37\].*\[E-38\]/);
  } finally {
    await mock.close();
  }
});

test('refresh-check --public without the acknowledgement flag refuses with no request', async () => {
  const mock = await startMock();
  try {
    const r = await call(refreshCheck, [...acct, '--public'], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.match(r.err, /--i-understand-this-ends-the-chain/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('refresh-check --public with the flag but no TTY refuses with no request', async () => {
  const mock = await startMock();
  try {
    const r = await call(refreshCheck, [...acct, '--public', '--i-understand-this-ends-the-chain'], { mock, isTTY: false, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.match(r.err, /interactive/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('refresh-check --public with the flag still prompts; a wrong typed account sends nothing', async () => {
  const mock = await startMock();
  try {
    const r = await call(refreshCheck, [...acct, '--public', '--i-understand-this-ends-the-chain'], { mock, isTTY: true, typed: '1234567_sb1' });
    assert.equal(r.code, 2);
    assert.match(r.out, /Type the account ID to confirm/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('refresh-check --public confirmed: refreshes once, never shows the new token, says to re-authorize', async () => {
  const mock = await startMock();
  try {
    const out = path.join(TMP, 'public-refresh.md');
    const r = await call(refreshCheck, [...acct, '--public', '--i-understand-this-ends-the-chain', '--out', out], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(mock.to('token').length, 1);
    assert.equal(new URLSearchParams(mock.to('token')[0].body).get('client_id'), CLIENT_ID);
    assert.equal(row(r.out, 'Refresh token rotation').status, 'pass');
    const life = row(r.out, 'Access token lifetime');
    assert.doesNotMatch(life.detail + life.evidence, /E-29|E-41/);
    assert.match(life.detail, /\[E-25\]/);
    const chain = row(r.out, 'Refresh chain after this test');
    assert.equal(chain.status, 'warn');
    assert.match(chain.detail, /authorize again/);
    assert.match(chain.detail, /\[E-39\]/);
    for (const text of [r.out, r.err, fs.readFileSync(out, 'utf8')]) assert.ok(!text.includes(ROTATED_REFRESH_TOKEN));
  } finally {
    await mock.close();
  }
});

// ---- rotate-cert -----------------------------------------------------------

const addArgs = () => [...acct, 'add', '--cert', CERT_AND_KEY_PATH, '--entity', '42', '--role', '3'];

test('rotate-cert list shows masked IDs and never the entity, application or role', async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, [...acct, 'list'], { mock });
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /FAKE…0001/);
    assert.match(r.out, /FAKE…0002/);
    assert.equal(row(r.out, 'Free certificate slots').status, 'pass');
    for (const s of [CERT_ID, REVOKED_CERT_ID, ENTITY_NAME, 'FAKE_APP', 'FAKE_ROLE']) assert.ok(!r.out.includes(s), s);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add without --confirm refuses with exit 2 and no requests', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, addArgs(), { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.match(r.err, /--confirm/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add refuses an RSA 2048 certificate locally, before the prompt, with no requests', { skip: SKIP_OPENSSL }, async () => {
  const weak = genKey('rsa2048');
  const weakPath = write('weak-2048.pem', makeCert(weak.privateKey).pem);
  const mock = await startMock();
  try {
    const r = await call(rotateCert, [...acct, 'add', '--cert', weakPath, '--entity', '42', '--role', '3', '--confirm'], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 2, r.out + r.err);
    assert.match(r.err, /RSA 2048/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add --confirm without a TTY refuses with no requests', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, [...addArgs(), '--confirm'], { mock, isTTY: false, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add --confirm with a wrong typed account sends nothing', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, [...addArgs(), '--confirm'], { mock, isTTY: true, typed: 'yes' });
    assert.equal(r.code, 2);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add --confirm with the right account sends one POST with the four body keys and no key', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock();
  try {
    const out = path.join(TMP, 'add-report.md');
    const r = await call(rotateCert, [...addArgs(), '--confirm', '--out', out], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 0, r.out + r.err);
    const posts = mock.to('certs').filter((q) => q.method === 'POST');
    assert.equal(posts.length, 1);
    const body = JSON.parse(posts[0].body);
    assert.deepEqual(Object.keys(body).sort(), ['entity', 'fileContent', 'fileName', 'role']);
    assert.equal(body.fileName, 'integration-2027.pem');
    assert.equal(body.entity, 42);
    assert.equal(body.role, 3);
    assert.match(body.fileContent, /^-----BEGIN CERTIFICATE-----/);
    assert.doesNotMatch(body.fileContent, /PRIVATE KEY/);
    assert.equal(row(r.out, 'Add certificate').status, 'pass');
    assert.match(row(r.out, 'Add certificate').detail, /FAKE…0003/);
    assert.equal(row(r.out, 'Added certificate validity').status, 'pass');
    // Ruling R11: the new ID prints in full once, to the terminal only, with the kid instruction.
    assert.match(r.out, new RegExp(`New certificate ID: ${NEW_CERT_ID}\\n.*kid`));
    const file = fs.readFileSync(out, 'utf8');
    assert.ok(!file.includes(NEW_CERT_ID));
    assert.match(file, /FAKE…0003/);
    for (const id of [CERT_ID, REVOKED_CERT_ID]) assert.ok(!r.out.includes(id) && !file.includes(id), id);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add warns when the returned valid_until is earlier than the certificate notAfter', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock({ 'POST certs': (r) => (authed(r) ? json(200, { certificate_id: NEW_CERT_ID, valid_until: '2026-12-01' }) : json(401, {})) });
  try {
    const r = await call(rotateCert, [...addArgs(), '--confirm'], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 0, r.out + r.err);
    const v = row(r.out, 'Added certificate validity');
    assert.equal(v.status, 'warn');
    assert.match(v.detail, /2026-12-01/);
    assert.match(v.detail, new RegExp(CERT_NOT_AFTER));
    assert.match(v.detail, /\[E-49\].*\[E-50\]/);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add refuses a non-numeric --entity or --role with no requests', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock();
  try {
    const bad = [...acct, 'add', '--cert', CERT_AND_KEY_PATH, '--entity', 'jsmith', '--role', '3', '--confirm'];
    const r = await call(rotateCert, bad, { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.match(r.err, /internal ID/);
    const bad2 = [...acct, 'add', '--cert', CERT_AND_KEY_PATH, '--entity', '42', '--role', '3x', '--confirm'];
    assert.equal((await call(rotateCert, bad2, { mock, isTTY: true, typed: ACCOUNT })).code, 2);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert add refuses when five certificates are already active', { skip: SKIP_OPENSSL }, async () => {
  const full = Array.from({ length: 5 }, (_, i) => ({ ...CERT_LIST[0], certificate_id: `FAKE_CERT_ID_full_000${i}` }));
  const mock = await startMock({ 'GET certs': () => json(200, full) });
  try {
    const r = await call(rotateCert, [...addArgs(), '--confirm'], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 1);
    assert.match(row(r.out, 'Free certificate slots').detail, /\[E-51\]/);
    assert.equal(mock.to('certs').filter((q) => q.method === 'POST').length, 0);
  } finally {
    await mock.close();
  }
});

const revokeArgs = [...acct, 'revoke', '--certificate-id', REVOKED_CERT_ID];

test('rotate-cert revoke without --confirm refuses with exit 2 and no requests', async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, revokeArgs, { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert revoke --confirm without a TTY, or with a wrong typed account, sends nothing', async () => {
  const mock = await startMock();
  try {
    assert.equal((await call(rotateCert, [...revokeArgs, '--confirm'], { mock, isTTY: false, typed: ACCOUNT })).code, 2);
    assert.equal((await call(rotateCert, [...revokeArgs, '--confirm'], { mock, isTTY: true, typed: 'no' })).code, 2);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

test('rotate-cert revoke --confirm with the right account sends one revoke POST', async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, [...revokeArgs, '--confirm'], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 0, r.out + r.err);
    const revokes = mock.to('revoke');
    assert.equal(revokes.length, 1);
    assert.equal(revokes[0].method, 'POST');
    assert.ok(revokes[0].path.endsWith(`/certificates/${REVOKED_CERT_ID}/revoke`));
    const rv = row(r.out, 'Revoke certificate');
    assert.equal(rv.status, 'pass');
    assert.match(rv.detail, /Successfully revoked/);
    assert.match(rv.detail, /\[E-61\]/);
  } finally {
    await mock.close();
  }
});

test('rotate-cert revoke of the certificate NS_CERT_ID signs with refuses', async () => {
  const mock = await startMock();
  try {
    const r = await call(rotateCert, [...acct, 'revoke', '--certificate-id', CERT_ID, '--confirm'], { mock, isTTY: true, typed: ACCOUNT });
    assert.equal(r.code, 2);
    assert.match(r.err, /NS_CERT_ID/);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});

// ---- check-assertion -------------------------------------------------------

function assertionFile(name, { alg = 'PS256', kid = CERT_ID, life = 300 } = {}) {
  return write(name, fakeJwt({ typ: 'JWT', alg, kid }, {
    iss: CLIENT_ID, scope: ['rest_webservices'], aud: `https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`,
    iat: NOW_S, exp: NOW_S + life,
  }));
}
const assertionArgs = (file, extra = []) => [...acct, '--assertion', file, ...extra];

test('check-assertion: a well-formed assertion passes', async () => {
  const r = await call(checkAssertion, assertionArgs(assertionFile('ok.jwt')));
  assert.equal(r.code, 0, r.out + r.err);
  for (const t of ['Header typ', 'Signing algorithm', 'Header kid', 'Issuer (iss)', 'Audience (aud)', 'Scope', 'Assertion lifetime']) {
    assert.equal(row(r.out, t).status, 'pass', t);
  }
});

test('check-assertion: exp - iat = 3600 fails "must be under 60 minutes"', async () => {
  const r = await call(checkAssertion, assertionArgs(assertionFile('a3600.jwt', { life: 3600 })));
  assert.equal(r.code, 1);
  const life = row(r.out, 'Assertion lifetime');
  assert.equal(life.status, 'fail');
  assert.match(life.detail, /must be under 60 minutes/);
  assert.match(life.detail, /\[E-53\]/);
});

test('check-assertion: exp - iat = 7200 fails, noting 120 min was observed accepted but not guaranteed', async () => {
  const r = await call(checkAssertion, assertionArgs(assertionFile('a7200.jwt', { life: 7200 })));
  assert.equal(r.code, 1);
  const life = row(r.out, 'Assertion lifetime');
  assert.equal(life.status, 'fail');
  assert.match(life.detail, /must be under 60 minutes/);
  assert.match(life.detail, /120 minutes/);
  assert.match(life.detail, /not guaranteed/);
  assert.match(life.detail, /\[E-54\]/);
});

test('check-assertion: kid different from --kid fails', async () => {
  const r = await call(checkAssertion, assertionArgs(assertionFile('kid.jwt'), ['--kid', REVOKED_CERT_ID]));
  assert.equal(r.code, 1);
  const kid = row(r.out, 'Header kid');
  assert.equal(kid.status, 'fail');
  assert.equal(kid.evidence, '[E-52]');
  assert.ok(!r.out.includes(CERT_ID) && !r.out.includes(REVOKED_CERT_ID));
});

test('check-assertion: alg RS256 fails', async () => {
  const r = await call(checkAssertion, assertionArgs(assertionFile('rs.jwt', { alg: 'RS256' })));
  assert.equal(r.code, 1);
  const alg = row(r.out, 'Signing algorithm');
  assert.equal(alg.status, 'fail');
  assert.match(alg.detail, /RS256/);
  assert.equal(alg.evidence, '[E-44]');
});

test('check-assertion: a file that is not a JWT fails without crashing', async () => {
  const r = await call(checkAssertion, assertionArgs(write('bad.jwt', 'not a jwt')));
  assert.equal(r.code, 1);
  assert.equal(row(r.out, 'Assertion format').status, 'fail');
});

// ---- check-cert and verify -------------------------------------------------

test('check-cert: RSA 3072 certificate with its key passes', { skip: SKIP_OPENSSL }, async () => {
  const r = await call(checkCert, [...acct, '--cert', CERT_PATH]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(row(r.out, 'Private key matches certificate').status, 'pass');
});

test('verify runs check-cert, m2m-check and refresh-check and writes the default report file', { skip: SKIP_OPENSSL }, async () => {
  const mock = await startMock();
  const cwd = fs.mkdtempSync(path.join(TMP, 'verify-'));
  try {
    const r = await call(verify, acct, { mock, cwd });
    assert.equal(r.code, 0, r.out + r.err);
    const file = fs.readFileSync(path.join(cwd, 'tba-to-oauth2-verify-report.md'), 'utf8');
    assert.equal(file, r.out);
    assert.equal(row(r.out, 'check-cert: Key size').status, 'pass');
    assert.equal(row(r.out, 'm2m-check: Token request (client credentials)').status, 'pass');
    assert.equal(row(r.out, 'refresh-check: Refresh token rotation').status, 'pass');
    assert.equal(mock.to('token').length, 2);
  } finally {
    await mock.close();
  }
});

test('verify without NS_REFRESH_TOKEN skips refresh-check', async () => {
  const mock = await startMock();
  try {
    const r = await call(verify, [...acct, '--out', path.join(TMP, 'v2.md')], { mock, env: { NS_REFRESH_TOKEN: '' } });
    assert.equal(row(r.out, 'refresh-check').status, 'skip');
    assert.equal(mock.to('token').length, 1);
  } finally {
    await mock.close();
  }
});

// ---- no leaks ----------------------------------------------------------------

test('no CLI prints or writes a secret, token, key or unmasked client ID', { skip: SKIP_OPENSSL }, async () => {
  const leaky = (r) => ({
    'POST token': () => ({ status: 503, body: `<p>${CLIENT_SECRET} ${REFRESH_TOKEN} ${CLIENT_ID}</p>`, type: 'text/html' }),
    'GET certs': () => json(500, { title: `bad ${CLIENT_ID}`, 'o:errorDetails': [{ detail: `client ${CLIENT_ID}` }] }),
  })[r];
  const runs = [
    [checkCert, [...acct, '--cert', CERT_AND_KEY_PATH], {}],
    [checkAssertion, assertionArgs(assertionFile('leak.jwt')), {}],
    [checkAssertion, assertionArgs(assertionFile('leak2.jwt', { life: 7200, alg: 'RS256' }), ['--kid', REVOKED_CERT_ID]), {}],
    [m2mCheck, acct, {}],
    [m2mCheck, acct, { overrides: { 'POST token': leaky('POST token') } }],
    [m2mCheck, acct, { overrides: { 'GET certs': leaky('GET certs') } }],
    [refreshCheck, acct, {}],
    [refreshCheck, acct, { overrides: { 'POST token': leaky('POST token') } }],
    [refreshCheck, [...acct, '--public', '--i-understand-this-ends-the-chain'], { isTTY: true, typed: ACCOUNT }],
    [rotateCert, [...acct, 'list'], {}],
    [rotateCert, [...addArgs(), '--confirm'], { isTTY: true, typed: ACCOUNT }],
    [rotateCert, [...revokeArgs, '--confirm'], { isTTY: true, typed: ACCOUNT }],
    [verify, acct, {}],
  ];
  const allAssertions = [];
  for (const [i, [run, argv, opts]] of runs.entries()) {
    const mock = await startMock(opts.overrides);
    const out = path.join(TMP, `leak-${i}.md`);
    try {
      const r = await call(run, [...argv, '--out', out], { mock, isTTY: opts.isTTY, typed: opts.typed });
      const texts = { stdout: r.out, stderr: r.err, file: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
      assert.ok(texts.file.length > 0, `run ${i} wrote no --out file`);
      // The assertion this run actually signed and sent.
      const assertions = mock.to('token').map((q) => new URLSearchParams(q.body).get('client_assertion')).filter(Boolean);
      allAssertions.push(...assertions);
      for (const [where, text] of Object.entries(texts)) {
        for (const a of assertions) {
          assert.ok(!text.includes(a), `run ${i} leaked the signed assertion to ${where}`);
          assert.ok(!text.includes(a.split('.')[2]), `run ${i} leaked the assertion signature to ${where}`);
        }
        for (const s of SECRETS) assert.ok(!text.includes(s), `run ${i} leaked ${s.slice(0, 12)}… to ${where}`);
        assert.doesNotMatch(text, /PRIVATE KEY/, `run ${i} printed a key block to ${where}`);
      }
    } finally {
      await mock.close();
    }
  }
  assert.ok(allAssertions.length > 0, 'no run signed an assertion, so the leak checks above compared nothing');
});

// ---- as real processes -----------------------------------------------------

function spawnCli(script, argv, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(DIR, script), ...argv], { env: { PATH: process.env.PATH, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.stdin.end();
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

test('run as a process: m2m-check exits 0; rotate-cert revoke with piped stdin exits 2 with no requests', async () => {
  const mock = await startMock();
  try {
    const ok = await spawnCli('m2m-check.mjs', acct, baseEnv(mock));
    assert.equal(ok.code, 0, ok.out + ok.err);
    assert.match(ok.out, /# m2m-check report/);
    const before = mock.requests.length;
    const refused = await spawnCli('rotate-cert.mjs', [...revokeArgs, '--confirm'], baseEnv(mock));
    assert.equal(refused.code, 2);
    assert.equal(mock.requests.length, before);
  } finally {
    await mock.close();
  }
});

test('every CLI with no arguments or --help prints usage, exits 2 and sends no request', async () => {
  const mock = await startMock();
  try {
    for (const script of ['check-cert', 'check-assertion', 'm2m-check', 'refresh-check', 'rotate-cert', 'verify']) {
      for (const argv of [[], ['--help'], ['-h']]) {
        const r = await spawnCli(`${script}.mjs`, argv, baseEnv(mock));
        assert.equal(r.code, 2, `${script} ${argv.join(' ')}: ${r.out}${r.err}`);
        assert.match(r.err, /usage/i, `${script} ${argv.join(' ')}`);
        assert.doesNotMatch(r.err, /--account is required/);
      }
    }
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
  }
});
