#!/usr/bin/env node
// Leak scan: finds deny-listed values and secret-shaped strings in the working tree and,
// with --history, in every added line of every commit. Prints locations and the deny-list
// entry index or rule name only, never the matched value.
//
// Usage: node tools/leak-scan.mjs --deny <file> [--history] [--root <dir>] [--allow <file>]
// The allow-list defaults to tools/leak-scan-allow.txt.
// Exit: 0 clean, 1 findings, 2 usage error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RULES = [
  { rule: 'jwt', re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/ },
  { rule: 'pem-private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: 'account-id', re: /\bTSTDRV\d{3,}\b/i },
  { rule: 'ipv4', re: /\b(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/ },
  // Reserved documentation domains (RFC 2606/6761) are allowed, including subdomains.
  { rule: 'email', re: /\b[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*\bexample\.(?:com|org|net)\b)(?![A-Za-z0-9.-]+\.(?:test|example|invalid)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
];

// Short numeric deny entries (record, entity, role IDs) only count next to an ID-ish word.
const SHORT_NUMERIC = /^\d{1,6}$/;
const idContext = (n) => new RegExp(`\\b(?:id|entity|integration|role|application(?:_id)?)\\b\\W{0,6}${n}\\b`, 'i');

export function compileDenylist(entries) {
  return entries
    .map((v, i) => ({ v: String(v).trim(), i }))
    .filter(({ v }) => v.length > 0)
    .map(({ v, i }) => {
      if (SHORT_NUMERIC.test(v)) return { index: i, test: (line) => idContext(v).test(line) };
      const needle = v.toLowerCase();
      return { index: i, test: (line) => line.toLowerCase().includes(needle) };
    });
}

function scanLine(line, deny, allowedRules) {
  const hits = [];
  for (const d of deny) if (d.test(line)) hits.push({ entryIndex: d.index });
  for (const r of RULES) if (r.re.test(line) && !allowedRules.has(r.rule)) hits.push({ rule: r.rule });
  return hits;
}

// Allow-list: `<path>\t<rule>` lines. Only generic rules can be allowed, for reviewed files
// that hold fake secret-shaped test data. Deny-list hits are never allowed.
export function parseAllow(text) {
  const map = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [file, rule] = line.split(/\s+/);
    if (!RULES.some((r) => r.rule === rule)) throw new Error(`allow-list: unknown rule ${rule}`);
    if (!map.has(file)) map.set(file, new Set());
    map.get(file).add(rule);
  }
  return map;
}
const NONE = new Set();

const isBinary = (buf) => buf.subarray(0, 8000).includes(0);

export function leakScan({ root, denylist, history = false, allow = new Map() }) {
  const deny = compileDenylist(denylist);
  const findings = [];
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 30 });

  const files = git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  for (const rel of files) {
    const abs = path.join(root, rel);
    let buf;
    try { buf = fs.readFileSync(abs); } catch { continue; }
    if (isBinary(buf)) continue;
    buf.toString('utf8').split(/\r?\n/).forEach((line, n) => {
      for (const h of scanLine(line, deny, allow.get(rel) ?? NONE)) findings.push({ where: rel, line: n + 1, ...h });
    });
  }

  if (history) {
    // Diff content only (no commit messages or author metadata), every commit on every ref.
    const out = git(['log', '-p', '--all', '--no-color', '--format=commit %H']);
    let commit = '', file = '', line = 0;
    for (const l of out.split('\n')) {
      if (l.startsWith('commit ')) { commit = l.slice(7, 14); continue; }
      if (l.startsWith('+++ ')) { file = l.replace(/^\+\+\+ (b\/)?/, ''); continue; }
      const m = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
      if (m) { line = Number(m[1]); continue; }
      if (l.startsWith('+')) {
        for (const h of scanLine(l.slice(1), deny, allow.get(file) ?? NONE)) findings.push({ where: `history:${commit}:${file}`, line, ...h });
        line++;
      } else if (!l.startsWith('-')) line++;
    }
  }
  return findings;
}

export function authorEmails(root) {
  const out = execFileSync('git', ['-C', root, 'log', '--all', '--format=%ae%n%ce'], { encoding: 'utf8' });
  return [...new Set(out.split('\n').filter(Boolean))].sort();
}

function main(argv) {
  const opt = { history: false, root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--deny') opt.deny = argv[++i];
    else if (argv[i] === '--history') opt.history = true;
    else if (argv[i] === '--root') opt.root = path.resolve(argv[++i]);
    else if (argv[i] === '--allow') opt.allow = argv[++i];
    else { console.error(`unknown argument: ${argv[i]}`); return 2; }
  }
  if (!opt.deny || !fs.existsSync(opt.deny)) { console.error('usage: leak-scan.mjs --deny <file> [--history] [--root <dir>]'); return 2; }
  const denylist = fs.readFileSync(opt.deny, 'utf8').split('\n');
  const allowFile = opt.allow ?? path.join(opt.root, 'tools', 'leak-scan-allow.txt');
  const allow = fs.existsSync(allowFile) ? parseAllow(fs.readFileSync(allowFile, 'utf8')) : new Map();
  const findings = leakScan({ root: opt.root, denylist, history: opt.history, allow });
  for (const f of findings) console.log(`${f.where}:${f.line}  ${f.rule ? `rule=${f.rule}` : `deny-entry=#${f.entryIndex}`}`);
  console.log(`leak-scan: ${findings.length} finding(s), ${denylist.filter((v) => v.trim()).length} deny-list entries, history=${opt.history}`);
  // Commit identities are public once pushed; listed for the owner to review, not scored.
  console.log(`info: commit author/committer emails: ${authorEmails(opt.root).join(', ')}`);
  return findings.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
