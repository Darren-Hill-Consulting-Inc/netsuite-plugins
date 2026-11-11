// Test-time fixtures: keys via node:crypto, certificates via openssl. Nothing is committed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const hasOpenssl = spawnSync('openssl', ['version']).status === 0;
export const SKIP_OPENSSL = hasOpenssl ? false : 'openssl not available';

export function genKey(kind) {
  if (kind === 'rsa2048') return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  if (kind === 'rsa3072') return crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  if (kind === 'p256') return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  if (kind === 'p384') return crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  throw new Error(`unknown key kind ${kind}`);
}

export const pem = (key, type = 'pkcs8') => key.export({ type, format: 'pem' });

/** Build a self-signed certificate with openssl. Returns {pem: string, der: Buffer}. */
export function makeCert(privateKey, { days = 365, notBefore, notAfter } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tba-fixture-'));
  try {
    const keyFile = path.join(dir, 'k.pem');
    const certFile = path.join(dir, 'c.pem');
    fs.writeFileSync(keyFile, pem(privateKey), { mode: 0o600 });
    const args = ['req', '-x509', '-new', '-key', keyFile, '-subj', '/CN=test', '-out', certFile];
    if (notBefore && notAfter) args.push('-not_before', notBefore, '-not_after', notAfter);
    else args.push('-days', String(days));
    const r = spawnSync('openssl', args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`openssl failed: ${r.stderr.split('\n')[0]}`);
    const certPem = fs.readFileSync(certFile, 'utf8');
    return { pem: certPem, der: new crypto.X509Certificate(certPem).raw };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
