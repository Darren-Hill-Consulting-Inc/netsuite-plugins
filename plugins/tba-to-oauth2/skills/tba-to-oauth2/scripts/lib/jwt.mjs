// Client-assertion JWT signing. Signing logic adapted from the measured working m2m() probe (E-84).
import crypto from 'node:crypto';

export const ALLOWED_ALGS = ['PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'];

const CURVE_FOR_ALG = { ES256: 'prime256v1', ES384: 'secp384r1', ES512: 'secp521r1' };

/** Returns a fixed one-line problem description, or null when the key suits the algorithm. Never includes key material. */
function keyTypeError(privateKeyPem, alg) {
  let key;
  try {
    key = crypto.createPrivateKey(privateKeyPem);
  } catch {
    return `could not sign the assertion with ${alg}: the private key is unreadable or passphrase-encrypted`;
  }
  const type = key.asymmetricKeyType;
  if (type !== 'rsa' && type !== 'ec') return `unsupported private key type "${type}"; NetSuite certificates are RSA or EC [E-46]`;
  if (alg.startsWith('PS') && type !== 'rsa') return `${alg} needs an RSA key but the key is EC; use an ES algorithm`;
  if (alg.startsWith('ES')) {
    if (type !== 'ec') return `${alg} needs an EC key but the key is RSA; use a PS algorithm`;
    if (key.asymmetricKeyDetails?.namedCurve !== CURVE_FOR_ALG[alg]) {
      return `${alg} does not match the key's curve; the algorithm must match the curve [E-45]`;
    }
  }
  return null;
}

const b64url = (v) => Buffer.from(v).toString('base64url');

export function signAssertion({ clientId, certId, privateKeyPem, alg, tokenUrl, scopes, lifetimeSec = 300, now = Date.now() }) {
  if (alg === 'RS256') {
    throw new Error('RS256 was measured rejected by NetSuite with a bare invalid_grant [E-44]; use PS256 or ES256');
  }
  if (!ALLOWED_ALGS.includes(alg)) {
    throw new Error(`unsupported algorithm "${alg}"; NetSuite accepts ${ALLOWED_ALGS.join(', ')} [E-42]`);
  }
  const keyType = keyTypeError(privateKeyPem, alg);
  if (keyType) throw new Error(keyType);
  const iat = Math.floor(now / 1000);
  const header = { typ: 'JWT', alg, kid: certId };
  const payload = { iss: clientId, scope: scopes, aud: tokenUrl, iat, exp: iat + lifetimeSec };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const hash = `sha${alg.slice(2)}`;
  let sig;
  try {
    const opts = alg.startsWith('PS')
      ? { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(alg.slice(2)) / 8 }
      : { key: privateKeyPem, dsaEncoding: 'ieee-p1363' };
    sig = crypto.sign(hash, Buffer.from(signingInput), opts);
  } catch {
    // Never forward the crypto error: it can describe key contents.
    throw new Error(`could not sign the assertion with ${alg}: the private key is unreadable, encrypted, or the wrong type for ${alg}`);
  }
  return `${signingInput}.${b64url(sig)}`;
}

export function decodeJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('not a JWT: expected three dot-separated parts');
  try {
    const part = (i) => JSON.parse(Buffer.from(parts[i], 'base64url').toString('utf8'));
    return { header: part(0), payload: part(1) };
  } catch {
    throw new Error('not a JWT: header or payload is not valid base64url JSON');
  }
}

export function lifetimeOf(token) {
  try {
    const { payload } = decodeJwt(token);
    return Number.isFinite(payload.exp) && Number.isFinite(payload.iat) ? payload.exp - payload.iat : null;
  } catch {
    return null;
  }
}
