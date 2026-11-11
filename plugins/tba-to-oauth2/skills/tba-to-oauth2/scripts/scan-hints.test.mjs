import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanHints } from './scan-hints.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');
const FIXTURES = path.join(REPO, 'test-repos/tba-to-oauth2');
const PATTERNS = JSON.parse(fs.readFileSync(path.join(HERE, 'scan-patterns.json'), 'utf8'));

const KINDS = ['tba-signing', 'soap-passport', 'soap-tba', 'issuetoken', 'nlauth', 'call-restlet', 'call-rest', 'call-suiteql', 'call-soap', 'library', 'credential', 'oauth2-existing'];
const OUTCOMES = ['auth-code-pkce', 'm2m', 'rewrite-rest', 'already-oauth2'];
// Every planted secret value in the fixtures has one of these shapes.
const SECRET_VALUE = /FAKE_[A-Z0-9_]+|changeme/;

const fixtures = fs.readdirSync(FIXTURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const keyOf = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name, 'ANSWER_KEY.json'), 'utf8'));
const linesOf = (name, file) => fs.readFileSync(path.join(FIXTURES, name, file), 'utf8').split(/\r\n|\r|\n/);

function tmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-hints-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test('the fixture set is the ten fixtures in the brief', () => {
  assert.deepEqual(fixtures, ['ci-nlauth', 'dotnet-soap-tba', 'java-soap-passport', 'mixed-monorepo', 'node-hand-signed', 'node-netsuite-rest-lib', 'php-netsuite-lib', 'python-oauthlib-suiteql', 'python-zeep-soap', 'vendored-noise']);
});

test('scan-patterns.json: unique ids, known kinds, regexes compile, every kind covered', () => {
  const ids = new Set();
  for (const p of PATTERNS) {
    assert.deepEqual(Object.keys(p).sort(), ['flags', 'id', 'kind', 'note', 'regex'], p.id);
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(KINDS.includes(p.kind), `${p.id}: kind ${p.kind}`);
    assert.doesNotThrow(() => new RegExp(p.regex, p.flags), p.id);
    assert.ok(!/[gy]/.test(p.flags), `${p.id}: stateful flags`);
    assert.ok(p.note.length > 10, `${p.id}: note`);
  }
  for (const k of KINDS) assert.ok(PATTERNS.some((p) => p.kind === k), `no pattern for ${k}`);
});

for (const name of fixtures) {
  test(`${name}: answer key is well formed and its lines are right`, () => {
    const key = keyOf(name);
    assert.ok(key.integrations.length > 0);
    for (const it of key.integrations) {
      assert.ok(OUTCOMES.includes(it.outcome), `${it.id}: outcome ${it.outcome}`);
      assert.equal(typeof it.attended, 'boolean');
      assert.ok(it.sites.length > 0, `${it.id}: no sites`);
      for (const s of it.sites) {
        assert.ok(KINDS.includes(s.kind), `${s.file}: kind ${s.kind}`);
        const lines = linesOf(name, s.file);
        assert.ok(s.line >= 1 && s.line <= lines.length && lines[s.line - 1].trim(), `${s.file}:${s.line} is blank or out of range`);
        if (it.outcome === 'already-oauth2') assert.equal(s.kind, 'oauth2-existing');
      }
      for (const c of it.credentials) {
        assert.doesNotMatch(c.name, SECRET_VALUE, 'credential name must be the key, never the value');
        assert.ok(linesOf(name, c.file)[c.line - 1].includes(c.name), `${c.file}:${c.line} does not name ${c.name}`);
      }
    }
    for (const d of key.decoys) {
      assert.ok(d.why.length > 20, `${d.file}:${d.line} needs a why`);
      assert.ok(linesOf(name, d.file)[d.line - 1].trim(), `${d.file}:${d.line} is blank`);
    }
  });

  test(`${name}: every key site and credential has a hit within 2 lines`, () => {
    const { hits } = scanHints(path.join(FIXTURES, name));
    const key = keyOf(name);
    for (const it of key.integrations) {
      for (const want of [...it.sites, ...it.credentials]) {
        const found = hits.some((h) => h.file === want.file && Math.abs(h.line - want.line) <= 2);
        assert.ok(found, `missed ${want.file}:${want.line} (${want.kind ?? want.name})`);
      }
    }
  });

  test(`${name}: output carries locations only, never matched text`, () => {
    const result = scanHints(path.join(FIXTURES, name));
    assert.ok(result.hits.length > 0);
    for (const h of result.hits) {
      assert.deepEqual(Object.keys(h).sort(), ['file', 'kind', 'line', 'patternId']);
      assert.ok(Number.isInteger(h.line) && h.line > 0);
    }
    assert.doesNotMatch(JSON.stringify(result), SECRET_VALUE);
  });
}

