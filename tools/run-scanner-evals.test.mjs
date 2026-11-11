import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { accountMismatch, copyFixture, FIXTURES } from './run-scanner-evals.mjs';
import { scoreInventory } from './score-inventory.mjs';

// The inventory a perfect scan would write for this key.
const keyAsInventory = (key) => ({
  integrations: key.integrations.map((k) => ({ ...k, credentialLocations: k.credentials })),
  excluded: key.decoys.map(({ file, line, why }) => ({ file, line, why })),
  outsideRepo: [],
});

const fixtures = fs.readdirSync(FIXTURES).filter((n) => fs.existsSync(path.join(FIXTURES, n, 'ANSWER_KEY.json')));

test('every fixture has an answer key', () => {
  assert.equal(fixtures.length, 10);
});

test('the copied fixture has no ANSWER_KEY.json but keeps everything else', () => {
  for (const name of fixtures) {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-copy-'));
    try {
      copyFixture(path.join(FIXTURES, name), dest);
      const copied = fs.readdirSync(dest, { recursive: true }).map(String);
      assert.ok(!copied.some((p) => path.basename(p) === 'ANSWER_KEY.json'), `${name}: answer key leaked`);
      const source = fs.readdirSync(path.join(FIXTURES, name), { recursive: true }).map(String)
        .filter((p) => path.basename(p) !== 'ANSWER_KEY.json');
      assert.deepEqual(copied.sort(), source.sort(), `${name}: copy differs from the fixture`);
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  }
});

test('each answer key, written as an inventory, scores a pass', () => {
  for (const name of fixtures) {
    const key = JSON.parse(fs.readFileSync(path.join(FIXTURES, name, 'ANSWER_KEY.json'), 'utf8'));
    const r = scoreInventory(keyAsInventory(key), key);
    assert.equal(r.pass, true, `${name}: ${JSON.stringify(r)}`);
  }
});

test('the account guard refuses unless the logged-in account matches', () => {
  const status = JSON.stringify({ loggedIn: true, email: 'dev@example.org', orgName: "dev@example.org's Organization" });
  assert.equal(accountMismatch(status, 'example.org'), null);
  assert.match(accountMismatch(status, undefined), /TBA_EVAL_EXPECT_ACCOUNT is not set/);
  assert.match(accountMismatch(status, ''), /not set/);
  assert.match(accountMismatch(status, 'other.example'), /doesn't match/);
  assert.match(accountMismatch(JSON.stringify({ loggedIn: false }), 'example.org'), /not logged in/);
  assert.match(accountMismatch('not json', 'example.org'), /could not parse/);
});
