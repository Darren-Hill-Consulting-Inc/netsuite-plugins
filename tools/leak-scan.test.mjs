import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leakScan, parseAllow } from './leak-scan.mjs';
import { buildDenylist } from './build-denylist.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLANTED = 'PLANTEDVALUE7f3q';

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-'));
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  const commit = (file, text, msg) => { fs.writeFileSync(path.join(dir, file), text); git('add', file); git('commit', '-q', '-m', msg); };
  return { dir, commit, git };
}

test('a planted deny-list value is reported by index, and the CLI never prints the value', () => {
  const r = repo();
  r.commit('a.md', `hello\nclient ${PLANTED} here\n`, 'add');
  const f = leakScan({ root: r.dir, denylist: ['unused', PLANTED], history: false });
  assert.deepEqual(f, [{ where: 'a.md', line: 2, entryIndex: 1 }]);
  const deny = path.join(r.dir, '..', `deny-${path.basename(r.dir)}`);
  fs.writeFileSync(deny, `unused\n${PLANTED}\n`);
  const out = spawnSync(process.execPath, [path.join(HERE, 'leak-scan.mjs'), '--deny', deny, '--root', r.dir], { encoding: 'utf8' });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /a\.md:2 {2}deny-entry=#1/);
  assert.ok(!out.stdout.includes(PLANTED) && !out.stderr.includes(PLANTED));
});

test('a value only in an old commit is found with history, not without', () => {
  const r = repo();
  r.commit('a.md', `x ${PLANTED}\n`, 'one');
  r.commit('a.md', 'clean\n', 'two');
  assert.deepEqual(leakScan({ root: r.dir, denylist: [PLANTED] }), []);
  const h = leakScan({ root: r.dir, denylist: [PLANTED], history: true });
  assert.equal(h.length, 1);
  assert.match(h[0].where, /^history:[0-9a-f]{7}:a\.md$/);
  assert.equal(h[0].line, 1);
});

test('generic rules: JWT, PEM private key, account ID, IP, email (example.com allowed)', () => {
  const r = repo();
  const jwt = 'eyJhbGciOiJQUzI1NiJ9.eyJpc3MiOiJhYmNkZWYifQ.c2ln';
  r.commit('b.txt', [jwt, '-----BEGIN PRIVATE KEY-----', 'acct TSTDRV1234567', 'host 10.20.30.40', 'mail a.person@realcorp.ca', 'ok dev@example.com', 'ok u@db.internal.example.com', 'ok j@corp.test', 'ok 127.0.0.1'].join('\n') + '\n', 'b');
  const rules = leakScan({ root: r.dir, denylist: [] }).map((f) => `${f.line}:${f.rule}`);
  assert.deepEqual(rules, ['1:jwt', '2:pem-private-key', '3:account-id', '4:ipv4', '5:email']);
});

test('short numeric entries only match next to an ID word', () => {
  const r = repo();
  r.commit('c.json', '{"entity": 4242}\nport 4242 open\n', 'c');
  const f = leakScan({ root: r.dir, denylist: ['4242'] });
  assert.deepEqual(f.map((x) => x.line), [1]);
});

test('clean repo has no findings', () => {
  const r = repo();
  r.commit('d.md', '# fine\n', 'd');
  assert.deepEqual(leakScan({ root: r.dir, denylist: [PLANTED], history: true }), []);
});

test('buildDenylist reads a kit layout without printing', () => {
  const kit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'));
  fs.mkdirSync(path.join(kit, 'secrets', 'certs'), { recursive: true });
  fs.mkdirSync(path.join(kit, 'results', 'raw'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'secrets', 'clients.json'), JSON.stringify({ m2m: { id: 'CLIENTID_FAKE_123' } }));
  fs.writeFileSync(path.join(kit, 'secrets', 'certs', 'a.kid'), 'CERTID_FAKE_456\n');
  fs.writeFileSync(path.join(kit, 'results', 'RESULTS.md'), 'Account TSTDRV999 user Jane Q Public, cert `AbCdEfGh…WxYz`, "entity":4242, script `custinteg_abc123`\nIntegration records: id 7 "Fake Probe Record - public" (public); id 8 "Fake Probe Record - M2M".\n');
  fs.writeFileSync(path.join(kit, 'results', 'raw', 'x.csv'), 'jane@corp.test,10.1.2.3\n');
  const d = buildDenylist(kit);
  for (const v of ['CLIENTID_FAKE_123', 'CERTID_FAKE_456', 'TSTDRV999', 'tstdrv999', 'Jane Q Public', 'AbCdEfGh', 'WxYz', '4242', 'custinteg_abc123', 'Fake Probe Record - public', 'Fake Probe Record - M2M', 'jane@corp.test', '10.1.2.3']) {
    assert.ok(d.includes(v), `missing ${v}`);
  }
});

test('allow-list suppresses only the listed generic rule for the listed file, never deny-list hits', () => {
  const r = repo();
  r.commit('t.test.mjs', `const k = '-----BEGIN PRIVATE KEY-----';\nconst v = '${PLANTED}';\nmail x@realcorp.ca\n`, 't');
  const allow = parseAllow('t.test.mjs pem-private-key  # fake test key\n');
  const f = leakScan({ root: r.dir, denylist: [PLANTED], allow });
  assert.deepEqual(f.map((x) => x.rule ?? `#${x.entryIndex}`), ['#0', 'email']);
  assert.throws(() => parseAllow('t.test.mjs nonsense'), /unknown rule/);
});
