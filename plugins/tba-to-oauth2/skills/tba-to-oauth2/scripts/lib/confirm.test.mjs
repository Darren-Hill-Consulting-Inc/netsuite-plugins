import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { confirmAccountChange } from './confirm.mjs';

async function run(typed) {
  const input = new PassThrough();
  const output = new PassThrough();
  let out = '';
  output.on('data', (d) => (out += d));
  const p = confirmAccountChange({ accountId: '1234567_SB1', action: 'Add certificate', input, output });
  input.write(`${typed}\n`);
  return { ok: await p, out };
}

test('wrong value returns false', async () => {
  const r = await run('yes');
  assert.equal(r.ok, false);
  assert.match(r.out, /Add certificate/);
});
test('case-different value returns false', async () => assert.equal((await run('1234567_sb1')).ok, false));
test('leading space fails', async () => assert.equal((await run(' 1234567_SB1')).ok, false));
test('exact match returns true', async () => assert.equal((await run('1234567_SB1')).ok, true));
test('closed input returns false', async () => {
  const input = new PassThrough();
  const p = confirmAccountChange({ accountId: 'X', action: 'a', input, output: new PassThrough() });
  input.end();
  assert.equal(await p, false);
});