test('vendored-noise: node_modules and the generated proxy are skipped, the real call site is found', () => {
  const { hits, skipped } = scanHints(path.join(FIXTURES, 'vendored-noise'));
  assert.ok(skipped.some((s) => s.path === 'node_modules' && s.reason === 'vendored'), JSON.stringify(skipped));
  assert.ok(skipped.some((s) => s.path === 'src/generated/netsuite/NetSuiteService.ts' && s.reason === 'generated'), JSON.stringify(skipped));
  assert.ok(!hits.some((h) => h.file.startsWith('node_modules/') || h.file.includes('generated')));
  assert.ok(hits.some((h) => h.file === 'src/syncVendors.js' && h.kind === 'call-suiteql'));
});

test('dotnet-soap-tba: the <auto-generated> proxy is skipped', () => {
  const { hits, skipped } = scanHints(path.join(FIXTURES, 'dotnet-soap-tba'));
  assert.ok(skipped.some((s) => s.path === 'Connected Services/NetSuiteService/Reference.cs' && s.reason === 'generated'));
  assert.ok(!hits.some((h) => h.file.startsWith('Connected Services/')));
});

test('CRLF .env files report the right line numbers', () => {
  assert.ok(fs.readFileSync(path.join(FIXTURES, 'node-hand-signed/.env'), 'utf8').includes('\r\n'), 'fixture .env lost its CRLF endings');
  const dir = tmpRepo({ '.env': 'APP=1\r\nNS_CONSUMER_KEY=FAKE_CONSUMER_KEY\r\nPORT=80\r\nNS_TOKEN_SECRET=FAKE_TOKEN_SECRET\r\n' });
  try {
    const { hits } = scanHints(dir);
    assert.deepEqual([...new Set(hits.map((h) => h.line))], [2, 4]);
    assert.ok(hits.every((h) => h.file === '.env' && h.kind === 'credential'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('skips vendored and build directories, generated, binary and large files', () => {
  const passport = 'const p = new TokenPassport();\n';
  const dir = tmpRepo({
    'src/app.js': passport,
    'node_modules/x/index.js': passport,
    'vendor/x.php': passport,
    'dist/app.js': passport,
    'build/app.js': passport,
    '.git/hooks/pre-commit': passport,
    'gen/a.cs': `//----\n// <auto-generated>\n${passport}`,
    'gen/b.js': `/**\n * @generated\n */\n${passport}`,
    'gen/c.ts': `// Generated by wsdl-tsclient\n${passport}`,
    'late/marker.js': `1\n2\n3\n4\n5\n// Generated by hand, line 6\n${passport}`,
    'bin/blob.dat': Buffer.concat([Buffer.from(passport), Buffer.from([0, 1, 2])]),
    'big.js': passport + 'x'.repeat(1024 * 1024),
  });
  try {
    const { hits, skipped } = scanHints(dir);
    assert.deepEqual([...new Set(hits.map((h) => h.file))].sort(), ['late/marker.js', 'src/app.js']);
    const reasons = Object.fromEntries(skipped.map((s) => [s.path, s.reason]));
    assert.deepEqual(reasons, {
      'big.js': 'too-large',
      'bin/blob.dat': 'binary',
      build: 'build-output',
      dist: 'build-output',
      'gen/a.cs': 'generated',
      'gen/b.js': 'generated',
      'gen/c.ts': 'generated',
      node_modules: 'vendored',
      vendor: 'vendored',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('caps hits per file and says so', () => {
  const dir = tmpRepo({ 'many.js': Array.from({ length: 30 }, (_, i) => `x${i} = new TokenPassport();`).join('\n') });
  try {
    const capped = scanHints(dir);
    assert.equal(new Set(capped.hits.map((h) => h.line)).size, 20);
    assert.deepEqual(capped.skipped, [{ path: 'many.js', reason: 'hit-cap' }]);
    const five = scanHints(dir, { maxPerFile: 5 });
    assert.deepEqual([...new Set(five.hits.map((h) => h.line))], [1, 2, 3, 4, 5]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI prints the result as JSON', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'scan-hints.mjs'), path.join(FIXTURES, 'ci-nlauth')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.hits.some((h) => h.kind === 'nlauth'));
  assert.ok(Array.isArray(out.skipped));
  assert.doesNotMatch(r.stdout, SECRET_VALUE);
});

test('CLI without a root prints usage and exits 2', () => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'scan-hints.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/i);
});
