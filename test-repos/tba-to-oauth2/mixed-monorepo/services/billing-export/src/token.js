// OAuth 2.0 client credentials (M2M) for NetSuite, migrated off TBA in 2025.
import fs from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const account = process.env.NS_ACCOUNT_ID;
const host = account.toLowerCase().replace(/_/g, '-');
export const restBase = `https://${host}.suitetalk.api.netsuite.com/services/rest`;
const tokenUrl = `${restBase}/auth/oauth2/v1/token`;

let cached = null;

export async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const key = await importPKCS8(fs.readFileSync(process.env.NS_PRIVATE_KEY_PATH, 'utf8'), 'PS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: ['rest_webservices'] })
    .setProtectedHeader({ alg: 'PS256', typ: 'JWT', kid: process.env.NS_CERTIFICATE_ID })
    .setIssuer(process.env.NS_CLIENT_ID)
    .setAudience(tokenUrl)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
    }),
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  const body = await res.json();
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cached.token;
}
