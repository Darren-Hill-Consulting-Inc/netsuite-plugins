#!/usr/bin/env node
// Usage: node check-assertion.mjs --account <id> --assertion <file> [--kid <certificate id>] [--out <file>]
// Decodes a client-credentials assertion JWT from a file and checks its header and claims against
// Oracle's documented structure. Doesn't verify the signature and makes no network calls.
import fs from 'node:fs';
import path from 'node:path';
import { ALLOWED_ALGS, decodeJwt } from './lib/jwt.mjs';
import { maskId } from './lib/mask.mjs';
import { chk, runCli, runIfMain } from './lib/cli.mjs';

const SCOPES = ['restlets', 'rest_webservices', 'suite_analytics'];

function algCheck(alg) {
  const title = 'Signing algorithm';
  if (alg === 'RS256') return chk('alg', title, 'fail', 'RS256 was measured rejected with a bare invalid_grant; use PS256 for RSA or ES256 for EC', 'E-44');
  if (!ALLOWED_ALGS.includes(alg)) return chk('alg', title, 'fail', `"${String(alg).slice(0, 10)}" is not one of ${ALLOWED_ALGS.join(', ')}`, 'E-42');
  return chk('alg', title, 'pass', `${alg} is on Oracle's list`, 'E-42');
}

function kidCheck(kid, expected) {
  const title = 'Header kid';
  if (typeof kid !== 'string' || !kid) return chk('kid', title, 'fail', 'no kid; it must be the Certificate ID from the client credentials mapping', 'E-78');
  if (!expected) return chk('kid', title, 'warn', `kid ${maskId(kid)} present; pass --kid or set NS_CERT_ID to compare it`, 'E-78');
  if (kid !== expected) {
    return chk('kid', title, 'fail', `kid ${maskId(kid)} is not the expected ${maskId(expected)}; a kid from a different mapped certificate returned invalid_grant`, 'E-52');
  }
  return chk('kid', title, 'pass', `kid matches ${maskId(expected)}`, 'E-78');
}

function lifetimeCheck(iat, exp) {
  const title = 'Assertion lifetime';
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return chk('lifetime', title, 'fail', 'iat and exp must be whole Unix times in seconds [E-82], [E-83]');
  const life = exp - iat;
  const mins = `${life} s (${(life / 60).toFixed(1).replace(/\.0$/, '')} min)`;
  if (life <= 0) return chk('lifetime', title, 'fail', `exp − iat is ${mins}; exp must be after iat [E-83]`);
  if (life < 3600) return chk('lifetime', title, 'pass', `exp − iat ${mins}, under 60 minutes`, 'E-53');
  if (life <= 7200) {
    return chk('lifetime', title, 'fail', `exp − iat ${mins}; must be under 60 minutes [E-53]. Up to 120 minutes was observed accepted in one test account, but that is not guaranteed and may change in any release [E-54]`);
  }
  return chk('lifetime', title, 'fail', `exp − iat ${mins}; must be under 60 minutes [E-53]. Over 120 minutes was measured rejected with invalid_request [E-54]`);
}

export function collect(s, cfg) {
  const file = s.flag('--assertion');
  if (!file) return [chk('format', 'Assertion format', 'fail', 'pass --assertion <file> holding the JWT (not on the command line, where it lands in shell history)')];
  let token;
  try {
    token = fs.readFileSync(path.resolve(s.cwd, file), 'utf8').trim();
  } catch {
    return [chk('format', 'Assertion format', 'fail', 'could not read the assertion file')];
  }
  s.secret(token);
  let header;
  let payload;
  try {
    ({ header, payload } = decodeJwt(token));
  } catch (e) {
    return [chk('format', 'Assertion format', 'fail', e.message)];
  }
  const expectedKid = s.flag('--kid') ?? cfg.certId;
  s.id(expectedKid, header.kid, payload.iss);
  const scopes = Array.isArray(payload.scope) ? payload.scope : typeof payload.scope === 'string' ? payload.scope.split(/[\s,]+/).filter(Boolean) : [];
  const checks = [
    chk('format', 'Assertion format', 'pass', 'three-part JWT with JSON header and payload'),
    header.typ === 'JWT' ? chk('typ', 'Header typ', 'pass', 'JWT', 'E-77') : chk('typ', 'Header typ', 'fail', 'typ must be JWT', 'E-77'),
    algCheck(header.alg),
    kidCheck(header.kid, expectedKid),
    payload.iss === cfg.clientId
      ? chk('iss', 'Issuer (iss)', 'pass', `iss is the client ID ${maskId(cfg.clientId)}`, 'E-79')
      : chk('iss', 'Issuer (iss)', 'fail', `iss must be the integration's client ID ${maskId(cfg.clientId)}`, 'E-79'),
    payload.aud === cfg.tokenUrl || payload.aud === `https://${cfg.host}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`
      ? chk('aud', 'Audience (aud)', 'pass', 'aud is the token endpoint', 'E-81')
      : chk('aud', 'Audience (aud)', 'fail', `aud must be the token endpoint, https://${cfg.host}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token [E-81], [E-84]`),
    scopes.length && scopes.every((x) => SCOPES.includes(x))
      ? chk('scope', 'Scope', 'pass', `${scopes.join(', ')}${Array.isArray(payload.scope) ? ' (JSON array, the measured form [E-84])' : ''}`, 'E-80')
      : chk('scope', 'Scope', 'fail', `scope must be one or more of ${SCOPES.join(', ')}`, 'E-80'),
    lifetimeCheck(payload.iat, payload.exp),
  ];
  if (Number.isInteger(payload.exp) && payload.exp * 1000 < s.now) {
    checks.push(chk('expired', 'Assertion not expired', 'warn', 'exp is in the past, so this assertion has expired. We recommend signing a fresh one for every token request'));
  }
  return checks;
}

export function run(opts = {}) {
  return runCli({ usageFile: import.meta.url, ...opts }, async (s) => {
    const cfg = s.load();
    if (!cfg) return 2;
    return s.finish('check-assertion', cfg, collect(s, cfg));
  });
}

runIfMain(import.meta.url, run);
