#!/usr/bin/env node
// Usage:
//   node rotate-cert.mjs --account <id> list
//   node rotate-cert.mjs --account <id> add --cert <pem> --entity <id> --role <id> --confirm
//   node rotate-cert.mjs --account <id> revoke --certificate-id <id> --confirm
// Uses the certificate rotation endpoint with a client credentials token [E-57]. add and revoke change
// the account: they need --confirm and the account ID typed at an interactive prompt.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { addCert, listCerts, mintM2M, revokeCert, tokenErrorDetail } from './lib/netsuite.mjs';
import { maskId, redact } from './lib/mask.mjs';
import { inspectCert } from './lib/certs.mjs';
import { chk, runCli, runIfMain } from './lib/cli.mjs';
import { MAX_ACTIVE } from './m2m-check.mjs';

const MINT = 'Token request (client credentials)';
const SLOTS = 'Free certificate slots';
const DAY = 86400e3;
const USAGE = 'usage: rotate-cert.mjs --account <id> list | add --cert <pem> --entity <id> --role <id> --confirm | revoke --certificate-id <id> --confirm';

async function token(s, cfg, checks) {
  const t = await mintM2M(cfg, { now: s.now });
  if (!t.ok) {
    checks.push(chk('mint', MINT, 'fail', tokenErrorDetail(t, 'client_credentials')));
    return null;
  }
  s.secret(t.accessToken);
  checks.push(chk('mint', MINT, 'pass', `HTTP ${t.status}`, 'E-41'));
  return t.accessToken;
}

function certRow(c, now) {
  const title = `Certificate ${c.certificateIdMasked}`;
  const span = `${c.algorithm}, valid ${c.validFrom} to ${c.validUntil}`;
  if (c.revoked) return chk(`cert-${c.certificateIdMasked}`, title, 'skip', `revoked; ${span}`);
  const until = Date.parse(c.validUntil);
  if (Number.isFinite(until) && until < now) return chk(`cert-${c.certificateIdMasked}`, title, 'warn', `active but expired; ${span}. Revoke it to free the slot`);
  if (Number.isFinite(until) && until - now < 30 * DAY) return chk(`cert-${c.certificateIdMasked}`, title, 'warn', `active, expires within 30 days; ${span}. Rotate now`);
  return chk(`cert-${c.certificateIdMasked}`, title, 'pass', `active; ${span}`);
}

/** Lists certificates into `checks`; returns the active count, or null if listing failed. */
async function list(s, cfg, at, checks) {
  const l = await listCerts(cfg, at);
  if (!l.ok) {
    checks.push(chk('list', 'List certificates', 'fail', l.error, 'E-57'));
    return null;
  }
  checks.push(...l.certs.map((c) => certRow(c, s.now)));
  const active = l.certs.filter((c) => !c.revoked).length;
  checks.push(active >= MAX_ACTIVE
    ? chk('slots', SLOTS, 'warn', `${active} of ${MAX_ACTIVE} active: no free slot. Revoke one before adding; an add is likely to fail [E-51], [E-62]`)
    : chk('slots', SLOTS, 'pass', `${active} of ${MAX_ACTIVE} active; ${MAX_ACTIVE - active} free`, 'E-51'));
  return active;
}

/** The first certificate block of a PEM file. A private key in the same file is never sent. */
function readCertificate(s, file) {
  let text;
  try {
    text = fs.readFileSync(path.resolve(s.cwd, file), 'latin1');
  } catch {
    return { error: 'could not read the --cert file' };
  }
  s.secret(...(text.match(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g) ?? []));
  const block = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0];
  if (!block) return { error: '--cert must be a PEM file with a BEGIN CERTIFICATE block' };
  let notAfter;
  try {
    notAfter = new Date(new crypto.X509Certificate(block).validTo);
  } catch {
    return { error: 'the certificate block in --cert could not be parsed' };
  }
  return { pem: `${block}\n`, fileName: path.basename(file), notAfter };
}

const day = (d) => d.toISOString().slice(0, 10);

/** Compare the validity NetSuite returned with the certificate's own notAfter (two-year cap: E-49, E-50). */
function validityCheck(validUntil, notAfter) {
  const title = 'Added certificate validity';
  if (!validUntil) return chk('validity', title, 'warn', 'the response had no valid_until; check it with rotate-cert list [E-57]');
  const until = Date.parse(validUntil);
  if (!Number.isFinite(until)) return chk('validity', title, 'warn', `valid_until "${validUntil}" could not be read as a date; compare it with the certificate's notAfter ${day(notAfter)}`);
  if (until < notAfter.getTime() - DAY) {
    return chk('validity', title, 'warn', `valid_until ${validUntil} is earlier than the certificate's notAfter ${day(notAfter)}. NetSuite shortens certificates longer than two years [E-49], and does so silently [E-50]; plan rotation from ${validUntil}`);
  }
  return chk('validity', title, 'pass', `valid_until ${validUntil} matches the certificate's notAfter ${day(notAfter)}`, 'E-57');
}

