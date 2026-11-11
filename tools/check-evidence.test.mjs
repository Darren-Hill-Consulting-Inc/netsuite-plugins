import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkEvidence } from './check-evidence.mjs';

const EVIDENCE = 'plugins/tba-to-oauth2/skills/tba-to-oauth2/references/evidence.md';
const CACHE = 'tools/.cache/oracle';
const URL = 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158081952044.html';
const PAGE_TEXT = 'Step Two. The access token is valid for 60 minutes. The refresh token is valid for seven days. More text.';

// Builds a temp repo root holding the given files ({relativePath: content}).
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-evidence-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

const quoteEntry = (id, quote) =>
  `## ${id} Refresh token lifetime\n- Type: Oracle quote — "${quote}" — [Step Two](${URL}), fetched 2026-11-11\n- Finding: The documented default.\n`;
const measuredEntry = (id, type) => `## ${id} A measured thing\n- Type: ${type}\n- Finding: It happened.\n`;
const cache = { [`${CACHE}/section_158081952044.txt`]: PAGE_TEXT, [`${CACHE}/fetched.json`]: '{}' };

test('unresolved citation', () => {
  const root = fixture({
    [EVIDENCE]: measuredEntry('E-01', 'Measured — NetSuite 2026.2, test account, November 2026 — p02'),
    'plugins/tba-to-oauth2/skills/tba-to-oauth2/references/tokens.md': 'Seven days by default [E-01], not [E-99].\n',
  });
  const { errors } = checkEvidence({ root });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /E-99/);
  assert.match(errors[0], /tokens\.md/);
});

test('quote not in page', () => {
  const root = fixture({ [EVIDENCE]: quoteEntry('E-01', 'The refresh token is valid for thirty days.'), ...cache });
  const { errors } = checkEvidence({ root });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /E-01/);
  assert.match(errors[0], /not found/);
});

test('quote whitespace-insensitive', () => {
  const root = fixture({
    [EVIDENCE]: quoteEntry('E-01', 'The  refresh token is\tvalid for seven days.'),
    [`${CACHE}/section_158081952044.txt`]: 'The refresh\n  token is valid for seven\u00a0days.',
  });
  const curly = fixture({
    [EVIDENCE]: quoteEntry('E-01', 'The "refresh" token is valid for seven days. It\'s fine.'),
    [`${CACHE}/section_158081952044.txt`]: 'The “refresh” token is valid for seven days. It’s fine.',
  });
  const tagGap = fixture({
    [EVIDENCE]: quoteEntry('E-01', 'The value of the alg parameter is PS256, PS384, or ES512.'),
    [`${CACHE}/section_158081952044.txt`]: 'The value of the alg parameter is PS256 , PS384 , or ES512 . Next.',
  });
  assert.deepEqual(checkEvidence({ root }).errors, []);
  assert.deepEqual(checkEvidence({ root: curly }).errors, []);
  assert.deepEqual(checkEvidence({ root: tagGap }).errors, []);
});

test('measured needs probe and release', () => {
  const ok = fixture({ [EVIDENCE]: measuredEntry('E-01', 'Measured — NetSuite 2026.2, test account, November 2026 — p16d') });
  const noProbe = fixture({ [EVIDENCE]: measuredEntry('E-01', 'Measured — NetSuite 2026.2, test account, November 2026') });
  const noRelease = fixture({ [EVIDENCE]: measuredEntry('E-01', 'Measured — test account, November 2026 — p02') });
  assert.deepEqual(checkEvidence({ root: ok }).errors, []);
  assert.match(checkEvidence({ root: noProbe }).errors.join('\n'), /E-01.*probe/);
  assert.match(checkEvidence({ root: noRelease }).errors.join('\n'), /E-01.*NetSuite 2026\.2/);
});

test('missing cache', () => {
  const root = fixture({ [EVIDENCE]: quoteEntry('E-01', 'The refresh token is valid for seven days.') });
  const lax = checkEvidence({ root });
  assert.deepEqual(lax.errors, []);
  assert.equal(lax.warnings.length, 1);
  assert.match(lax.warnings[0], /E-01/);
  const strict = checkEvidence({ root, requireCache: true });
  assert.equal(strict.errors.length, 1);
  assert.match(strict.errors[0], /E-01/);
});

test('duplicate id', () => {
  const type = 'Measured — NetSuite 2026.2, test account, November 2026 — p02';
  const root = fixture({ [EVIDENCE]: measuredEntry('E-03', type) + '\n' + measuredEntry('E-03', type) });
  const { errors } = checkEvidence({ root });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /duplicate.*E-03/i);
});

test('paths are overridable', () => {
  const root = fixture({
    'elsewhere/ev.md': quoteEntry('E-01', 'The refresh token is valid for seven days.'),
    'pages/section_158081952044.txt': PAGE_TEXT,
  });
  const result = checkEvidence({
    root,
    evidencePath: path.join(root, 'elsewhere/ev.md'),
    cacheDir: path.join(root, 'pages'),
    scanDir: path.join(root, 'elsewhere'),
    requireCache: true,
  });
  assert.deepEqual(result, { errors: [], warnings: [] });
});
