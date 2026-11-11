#!/usr/bin/env node
// Fetches the Oracle Help Center pages listed in oracle-pages.json and caches
// them as plain text under tools/.cache/oracle/ (gitignored), so
// check-evidence.mjs can verify Oracle quotes offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pages = JSON.parse(fs.readFileSync(path.join(here, 'oracle-pages.json'), 'utf8'));
const cacheDir = path.join(here, '.cache', 'oracle');
const USER_AGENT = 'Mozilla/5.0 (compatible; doc-fetch/1.0)';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const fetchedPath = path.join(cacheDir, 'fetched.json');
  const fetched = fs.existsSync(fetchedPath) ? JSON.parse(fs.readFileSync(fetchedPath, 'utf8')) : {};
  let failures = 0;
  for (const { id, url } of pages) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(path.join(cacheDir, `${id}.txt`), htmlToText(await res.text()) + '\n');
      fetched[id] = new Date().toISOString().slice(0, 10);
      console.log(`ok   ${id}`);
    } catch (err) {
      failures++;
      console.error(`fail ${id}: ${err.message}`);
    }
  }
  fs.writeFileSync(fetchedPath, JSON.stringify(fetched, null, 2) + '\n');
  if (failures) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
