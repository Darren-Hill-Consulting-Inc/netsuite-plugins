#!/usr/bin/env node
// Usage: node verify.mjs --account <id> [--out <file>]
// Runs check-cert, m2m-check and, when NS_REFRESH_TOKEN is set, the confidential refresh-check, and writes
// one combined report (default tba-to-oauth2-verify-report.md). Never runs the public refresh, which
// ends the chain; run refresh-check --public on its own for that.
import { collect as certChecks } from './check-cert.mjs';
import { collect as m2mChecks } from './m2m-check.mjs';
import { collect as refreshChecks } from './refresh-check.mjs';
import { chk, prefixed, runCli, runIfMain } from './lib/cli.mjs';

export const DEFAULT_OUT = 'tba-to-oauth2-verify-report.md';

export function run(opts = {}) {
  return runCli(opts, async (s) => {
    const cfg = s.load();
    if (!cfg) return 2;
    const checks = [];
    checks.push(...(cfg.certPath ? prefixed('check-cert', certChecks(s, cfg)) : [chk('check-cert', 'check-cert', 'skip', 'NS_CERT_PATH not set')]));
    checks.push(...(cfg.certId && cfg.privateKeyPath
      ? prefixed('m2m-check', await m2mChecks(s, cfg))
      : [chk('m2m-check', 'm2m-check', 'skip', 'NS_CERT_ID and NS_PRIVATE_KEY_PATH not both set')]));
    if (!cfg.refreshToken) checks.push(chk('refresh-check', 'refresh-check', 'skip', 'NS_REFRESH_TOKEN not set'));
    else if (!cfg.clientSecret) {
      checks.push(chk('refresh-check', 'refresh-check', 'skip', 'NS_CLIENT_SECRET not set. For a public client, run refresh-check --public on its own; it ends the refresh chain'));
    } else checks.push(...prefixed('refresh-check', await refreshChecks(s, cfg, { publicClient: false })));
    return s.finish('verify', cfg, checks, { defaultOut: DEFAULT_OUT });
  });
}

runIfMain(import.meta.url, run);
