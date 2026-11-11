import test from 'node:test';
import assert from 'node:assert/strict';
import { maskId, redact } from './mask.mjs';

test('maskId', () => {
  assert.equal(maskId('abcdefghijklmnop'), 'abcd…mnop');
  assert.equal(maskId('short'), '****');
  assert.equal(maskId(''), '****');
  assert.equal(maskId(undefined), '****');
});

test('redact removes secrets, JWTs and PEM blocks', () => {
  const jwt = 'eyJhbGciOiJQUzI1NiJ9.eyJpc3MiOiJ4In0.c2lnbmF0dXJl';
  const pemBlock = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\nabc\n-----END RSA PRIVATE KEY-----';
  const text = `secret=hunter2hunter2 token ${jwt} key ${pemBlock} end`;
  const out = redact(text, ['hunter2hunter2', '', undefined]);
  assert.ok(!out.includes('hunter2'));
  assert.ok(!out.includes('eyJ'));
  assert.ok(!out.includes('MIIB'));
  assert.ok(!out.includes('PRIVATE KEY'));
  assert.equal((out.match(/<redacted>/g) || []).length, 3);
});

test('redact handles regex metacharacters in secrets', () => {
  assert.equal(redact('a.b*c(d)', ['.b*c(']), 'a<redacted>d)');
});
