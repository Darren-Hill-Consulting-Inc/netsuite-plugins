import { ALLOWED_ALGS } from './jwt.mjs';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** `1234567_SB1` -> `1234567-sb1`. Behaviour of this code, not a documented NetSuite rule. */
export function accountHost(accountId) {
  return String(accountId).toLowerCase().replace(/_/g, '-');
}

function argValue(argv, name) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) return argv[i + 1];
    if (argv[i].startsWith(`${name}=`)) return argv[i].slice(name.length + 1);
  }
  return undefined;
}

export function loadConfig({ argv, env }) {
  const flag = argValue(argv, '--account');
  if (!flag || flag.startsWith('--')) throw new ConfigError('--account is required: name the account this run may touch');
  const accountId = env.NS_ACCOUNT_ID;
  if (!accountId) throw new ConfigError('NS_ACCOUNT_ID is not set');
  if (flag.toLowerCase() !== accountId.toLowerCase()) {
    throw new ConfigError('--account does not match NS_ACCOUNT_ID; refusing to run against an unconfirmed account');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(accountId)) throw new ConfigError('NS_ACCOUNT_ID may contain only letters, digits, "_" and "-"');
  if (!env.NS_CLIENT_ID) throw new ConfigError('NS_CLIENT_ID is not set');

  const alg = env.NS_ALG || 'PS256';
  if (alg === 'RS256') throw new ConfigError('NS_ALG RS256 was measured rejected by NetSuite [E-44]; use PS256 or ES256');
  if (!ALLOWED_ALGS.includes(alg)) throw new ConfigError(`NS_ALG must be one of ${ALLOWED_ALGS.join(', ')} [E-42]`);

  const host = accountHost(accountId);
  let baseUrl = `https://${host}.suitetalk.api.netsuite.com`;
  if (env.NS_BASE_URL) {
    let u;
    try {
      u = new URL(env.NS_BASE_URL);
    } catch {
      throw new ConfigError('NS_BASE_URL is not a valid URL');
    }
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      throw new ConfigError('NS_BASE_URL is accepted only for localhost or 127.0.0.1');
    }
    baseUrl = u.origin;
  }

  const scopes = (env.NS_SCOPES || 'rest_webservices').split(/[\s,]+/).filter(Boolean);
  const config = {
    accountId,
    host,
    baseUrl,
    tokenUrl: `${baseUrl}/services/rest/auth/oauth2/v1/token`,
    clientId: env.NS_CLIENT_ID,
    alg,
    scopes,
  };
  const optional = { certId: 'NS_CERT_ID', privateKeyPath: 'NS_PRIVATE_KEY_PATH', certPath: 'NS_CERT_PATH', clientSecret: 'NS_CLIENT_SECRET', refreshToken: 'NS_REFRESH_TOKEN' };
  for (const [k, name] of Object.entries(optional)) if (env[name]) config[k] = env[name];
  return config;
}
