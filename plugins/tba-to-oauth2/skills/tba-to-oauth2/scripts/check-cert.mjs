#!/usr/bin/env node
// Usage: node check-cert.mjs --account <id> [--cert <file>] [--out <file>]
// Checks the certificate (NS_CERT_PATH or --cert) against NetSuite's rules, and against the key in
// NS_PRIVATE_KEY_PATH when set. No network calls.
import fs from 'node:fs';
import path from 'node:path';
import { inspectCert } from './lib/certs.mjs';
import { chk, runCli, runIfMain } from './lib/cli.mjs';

export function collect(s, cfg) {
  const certPath = s.flag('--cert') ?? cfg.certPath;
  if (!certPath) return [chk('input-format', 'Certificate file format', 'fail', 'no certificate: pass --cert <file> or set NS_CERT_PATH')];
  let buf;
  try {
    buf = fs.readFileSync(path.resolve(s.cwd, certPath));
  } catch {
    return [chk('input-format', 'Certificate file format', 'fail', 'could not read the certificate file')];
  }
  s.secret(...(buf.toString('latin1').match(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g) ?? []));
  let privateKeyPem;
  if (cfg.privateKeyPath) {
    try {
      privateKeyPem = fs.readFileSync(path.resolve(s.cwd, cfg.privateKeyPath), 'utf8');
      s.secret(privateKeyPem);
    } catch {
      return [...inspectCert(buf, { alg: cfg.alg, now: s.now }).filter((c) => c.id !== 'key-match'),
        chk('key-match', 'Private key matches certificate', 'fail', 'could not read the file named by NS_PRIVATE_KEY_PATH')];
    }
  }
  return inspectCert(buf, { alg: cfg.alg, privateKeyPem, now: s.now });
}

export function run(opts = {}) {
  return runCli({ usageFile: import.meta.url, ...opts }, async (s) => {
    const cfg = s.load();
    if (!cfg) return 2;
    return s.finish('check-cert', cfg, collect(s, cfg));
  });
}

runIfMain(import.meta.url, run);
