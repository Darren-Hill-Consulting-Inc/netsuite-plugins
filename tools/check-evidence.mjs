#!/usr/bin/env node
// Checks the evidence register (references/evidence.md) and every [E-nn]
// citation in the plugin's Markdown:
// - every cited id has exactly one `## E-nn` heading;
// - every entry has a typed `- Type:` line;
// - Measured entries name NetSuite 2026.2 and at least one probe ID (p02, p16d, ...);
// - Oracle quotes appear in the cached Oracle page (tools/.cache/oracle/<page id>.txt),
//   ignoring whitespace runs and curly vs straight quotes.
// Usage: node tools/check-evidence.mjs [--require-cache]   (exit 1 on errors)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = 'plugins/tba-to-oauth2';
const EVIDENCE = `${PLUGIN}/skills/tba-to-oauth2/references/evidence.md`;
const CACHE = 'tools/.cache/oracle';

const HEADING = /^## (E-\d+)\b/;
const CITATION = /\[(E-\d+)\]/g;
const ORACLE_QUOTE = /^Oracle quote — "(.+)" — \[[^\]]+\]\(([^)\s]+)\), fetched \d{4}-\d{2}-\d{2}\s*$/;

export function normalize(text) {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, ' ')
    // The cached pages keep a space where an inline tag ended ("PS256 , PS384 ."), so
    // spacing before punctuation is not significant either.
    .replace(/ ([,.;:)])/g, '$1')
    .trim();
}

function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  // Manual walk rather than readdirSync({ recursive }), so it doesn't depend on the Node version.
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

// Splits evidence.md into entries: {id, line, type}.
function parseEntries(text) {
  const entries = [];
  text.split('\n').forEach((line, i) => {
    const heading = line.match(HEADING);
    if (heading) entries.push({ id: heading[1], line: i + 1, type: null });
    const type = line.match(/^- Type: (.*)$/);
    if (type && entries.length && entries.at(-1).type === null) entries.at(-1).type = type[1].trim();
  });
  return entries;
}

function pageId(url) {
  return path.basename(new URL(url).pathname).replace(/\.html?$/, '');
}

export function checkEvidence({
  root,
  evidencePath = path.join(root, EVIDENCE),
  cacheDir = path.join(root, CACHE),
  scanDir = path.join(root, PLUGIN),
  requireCache = false,
} = {}) {
  const errors = [];
  const warnings = [];
  const rel = (p) => path.relative(root, p) || p;

  if (!fs.existsSync(evidencePath)) {
    return { errors: [`${rel(evidencePath)}: evidence register not found`], warnings };
  }
  const entries = parseEntries(fs.readFileSync(evidencePath, 'utf8'));
  const ids = new Set();
  const pageCache = new Map();

  for (const { id, line, type } of entries) {
    const where = `${rel(evidencePath)}:${line} ${id}`;
    if (ids.has(id)) errors.push(`${where}: duplicate id ${id}`);
    ids.add(id);

    if (!type) {
      errors.push(`${where}: missing "- Type:" line`);
    } else if (type.startsWith('Measured')) {
      if (!type.includes('NetSuite 2026.2')) errors.push(`${where}: Measured entry must name NetSuite 2026.2`);
      if (!/\bp\d+[a-z]?\b/.test(type)) errors.push(`${where}: Measured entry must cite a probe ID (e.g. p02)`);
    } else if (type.startsWith('Oracle quote')) {
      const m = type.match(ORACLE_QUOTE);
      if (!m) {
        errors.push(`${where}: Oracle quote must read: Oracle quote — "<text>" — [<title>](<url>), fetched YYYY-MM-DD`);
        continue;
      }
      const [, quote, url] = m;
      const cacheFile = path.join(cacheDir, `${pageId(url)}.txt`);
      if (!pageCache.has(cacheFile)) {
        pageCache.set(cacheFile, fs.existsSync(cacheFile) ? normalize(fs.readFileSync(cacheFile, 'utf8')) : null);
      }
      const page = pageCache.get(cacheFile);
      if (page === null) {
        const msg = `${where}: no cached page ${rel(cacheFile)}; quote not verified (run node tools/fetch-oracle.mjs)`;
        (requireCache ? errors : warnings).push(msg);
      } else if (!page.includes(normalize(quote))) {
        errors.push(`${where}: quote not found in ${rel(cacheFile)}: "${quote}"`);
      }
    } else if (!type.startsWith('Inference')) {
      errors.push(`${where}: Type must start with Measured, Oracle quote or Inference`);
    }
  }

  const scanned = new Set(markdownFiles(scanDir));
  scanned.add(evidencePath);
  for (const file of scanned) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const [, id] of line.matchAll(CITATION)) {
        if (!ids.has(id)) errors.push(`${rel(file)}:${i + 1}: unresolved citation [${id}]`);
      }
    });
  }

  return { errors, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, warnings } = checkEvidence({ root, requireCache: process.argv.includes('--require-cache') });
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(`check-evidence: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) process.exitCode = 1;
}
