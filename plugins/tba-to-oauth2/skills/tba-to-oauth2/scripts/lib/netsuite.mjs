// NetSuite calls used by the CLIs. Request shapes follow the measured probes (E-57, E-58, E-84).
// Results carry status, a printable error and curated data. Raw response text never leaves this module;
// the access token is returned for follow-up calls only and must never be printed.
import fs from 'node:fs';
import { signAssertion, lifetimeOf } from './jwt.mjs';
import { maskId, redact } from './mask.mjs';

const TIMEOUT_MS = 30_000;
const SNIPPET_CHARS = 120;
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

const certsUrl = (cfg) => `${cfg.baseUrl}/services/rest/auth/oauth2/v1/clients/${encodeURIComponent(cfg.clientId)}/certificates`;

/** Redact first, then shorten, so a cut never splits a secret out of the redaction. */
function snippet(text, secrets) {
  const plain = redact(String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), secrets);
  return plain.length > SNIPPET_CHARS ? `${plain.slice(0, SNIPPET_CHARS)}…` : plain;
}

function describe(status, text, body, secrets) {
  if (body === undefined) return text.trim() ? `HTTP ${status}, non-JSON response: ${snippet(text, secrets)}` : `HTTP ${status}, empty response`;
  if (body && typeof body.error === 'string') return `HTTP ${status}, error: ${snippet(body.error, secrets)}`;
  const parts = [body?.title, ...(Array.isArray(body?.['o:errorDetails']) ? body['o:errorDetails'].map((d) => d?.detail) : [])].filter((s) => typeof s === 'string' && s);
  return `HTTP ${status}: ${snippet(parts.length ? parts.join(' — ') : text, secrets)}`;
}

async function send(cfg, { method, url, headers, body, secrets = [] }) {
  const known = [cfg.clientSecret, cfg.refreshToken, cfg.clientId, cfg.certId, ...secrets];
  let res;
  let text;
  try {
    // redirect: 'manual' so a token, secret or assertion is never re-sent to another location.
    res = await fetch(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await res.text();
  } catch (e) {
    const why = e?.name === 'TimeoutError' ? `no response within ${TIMEOUT_MS / 1000} s` : (e?.cause?.code ?? 'request failed');
    return { ok: false, status: 0, error: `network error: ${why}` };
  }
  let parsed;
  try {
    parsed = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  const ok = res.status >= 200 && res.status < 300;
  const r = { ok, status: res.status, body: parsed, text, known };
  if (!ok) {
    r.error = describe(res.status, text, parsed, known);
    if (parsed && typeof parsed.error === 'string') r.oauthError = parsed.error;
  }
  return r;
}

const failure = (r) => ({ ok: false, status: r.status, error: r.error, ...(r.oauthError ? { oauthError: r.oauthError } : {}) });

function tokenResult(r) {
  if (!r.ok) return failure(r);
  const at = r.body?.access_token;
  if (typeof at !== 'string' || !at) {
    return { ok: false, status: r.status, error: r.body === undefined ? describe(r.status, r.text, undefined, r.known) : `HTTP ${r.status}, response has no access_token` };
  }
  const expires = Number(r.body.expires_in);
  return {
    ok: true,
    status: r.status,
    accessToken: at,
    lifetimeSec: lifetimeOf(at) ?? (Number.isFinite(expires) ? expires : null),
    fields: Object.keys(r.body).sort(),
    rotated: typeof r.body.refresh_token === 'string' && r.body.refresh_token.length > 0,
  };
}

/** Client credentials token with a freshly signed assertion (E-84). */
export async function mintM2M(cfg, { now = Date.now() } = {}) {
  if (!cfg.certId || !cfg.privateKeyPath) return { ok: false, status: 0, error: 'NS_CERT_ID and NS_PRIVATE_KEY_PATH must both be set for client credentials' };
  let privateKeyPem;
  try {
    privateKeyPem = fs.readFileSync(cfg.privateKeyPath, 'utf8');
  } catch {
    return { ok: false, status: 0, error: 'could not read the file named by NS_PRIVATE_KEY_PATH' };
  }
  let assertion;
  try {
    assertion = signAssertion({ clientId: cfg.clientId, certId: cfg.certId, privateKeyPem, alg: cfg.alg, tokenUrl: cfg.tokenUrl, scopes: cfg.scopes, now });
  } catch (e) {
    return { ok: false, status: 0, error: redact(e.message, [privateKeyPem]) };
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  }).toString();
  return tokenResult(await send(cfg, { method: 'POST', url: cfg.tokenUrl, headers: FORM, body, secrets: [assertion, privateKeyPem] }));
}

/** Refresh-token grant. The new refresh token, if any, is reported only as `rotated: true`. */
export async function refreshToken(cfg, { publicClient }) {
  if (!cfg.refreshToken) return { ok: false, status: 0, error: 'NS_REFRESH_TOKEN is not set' };
  const params = { grant_type: 'refresh_token', refresh_token: cfg.refreshToken };
  const headers = { ...FORM };
  const secrets = [];
  if (publicClient) params.client_id = cfg.clientId;
  else {
    if (!cfg.clientSecret) return { ok: false, status: 0, error: 'NS_CLIENT_SECRET is not set; a confidential client refresh needs it (use --public for a public client)' };
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
    secrets.push(basic);
  }
  return tokenResult(await send(cfg, { method: 'POST', url: cfg.tokenUrl, headers, body: new URLSearchParams(params).toString(), secrets }));
}

const bearer = (accessToken, extra = {}) => ({ Authorization: `Bearer ${accessToken}`, ...extra });

export async function suiteqlSelect1(cfg, accessToken) {
  const r = await send(cfg, {
    method: 'POST',
    url: `${cfg.baseUrl}/services/rest/query/v1/suiteql`,
    headers: bearer(accessToken, { 'Content-Type': 'application/json', Prefer: 'transient' }),
    body: JSON.stringify({ q: 'SELECT 1 AS ok FROM dual' }),
    secrets: [accessToken],
  });
  if (!r.ok) return failure(r);
  if (!Array.isArray(r.body?.items)) return { ok: false, status: r.status, error: `HTTP ${r.status}, response has no items` };
  return { ok: true, status: r.status, rows: r.body.items.length };
}

const short = (v) => String(v ?? '').slice(0, 40);
const isRevoked = (v) => v === true || v === 'T' || v === 'true';

/** Certificates on the integration record, with IDs masked. Entity, role and application are dropped. */
export async function listCerts(cfg, accessToken) {
  const r = await send(cfg, { method: 'GET', url: certsUrl(cfg), headers: bearer(accessToken), secrets: [accessToken] });
  if (!r.ok) return failure(r);
  const list = Array.isArray(r.body) ? r.body : Array.isArray(r.body?.items) ? r.body.items : null;
  if (!list) return { ok: false, status: r.status, error: r.body === undefined ? describe(r.status, r.text, undefined, r.known) : `HTTP ${r.status}, expected a list of certificates` };
  return {
    ok: true,
    status: r.status,
    certs: list.map((c) => ({
      certificateIdMasked: maskId(String(c?.certificate_id ?? '')),
      algorithm: short(c?.algorithm),
      validFrom: short(c?.valid_from),
      validUntil: short(c?.valid_until),
      revoked: isRevoked(c?.revoked),
    })),
  };
}

/**
 * Add a certificate (body measured in E-58). `entity` and `role` are numbers, as in the measured body.
 * Returns the new certificate ID (an ID, not a credential) and its `valid_until` when the response carries them.
 */
export async function addCert(cfg, accessToken, { fileName, pem, entity, role }) {
  const r = await send(cfg, {
    method: 'POST',
    url: certsUrl(cfg),
    headers: bearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fileName, fileContent: pem, entity, role }),
    secrets: [accessToken],
  });
  if (!r.ok) return failure(r);
  const id = r.body?.certificate_id ?? r.body?.certificateId ?? r.body?.id;
  const until = r.body?.valid_until ?? r.body?.validUntil;
  return {
    ok: true,
    status: r.status,
    ...(id ? { certificateId: String(id), certificateIdMasked: maskId(String(id)) } : {}),
    ...(until ? { validUntil: short(until) } : {}),
  };
}