async function add(s, cfg) {
  const file = s.flag('--cert');
  const entity = s.flag('--entity');
  const role = s.flag('--role');
  if (!file || !entity || !role) return s.refuse(`add needs --cert, --entity and --role. ${USAGE}`);
  // The measured working body sent entity and role as JSON numbers [E-58].
  if (!/^\d+$/.test(entity) || !/^\d+$/.test(role)) return s.refuse('--entity and --role must each be a numeric internal ID');
  const cert = readCertificate(s, file);
  if (cert.error) return s.refuse(cert.error);
  // Local pre-flight, nothing sent: refuse a certificate NetSuite would reject (for example RSA 2048 [E-47]).
  // The signing algorithm and key pairing aren't known here, so those two checks are left to check-cert.
  const bad = inspectCert(Buffer.from(cert.pem)).filter((c) => c.status === 'fail' && c.id !== 'alg-match' && c.id !== 'key-match');
  if (bad.length) return s.refuse(`the certificate would not be accepted: ${bad.map((c) => `${c.title}: ${c.detail}`).join('; ')}. Run check-cert for the full report; nothing was sent`);
  if (!(await s.confirmChange(cfg, `add certificate ${cert.fileName} to the integration's client credentials mapping`))) return 2;

  const checks = [];
  let newId;
  const at = await token(s, cfg, checks);
  if (at) {
    const active = await list(s, cfg, at, checks);
    if (active !== null && active >= MAX_ACTIVE) {
      checks.find((c) => c.id === 'slots').status = 'fail';
      checks.push(chk('add', 'Add certificate', 'skip', 'not sent: no free slot'));
    } else if (active !== null) {
      const r = await addCert(cfg, at, { fileName: cert.fileName, pem: cert.pem, entity: Number(entity), role: Number(role) });
      if (r.ok) {
        newId = r.certificateId;
        checks.push(chk('add', 'Add certificate', 'pass', `HTTP ${r.status}; new certificate ID ${r.certificateIdMasked ?? '(not in the response; it is on the integration\'s client credentials mapping [E-78])'}. Switch the integration to the new key and use that ID as kid [E-59], then revoke the old certificate [E-60]`));
        checks.push(validityCheck(r.validUntil, cert.notAfter));
      } else {
        checks.push(chk('add', 'Add certificate', 'fail', `${r.error}${r.status === 500 ? '. A wrong request body returned HTTP 500 [E-58]' : ''}`));
      }
    }
  }
  const code = s.finish('rotate-cert add', cfg, checks);
  // Ruling R11: the new ID prints in full once, to the terminal only; the report and --out keep it masked.
  if (newId) s.stdout.write(redact(`\nNew certificate ID: ${newId}\nUse it as the assertion's kid once the integration signs with the new key [E-59].\n`, s.secrets));
  return code;
}

async function revoke(s, cfg) {
  const id = s.flag('--certificate-id');
  if (!id) return s.refuse(`revoke needs --certificate-id. ${USAGE}`);
  s.id(id);
  if (id === cfg.certId) {
    return s.refuse('that is the certificate NS_CERT_ID signs with. Switch NS_CERT_ID and NS_PRIVATE_KEY_PATH to the new certificate first [E-59]');
  }
  if (!(await s.confirmChange(cfg, `revoke certificate ${maskId(id)}`))) return 2;
  const checks = [];
  const at = await token(s, cfg, checks);
  if (at) {
    const r = await revokeCert(cfg, at, id);
    checks.push(r.ok
      ? chk('revoke', 'Revoke certificate', 'pass', `HTTP ${r.status}: ${r.message}. New assertions signed with it get invalid_client [E-60]; tokens already issued may run out their 60 minutes [E-61]`)
      : chk('revoke', 'Revoke certificate', 'fail', r.error));
  }
  return s.finish('rotate-cert revoke', cfg, checks);
}

export function run(opts = {}) {
  return runCli({ usageFile: import.meta.url, ...opts }, async (s) => {
    const cfg = s.load();
    if (!cfg) return 2;
    const cmd = s.argv.find((a) => ['list', 'add', 'revoke'].includes(a));
    if (cmd === 'add') return add(s, cfg);
    if (cmd === 'revoke') return revoke(s, cfg);
    if (cmd !== 'list') return s.refuse(USAGE);
    const checks = [];
    const at = await token(s, cfg, checks);
    if (at) await list(s, cfg, at, checks);
    return s.finish('rotate-cert list', cfg, checks);
  });
}

runIfMain(import.meta.url, run);
