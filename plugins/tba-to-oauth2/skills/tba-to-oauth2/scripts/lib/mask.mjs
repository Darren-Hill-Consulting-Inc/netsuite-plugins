// Masking and redaction helpers. Nothing that looks like a secret should reach output.

/** `abcd…wxyz`, or `****` for anything shorter than 10 characters. */
export function maskId(s) {
  if (typeof s !== 'string' || s.length < 10) return '****';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

const PEM_BLOCK = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?(?:-----END [A-Z0-9 ]+-----|$)/g;
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

/** Replace known secrets, JWT-shaped strings and PEM blocks with `<redacted>`. */
export function redact(text, secrets = []) {
  let out = String(text).replace(PEM_BLOCK, '<redacted>').replace(JWT_SHAPE, '<redacted>');
  const list = secrets.filter((s) => typeof s === 'string' && s.length > 0).sort((a, b) => b.length - a.length);
  for (const s of list) out = out.split(s).join('<redacted>');
  return out;
}
