#!/usr/bin/env node
// Builds the leak-scan deny-list from the private probe kit, which is never published.
// Writes one value per line to <out> and prints only the entry count.
//
// Usage: node tools/build-denylist.mjs <kitDir> <out>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const list = (dir) => { try { return fs.readdirSync(dir); } catch { return []; } };

export function buildDenylist(kitDir) {
  const out = new Set();
  const add = (v) => { if (v && String(v).trim()) out.add(String(v).trim()); };

  // Client IDs (and secrets, belt and braces) from secrets/clients.json.
  try {
    const clients = JSON.parse(read(path.join(kitDir, 'secrets', 'clients.json')) || '{}');
    for (const c of Object.values(clients)) { add(c.id); add(c.secret); }
  } catch { /* missing or malformed: skipped */ }

  // Certificate IDs from secrets/certs/*.kid.
  const certDir = path.join(kitDir, 'secrets', 'certs');
  for (const f of list(certDir)) if (f.endsWith('.kid')) add(read(path.join(certDir, f)));

  const results = read(path.join(kitDir, 'results', 'RESULTS.md'));
  // Account IDs, all cases.
  for (const m of results.matchAll(/\bTSTDRV\d+\b/gi)) { add(m[0]); add(m[0].toLowerCase()); }
  // Certificate ID prefix/suffix pairs written as `AbCdEfGh…WxYz`.
  for (const m of results.matchAll(/`([A-Za-z0-9_-]{6,10})…([A-Za-z0-9_-]{3,6})`/g)) { add(m[1]); add(m[2].length >= 4 ? m[2] : ''); }
  // Integration record names and script IDs.
  // Full record names, captured from the "Integration record(s)" lines: `id <n> "<name>"`.
  for (const line of results.split('\n')) {
    if (!/integration records?/i.test(line)) continue;
    for (const m of line.matchAll(/id \d+ "([^"]+)"/g)) add(m[1]);
  }
  for (const m of results.matchAll(/\bcustinteg_[a-z0-9_]+\b/g)) add(m[0]);
  // Employee/entity name and the numeric record, entity and role IDs used in the probes.
  for (const m of results.matchAll(/user ([A-Z][a-z]+ [A-Z]\.? [A-Z][a-z]+)/g)) add(m[1]);
  for (const m of results.matchAll(/integration records?:? id (\d+)/gi)) add(m[1]);
  for (const m of results.matchAll(/\bid (\d{3,})\b/g)) add(m[1]);
  for (const m of results.matchAll(/"entity":(\d+)/g)) add(m[1]);
  for (const m of results.matchAll(/application_id:(\d+)/g)) add(m[1]);

  // Emails and IPs from raw exports.
  const rawDir = path.join(kitDir, 'results', 'raw');
  for (const f of list(rawDir)) {
    const text = read(path.join(rawDir, f));
    for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) add(m[0]);
    for (const m of text.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) add(m[0]);
  }
  return [...out];
}

function main(argv) {
  const [kitDir, outFile] = argv;
  if (!kitDir || !outFile) { console.error('usage: build-denylist.mjs <kitDir> <out>'); return 2; }
  const entries = buildDenylist(path.resolve(kitDir));
  fs.writeFileSync(outFile, entries.join('\n') + '\n', { mode: 0o600 });
  console.log(`build-denylist: ${entries.length} entries written`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
