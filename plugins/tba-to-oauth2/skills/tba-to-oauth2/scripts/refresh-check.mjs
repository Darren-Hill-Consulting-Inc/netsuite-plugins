#!/usr/bin/env node
// Usage: node refresh-check.mjs --account <id> [--out <file>]
//        node refresh-check.mjs --account <id> --public --i-understand-this-ends-the-chain [--out <file>]
// Refreshes NS_REFRESH_TOKEN once and checks the result. A confidential client (default) needs
// NS_CLIENT_SECRET; its refresh token isn't replaced [E-32]. A public client's refresh rotates the token
// [E-36]; this script never prints or saves the new one, so the chain is used up for your app.
import { refreshToken, suiteqlSelect1, tokenErrorDetail } from './lib/netsuite.mjs';
import { chk, lifetimeCheck, runCli, runIfMain } from './lib/cli.mjs';

const ACK = '--i-understand-this-ends-the-chain';
const REFRESH = 'Token request (refresh token)';
const ROTATION = 'Refresh token rotation';
const SELECT1 = 'REST SuiteQL SELECT 1';

export async function collect(s, cfg, { publicClient = false } = {}) {
  const t = await refreshToken(cfg, { publicClient });
  const chain = publicClient
    ? [chk('chain', 'Refresh chain after this test', 'warn', `This test sent the refresh token in NS_REFRESH_TOKEN and discarded the new one. Sending the old one again fails and ends the whole chain [E-37], [E-38]. We infer the chain is now used up for your app: authorize again to get a working refresh token [E-39].`)]
    : [];
  if (!t.ok) {
    const none = 'skipped: no access token';
    return [
      chk('refresh', REFRESH, 'fail', tokenErrorDetail(t, 'refresh_token')),
      chk('lifetime', 'Access token lifetime', 'skip', none),
      chk('rotation', ROTATION, 'skip', none),
      chk('select1', SELECT1, 'skip', none),
      ...(t.status ? chain : []),
    ];
  }
  s.secret(t.accessToken);
  const checks = [
    chk('refresh', REFRESH, 'pass', `HTTP ${t.status}; fields: ${t.fields.join(', ')}`, publicClient ? 'E-36' : 'E-32'),
    // Access token lifetime was measured for confidential clients [E-29] and client credentials [E-41], not public clients.
    lifetimeCheck(t.lifetimeSec, publicClient ? null : 'E-29'),
  ];
  if (publicClient) {
    checks.push(t.rotated
      ? chk('rotation', ROTATION, 'pass', 'refresh token rotated, as measured for public clients; the new one was not printed or saved', 'E-36')
      : chk('rotation', ROTATION, 'warn', 'no new refresh token, unlike the measured public client', 'E-36'));
  } else {
    checks.push(t.rotated
      ? chk('rotation', ROTATION, 'warn', 'NetSuite returned a new refresh token, unlike the measured confidential client; it was not printed or saved', 'E-32')
      : chk('rotation', ROTATION, 'pass', 'refresh token not rotated (expected for confidential clients)', 'E-32'));
  }
  const q = await suiteqlSelect1(cfg, t.accessToken);
  checks.push(q.ok ? chk('select1', SELECT1, 'pass', `HTTP ${q.status}; the token runs a query`) : chk('select1', SELECT1, 'fail', q.error));
  return [...checks, ...chain];
}

export function run(opts = {}) {
  return runCli(opts, async (s) => {
    const cfg = s.load();
    if (!cfg) return 2;
    const publicClient = s.has('--public');
    if (publicClient) {
      if (!s.has(ACK)) {
        return s.refuse(`a public client's refresh rotates the token, and this script won't save the new one, so your app's refresh chain ends [E-36], [E-37]. Run again with --public ${ACK} if that is acceptable`);
      }
      const ok = await s.confirmChange(cfg, 'refresh the public client refresh token once; the chain ends for your app', ACK);
      if (!ok) return 2;
    }
    return s.finish('refresh-check', cfg, await collect(s, cfg, { publicClient }));
  });
}

runIfMain(import.meta.url, run);
