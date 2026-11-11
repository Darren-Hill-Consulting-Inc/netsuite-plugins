// Certificate checks for a client-credentials mapping. No network; never prints key material.
import crypto from 'node:crypto';

const CURVE_FOR_ALG = { ES256: 'prime256v1', ES384: 'secp384r1', ES512: 'secp521r1' };
const CURVE_LABEL = { prime256v1: 'P-256', secp384r1: 'P-384', secp521r1: 'P-521' };
const DAY = 86400e3;
const CERT_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

const chk = (id, title, status, detail, evidence) => ({ id, title, status, detail, ...(evidence ? { evidence } : {}) });

function parseInput(buf) {
  const text = buf.toString('latin1');
  const blocks = text.match(CERT_BLOCK);
  if (blocks) {
    try {
      const cert = new crypto.X509Certificate(blocks[0]);
      const hasKey = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(text);
      const parts = [blocks.length > 1 ? `PEM, first of ${blocks.length} certificates used` : 'PEM, one certificate'];
      if (hasKey) parts.push('a private key block is also in this file and was ignored');
      return { cert, detail: parts.join('; ') };
    } catch {
      return { error: 'a PEM certificate block is present but could not be parsed' };
    }
  }
  try {
    return { cert: new crypto.X509Certificate(buf), detail: 'DER certificate' };
  } catch {
    return { error: 'not a certificate: expected PEM (BEGIN CERTIFICATE) or DER' };
  }
}

function keyMatch(cert, privateKeyPem) {
  const title = 'Private key matches certificate';
  const pemText = Buffer.isBuffer(privateKeyPem) ? privateKeyPem.toString('latin1') : String(privateKeyPem);
  if (/ENCRYPTED/.test(pemText)) {
    return chk('key-match', title, 'fail', 'private key is passphrase-encrypted; decrypt it first (for example with openssl) and try again');
  }
  let key;
  try {
    key = crypto.createPrivateKey(pemText);
  } catch {
    return chk('key-match', title, 'fail', 'private key could not be read; expected unencrypted PKCS#1, PKCS#8 or SEC1 PEM');
  }
  return cert.checkPrivateKey(key)
    ? chk('key-match', title, 'pass', 'private key matches the certificate')
    : chk('key-match', title, 'fail', 'key does not match certificate');
}

/** @returns {import('./report.mjs').Check[]} */
export function inspectCert(buf, { alg, privateKeyPem, now = Date.now() } = {}) {
  const parsed = parseInput(buf);
  if (parsed.error) return [chk('input-format', 'Certificate file format', 'fail', parsed.error)];
  const { cert } = parsed;
  const checks = [chk('input-format', 'Certificate file format', 'pass', parsed.detail)];
  const pub = cert.publicKey;
  const type = pub.asymmetricKeyType;
  const d = pub.asymmetricKeyDetails ?? {};

  // Key size
  if (type === 'rsa') {
    const bits = d.modulusLength;
    checks.push(bits === 3072 || bits === 4096
      ? chk('bit-length', 'Key size', 'pass', `RSA ${bits} bits`, 'E-46')
      : chk('bit-length', 'Key size', 'fail', `RSA ${bits} bits; NetSuite requires 3072 or 4096 and rejects other sizes at upload`, bits === 2048 ? 'E-47' : 'E-46'));
  } else if (type === 'ec') {
    const label = CURVE_LABEL[d.namedCurve];
    checks.push(label
      ? chk('bit-length', 'Key size', 'pass', `EC ${label}`, 'E-46')
      : chk('bit-length', 'Key size', 'fail', `EC curve ${d.namedCurve} is not one of P-256, P-384, P-521`, 'E-46'));
  } else {
    checks.push(chk('bit-length', 'Key size', 'fail', `key type ${type} is not RSA or EC`, 'E-46'));
  }

  // Curve (EC only)
  if (type === 'ec') {
    const label = CURVE_LABEL[d.namedCurve];
    const want = CURVE_FOR_ALG[alg];
    if (!label) checks.push(chk('curve', 'EC curve', 'fail', `curve ${d.namedCurve} is unsupported`, 'E-46'));
    else if (want && want !== d.namedCurve) {
      checks.push(chk('curve', 'EC curve', 'fail', `curve ${label} does not match ${alg}; the algorithm must match the key's curve`, 'E-45'));
    } else if (!want) checks.push(chk('curve', 'EC curve', 'skip', `curve ${label}; ${alg} is not an ES algorithm`));
    else checks.push(chk('curve', 'EC curve', 'pass', d.namedCurve === 'prime256v1' ? `${label} matches ${alg}` : `${label} matches ${alg}; listed by Oracle, not measured`, d.namedCurve === 'prime256v1' ? 'E-48' : 'E-46'));
  } else {
    checks.push(chk('curve', 'EC curve', 'skip', 'not an EC key'));
  }

  // Algorithm vs key type
  const title = 'Signing algorithm fits the key';
  if (/^RS/.test(alg ?? '')) checks.push(chk('alg-match', title, 'fail', `${alg} is rejected by NetSuite; use PS256 for RSA or ES256 for EC`, 'E-44'));
  else if (type === 'rsa') {
    checks.push(/^PS(256|384|512)$/.test(alg ?? '')
      ? chk('alg-match', title, 'pass', `${alg} suits an RSA key`, 'E-43')
      : chk('alg-match', title, 'fail', `${alg} does not suit an RSA key; use PS256, PS384 or PS512`, 'E-42'));
  } else if (type === 'ec') {
    checks.push(CURVE_FOR_ALG[alg]
      ? chk('alg-match', title, 'pass', `${alg} suits an EC key`, 'E-42')
      : chk('alg-match', title, 'fail', `${alg} does not suit an EC key; use ES256, ES384 or ES512`, 'E-42'));
  } else checks.push(chk('alg-match', title, 'skip', 'key type not supported'));

  // Validity window
  const from = new Date(cert.validFrom).getTime();
  const to = new Date(cert.validTo).getTime();
  if (now < from) checks.push(chk('validity', 'Certificate is currently valid', 'fail', `not valid until ${new Date(from).toISOString().slice(0, 10)}`));
  else if (now > to) checks.push(chk('validity', 'Certificate is currently valid', 'fail', `expired ${new Date(to).toISOString().slice(0, 10)}`));
  else checks.push(chk('validity', 'Certificate is currently valid', 'pass', `valid until ${new Date(to).toISOString().slice(0, 10)}`));

  // Validity span
  const years = (to - from) / (365 * DAY);
  checks.push((to - from) > 731 * DAY
    ? chk('validity-span', 'Validity within two years', 'warn', `valid for ${years.toFixed(1)} years; NetSuite silently shortens anything over two years to two years, so plan rotation from the shortened date`, 'E-49')
    : chk('validity-span', 'Validity within two years', 'pass', `valid for ${years.toFixed(1)} years`, 'E-49'));

  checks.push(privateKeyPem ? keyMatch(cert, privateKeyPem) : chk('key-match', 'Private key matches certificate', 'skip', 'no private key supplied'));
  return checks;
}
