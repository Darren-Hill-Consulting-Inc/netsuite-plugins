#!/usr/bin/env node
// Usage: node m2m-check.mjs --account <id> [--out <file>]
// Mints a client credentials token, checks its lifetime, runs a REST SuiteQL SELECT 1 and lists the
// integration's certificates. Read-only: changes nothing in the account.
import { listCerts, mintM2M, suiteqlSelect1, tokenErrorDetail } from './lib/netsuite.mjs';
import { chk, lifetimeCheck, runCli, runIfMain } from './lib/cli.mjs';

const MINT = 'Token request (client credentials)';
const SELECT1 = 'REST SuiteQL SELECT 1';
const LIST = 'List certificates';
export const MAX_ACTIVE = 5;

export async function collect(s, cfg) {
  const t = await mintM2M(cfg, { now: s.now });
  if (!t.ok) {
    const none = 'skipped: no access token';
    return [
      chk('mint', MINT, 'fail', tokenErrorDetail(t, 'client_credentials')),
      chk('lifetime', 'Access token lifetime', 'skip', none),
      chk('select1', SELECT1, 'skip', none),
      chk('list-certs', LIST, 'skip', none),
    ];
  }
  s.secret(t.accessToken);
  const checks = [
    chk('mint', MINT, 'pass', `HTTP ${t.status}; fields: ${t.fields.join(', ')}${t.rotated ? '' : '; no refresh token, as measured'}`, 'E-41'),
    lifetimeCheck(t.lifetimeSec, 'E-41'),
  ];
  const q = await suiteqlSelect1(cfg, t.accessToken);
  checks.push(q.ok ? chk('select1', SELECT1, 'pass', `HTTP ${q.status}; the token runs a query`) : chk('select1', SELECT1, 'fail', q.error));
  const l = await listCerts(cfg, t.accessToken);
  if (!l.ok) checks.push(chk('list-certs', LIST, 'fail', l.error, 'E-57'));
  else {
    const active = l.certs.filter((c) => !c.revoked).length;
    checks.push(active >= MAX_ACTIVE
      ? chk('list-certs', LIST, 'warn', `${l.certs.length} certificates, ${active} active: no free slot. Five active is the limit; revoke one before rotating [E-51], [E-62]`)
      : chk('list-certs', LIST, 'pass', `${l.certs.length} certificates, ${active} active`, 'E-57'));
  }
  return checks;
}

export function run(opts = {}) {
  return runCli(opts, async (s) => {
    const cfg = s.load();
    if (!cfg) return 2;
    return s.finish('m2m-check', cfg, await collect(s, cfg));
  });
}

runIfMain(import.meta.url, run);