export async function revokeCert(cfg, accessToken, certificateId) {
  const r = await send(cfg, {
    method: 'POST',
    url: `${certsUrl(cfg)}/${encodeURIComponent(certificateId)}/revoke`,
    headers: bearer(accessToken),
    secrets: [accessToken, certificateId],
  });
  if (!r.ok) return failure(r);
  return { ok: true, status: r.status, message: snippet(r.text, [...r.known, certificateId]) };
}

// Measured causes per error, mirroring references/error-guide.md (ruling R3: hardcoded, not parsed).
const CAUSES = {
  client_credentials: {
    invalid_grant: "Measured causes: an RS256 assertion [E-44]; an algorithm that doesn't match the key's curve, such as ES384 with a P-256 key [E-45]; a kid that belongs to a different mapped certificate [E-52]. Check alg against Oracle's list and the key, then the kid [E-42].",
    invalid_client: 'Measured cause: the assertion was signed with a revoked certificate [E-60]. List the certificates and switch to an active one [E-57].',
    invalid_request: 'Measured cause: assertion exp − iat over 120 minutes [E-54]. Keep it under 60 minutes [E-53].',
  },
  refresh_token: {
    invalid_grant: 'Causes: an expired refresh token (Oracle-documented) [E-70]; reuse of a public refresh token that was already rotated [E-37]; the newest token in a public chain after a reuse [E-38]. After expiry a person must authorize again [E-70]; after a chain kill we infer the same [E-39].',
    invalid_request: 'Measured cause on a public client: a refresh past Maximum time for token rotation, counted from oit [E-40]. Since the cap counts from the first authorization, we infer a person has to authorize again [E-40].',
  },
};

/** The error line plus the measured causes for this grant, when known. */
export function tokenErrorDetail(result, grant) {
  const causes = result.oauthError ? CAUSES[grant]?.[result.oauthError] : undefined;
  return causes ? `${result.error}. ${causes}` : result.error;
}
