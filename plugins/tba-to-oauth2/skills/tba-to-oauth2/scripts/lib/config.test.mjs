import test from 'node:test';
import assert from 'node:assert/strict';
import { accountHost, loadConfig, ConfigError } from './config.mjs';

const env = { NS_ACCOUNT_ID: '1234567_SB1', NS_CLIENT_ID: 'FAKE_CONSUMER_KEY' };

test('accountHost maps sandbox and lowercases', () => {
  assert.equal(accountHost('1234567_SB1'), '1234567-sb1');
  assert.equal(accountHost('TSTDRV1'), 'tstdrv1');
});

test('sandbox account yields the sandbox suitetalk host', () => {
  const c = loadConfig({ argv: ['--account', '1234567_SB1'], env });
  assert.equal(c.host, '1234567-sb1');
  assert.equal(c.baseUrl, 'https://1234567-sb1.suitetalk.api.netsuite.com');
  assert.equal(c.tokenUrl, 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token');
});

test('defaults and optional fields', () => {
  const c = loadConfig({ argv: ['--account=1234567_sb1'], env: { ...env, NS_SCOPES: 'rest_webservices, restlets' } });
  assert.equal(c.alg, 'PS256');
  assert.deepEqual(c.scopes, ['rest_webservices', 'restlets']);
  assert.equal(c.certId, undefined);
  assert.equal(c.accountId, '1234567_SB1');
});

test('throws on missing --account', () => {
  assert.throws(() => loadConfig({ argv: [], env }), (e) => e instanceof ConfigError && !e.message.includes('\n'));
});

test('throws on account mismatch', () => {
  assert.throws(() => loadConfig({ argv: ['--account', 'OTHER'], env }), ConfigError);
});

test('throws when NS_ACCOUNT_ID or NS_CLIENT_ID is missing', () => {
  assert.throws(() => loadConfig({ argv: ['--account', 'X'], env: { NS_CLIENT_ID: 'a' } }), ConfigError);
  assert.throws(() => loadConfig({ argv: ['--account', '1234567_SB1'], env: { NS_ACCOUNT_ID: '1234567_SB1' } }), ConfigError);
});

test('rejects an account id that could alter the host', () => {
  const e = { NS_ACCOUNT_ID: 'evil.example/x', NS_CLIENT_ID: 'a' };
  assert.throws(() => loadConfig({ argv: ['--account', 'evil.example/x'], env: e }), ConfigError);
});

test('NS_BASE_URL: rejects non-local hosts, accepts 127.0.0.1', () => {
  assert.throws(() => loadConfig({ argv: ['--account', '1234567_SB1'], env: { ...env, NS_BASE_URL: 'https://evil.example' } }), ConfigError);
  assert.throws(() => loadConfig({ argv: ['--account', '1234567_SB1'], env: { ...env, NS_BASE_URL: 'not a url' } }), ConfigError);
  const c = loadConfig({ argv: ['--account', '1234567_SB1'], env: { ...env, NS_BASE_URL: 'http://127.0.0.1:9999' } });
  assert.equal(c.baseUrl, 'http://127.0.0.1:9999');
  assert.equal(c.tokenUrl, 'http://127.0.0.1:9999/services/rest/auth/oauth2/v1/token');
});

test('rejects RS256 and unknown algorithms, citing evidence', () => {
  assert.throws(() => loadConfig({ argv: ['--account', '1234567_SB1'], env: { ...env, NS_ALG: 'RS256' } }), /E-44/);
  assert.throws(() => loadConfig({ argv: ['--account', '1234567_SB1'], env: { ...env, NS_ALG: 'HS256' } }), ConfigError);
});
