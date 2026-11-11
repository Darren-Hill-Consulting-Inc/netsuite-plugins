# New-implementation interview

For someone building a NetSuite OAuth 2.0 integration, or rebuilding one off TBA. Ask one question at a time, offer the options as a numbered list, and stop as soon as the decision table settles on one design. Skip a question when the code or an earlier answer already answers it, and say what you inferred.

Rebuilding a SOAP integration? OAuth 2.0 isn't supported for SOAP web services [E-08], so it moves to REST web services or RESTlets first [E-15]. Run this interview for the REST replacement.

## Questions

**Q1. Who is present when it runs?**

1. A person signs in and the integration acts as them (a web app, a desktop or command-line tool someone runs).
2. Nobody: a scheduled job, a worker, a queue consumer, a CI pipeline, a server-to-server sync.
3. Both: a person starts it, but it then keeps running on its own for days or weeks.

**Q2. (Only if Q1 = 1.) Where does the code that talks to NetSuite run?**

1. On a server you control, which can keep a client secret (a confidential client).
2. On the user's device or in their browser, where a secret can't be kept (a public client).

**Q3. Which language and runtime?**

1. Node.js
2. Python
3. Java
4. .NET
5. PHP
6. Something else

The shipped, tested examples are Node. For other languages, give guidance that follows the same steps and say it hasn't been tested by this skill.

**Q4. (Client credentials only.) Where can the private key live?**

1. A cloud KMS or HSM that signs without releasing the key
2. A secrets manager the integration reads at start-up
3. A file on the server, readable only by the integration's user
4. Nowhere yet

**Q5. Who will rotate the certificate?**

1. The integration rotates its own certificate through the rotation endpoint
2. A person runs a rotation script on a schedule
3. Nobody has been named yet

**Q6. How many NetSuite accounts will it run against?**

1. One production account
2. Production plus one or more sandboxes
3. Several separate customer accounts

**Q7. Which role will it use?**

1. A new role just for this integration
2. A role other integrations or people already use
3. Administrator, or a person's own role

## Decision table

| Q1 | Q2 | Q4 | Design |
|---|---|---|---|
| 2 or 3 | — | 2, 3 or 4 | **A. Client credentials, key in a secrets manager or file** |
| 2 or 3 | — | 1 | **B. Client credentials, key in a KMS or HSM** |
| 1 | 1 | — | **C. Authorization code + PKCE, confidential client** |
| 1 | 2 | — | **D. Authorization code + PKCE, public client** |

Why these mappings:

- Unattended work goes on client credentials. It has no refresh token to expire [E-41], while an attended confidential integration likely needs re-authorizing at least every 30 days (inference) [E-71].
- Q1 = 3 ("both") is unattended once it is running, so it also goes on client credentials [E-71].
- Every authorization code design uses PKCE with S256. PKCE is required for new authorization code integrations from 2027.1 [E-07].

Q5 to Q7 don't change the design. They change its steps:

| Answer | Effect on the steps |
|---|---|
| Q5 = 1 | The integration's own token needs the REST web services scope to call the rotation endpoint [E-56]. Build list, add, switch, revoke into it (Rotation below). |
| Q5 = 2 | Hand over `rotate-cert.mjs` and a calendar reminder well before the mapping's Valid Until date [E-50]. |
| Q5 = 3 | Name an owner before go-live. The mapping's validity is at most two years [E-49], and nothing in the integration will warn before it runs out. |
| Q6 = 2 or 3 | Generate a separate key pair per account, set up and verify each account on its own (the scripts run against one account per run), and keep each account's client ID, certificate ID and key apart. |
| Q7 = 1 | Recommended. Give it the Log in Using OAuth 2.0 Access Tokens permission [E-16] and only what its calls need; which permissions a given call needs was not measured. |
| Q7 = 2 | Warn that changing the shared role changes every integration and person on it. Recommend a dedicated role [E-16]. |
| Q7 = 3 | An Administrator mapping was accepted in testing [E-17], but don't recommend it. Recommend a dedicated role. |

## Design A: client credentials, key in a secrets manager or file

### Integration record and mapping

- Enable the client credentials grant on the integration record. Choose the scope the calls need: `restlets`, `rest_webservices` or `suite_analytics` [E-80]. The rotation endpoint needs `rest_webservices` [E-56].
- Map the certificate to an entity, a role and the integration record [E-51]. The role needs the Log in Using OAuth 2.0 Access Tokens permission [E-16].
- NetSuite generates a Certificate ID during the mapping; that is the assertion's `kid` [E-78].
- Field labels and menu paths aren't quoted here. Follow Oracle's OAuth 2.0 Client Credentials Setup pages for where each setting lives.

### Certificate

RSA keys must be 3072 or 4096 bits; EC keys 256, 384 or 521 bits [E-46]. RSA 2048 is rejected at upload [E-47]. Issue the certificate for two years or less, because a longer one is shortened to two years without warning [E-49], [E-50]. 730 days is two years or less in any calendar.

RSA 3072 (use `rsa:4096` for 4096), for PS256:

```sh
openssl req -x509 -newkey rsa:3072 -nodes \
  -keyout integration-private.pem -out integration-cert.pem \
  -days 730 -subj "/CN=my-integration"
```

EC P-256, for ES256:

```sh
openssl ecparam -name prime256v1 -genkey -noout -out integration-private.pem
openssl req -new -x509 -key integration-private.pem -out integration-cert.pem \
  -days 730 -subj "/CN=my-integration"
```

These commands ran unchanged on LibreSSL 3.3.6 (the macOS `/usr/bin/openssl`), OpenSSL 3.6 and OpenSSL 4.1 (checked 2026-11-11; this is tool behaviour, not a NetSuite fact). The differences seen:

- OpenSSL 3 and later print progress dots while generating the RSA key; LibreSSL doesn't. The files are the same kind.
- On all three, the RSA key comes out as PKCS#8 (`BEGIN PRIVATE KEY`) and the EC key as SEC1 (`BEGIN EC PRIVATE KEY`). The shipped scripts read both.
- OpenSSL 3 and later prefer `-noenc` to `-nodes`, but still accept `-nodes`; LibreSSL knows only `-nodes`. Keep `-nodes` for commands that must work on both.

`-nodes` writes the private key unencrypted, because the scripts can't read a passphrase-protected key. Set its file mode to 600 or move it into the secrets manager straight away. Upload only `integration-cert.pem` to NetSuite; the private key never leaves the integration.

Check the pair before uploading:

```sh
NS_CERT_PATH=integration-cert.pem NS_PRIVATE_KEY_PATH=integration-private.pem NS_ALG=PS256 \
  node "${CLAUDE_SKILL_DIR}/scripts/check-cert.mjs" --account "$NS_ACCOUNT_ID"
```

(`NS_ACCOUNT_ID` and `NS_CLIENT_ID` must already be set; use `NS_ALG=ES256` for the EC key.)

### Assertion

What worked [E-84]:

- Header: `typ` `JWT` [E-77], `alg` `PS256` or `ES256` [E-42], [E-43], `kid` the Certificate ID [E-78].
- Payload: `iss` the client ID [E-79], `scope` a JSON array such as `["rest_webservices"]` [E-80], [E-84], `aud` the token endpoint URL [E-81], `iat` and `exp` in Unix seconds [E-82], [E-83].
- `exp` less than 60 minutes after `iat` [E-53]. Up to 120 minutes was accepted in testing, but that is observed, not guaranteed; stay under 60 [E-54]. We recommend a few minutes and a fresh assertion per token request.
- Set `alg` explicitly. RS256 fails with a bare `invalid_grant` [E-44], and an ES algorithm must match the key's curve [E-45].

POST it form-encoded to `https://<account>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token` with `grant_type=client_credentials`, `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer` and `client_assertion=<the JWT>` [E-84].

Node: copy `${CLAUDE_SKILL_DIR}/scripts/lib/jwt.mjs` (Apache-2.0) into the project rather than rewriting it. It signs exactly that header and payload, refuses RS256, and checks the key against the algorithm before signing. Then:

```javascript
import fs from 'node:fs';
import { signAssertion } from './jwt.mjs';

const tokenUrl = `https://${process.env.NS_ACCOUNT_HOST}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;

export async function getAccessToken() {
  const assertion = signAssertion({
    clientId: process.env.NS_CLIENT_ID,
    certId: process.env.NS_CERT_ID,
    privateKeyPem: fs.readFileSync(process.env.NS_PRIVATE_KEY_PATH, 'utf8'),
    alg: process.env.NS_ALG || 'PS256',
    tokenUrl,
    scopes: ['rest_webservices'],
    lifetimeSec: 300,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token request failed: HTTP ${res.status} ${text}`); // the error body holds no token
  return JSON.parse(text); // { access_token, expires_in, token_type }
}
```

`NS_ACCOUNT_HOST` is the account ID as it appears in the integration's existing NetSuite hosts. The shipped scripts derive it by lower-casing the ID and replacing `_` with `-`; that is the scripts' behaviour, not a documented rule.

### Token handling

- There is no refresh token; when the access token expires, sign a new assertion and request a new token [E-41].
- The access token lasted 60 minutes [E-25], [E-41]. Cache it and request a new one a few minutes before `expires_in` runs out.
- Never log the access token or the assertion.

### Rotation

With `${CLAUDE_SKILL_DIR}/scripts/rotate-cert.mjs`, or the same four calls built into the integration [E-57]:

1. `list`: check for a free slot. Five active certificates is the limit, RSA and EC together [E-51]; a sixth add is likely to fail (inference) [E-62].
2. `add --cert <new pem> --entity <id> --role <id> --confirm`: the body needs the entity and role internal IDs [E-58]. The script prints the new certificate ID once.
3. Switch the integration to the new key and its certificate ID as `kid`. The new certificate signed tokens straight away [E-59].
4. `revoke --certificate-id <old id> --confirm` once the new one works [E-60]. Tokens already issued may run out their 60 minutes [E-61].
5. `list` again and check the new certificate's `valid_until`; whether the endpoint applies the two-year cap was not measured [E-57].

`add` and `revoke` change the account. Before either, follow the account-change rule in SKILL.md.

### Error logging

- Log the HTTP status and the full error body of every failed token request. Several rejections never reach the Login Audit Trail [E-67].
- Map the error with [error-guide.md](error-guide.md): `invalid_grant` for an algorithm, curve or `kid` problem [E-44], [E-45], [E-52]; `invalid_client` for a revoked certificate [E-60]; `invalid_request` for an over-long assertion [E-54].
- A Success row in the trail means authentication worked, not that the call did [E-68].

### Verify

```sh
node "${CLAUDE_SKILL_DIR}/scripts/m2m-check.mjs" --account "$NS_ACCOUNT_ID"
```

It mints a token, checks its lifetime, runs SuiteQL `SELECT 1` and lists the certificates, changing nothing.

## Design B: client credentials, key in a KMS or HSM

Design A, except for signing:

- The KMS key must be RSA 3072 or 4096, or EC P-256, P-384 or P-521 [E-46]. Generate the certificate from that key with the KMS's own tooling, for two years or less [E-49].
- The KMS signs the assertion's signing input. Use PS256 for RSA or ES256 for P-256 [E-43]; whether a given KMS's RSA-PSS or ECDSA output is accepted by NetSuite was not measured. Test it in a sandbox before production.
- `jwt.mjs` signs with a local key, so in Node keep its header and payload shape and swap the signing call for the KMS call.
- `m2m-check.mjs` needs a local key file, so it can't test a KMS key. Use `check-assertion.mjs` on a saved assertion the integration produced, then confirm a token request in a sandbox.
- Rotation is the same; the new certificate comes from a new KMS key version.

## Design C: authorization code + PKCE, confidential client

### Integration record

- Enable the authorization code grant, and set the redirect URI your app uses. Choose the scope the calls need [E-80].
- The role of each user who authorizes needs the Log in Using OAuth 2.0 Access Tokens permission [E-16].
- Refresh token validity (in hours): default 168, range 1 to 720 [E-30]. At 720 a refresh token carried a 30-day expiry [E-31]. A new authorization picks up the new value [E-31]; earlier refresh tokens kept working in testing [E-33].

### PKCE and state

- Authorize at `https://<accountID>.app.netsuite.com/app/login/oauth2/authorize.nl` [E-74].
- Send `code_challenge_method=S256` explicitly; `plain` is rejected [E-19], [E-72], and a challenge without a method is rejected [E-20], [E-75].
- `code_verifier` 43 to 128 characters [E-76]; a wrong length fails only at the token step, after consent [E-23].
- `state` 22 to 1024 characters [E-73]; 16 was rejected [E-21]. We recommend 32 or more.
- Keep the verifier with its `state`, so the token request sends the matching one [E-22].

```javascript
import crypto from 'node:crypto';

const verifier = crypto.randomBytes(32).toString('base64url'); // 43 characters
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state = crypto.randomBytes(24).toString('base64url');    // 32 characters
// Store { state, verifier } server-side; send code_challenge=challenge&code_challenge_method=S256&state=state.
```

### Token handling and refresh

- Access token: 60 minutes [E-25], [E-29].
- A confidential refresh returns a new access token and no new refresh token [E-32], so the refresh token's own expiry is a hard stop: seven days by default [E-26], [E-29], at most 30 days [E-31], [E-35].
- When it expires the token endpoint returns `invalid_grant`, and the user must authorize again [E-70]. Build the re-authorization path into the app from day one; an attended confidential integration likely needs it at least every 30 days (inference) [E-71].
- Authorizing again doesn't revoke earlier refresh tokens [E-33]. Store only the newest one, and treat the old ones as secrets until they expire.

### Error logging

- Authorize-step errors arrive as `error=invalid_request` on the redirect [E-19], [E-20], [E-21]. Log them with the request you sent (not the verifier).
- Token-step errors: log the HTTP status and full error body; a wrong verifier returns a bare `invalid_grant` and leaves no trail row [E-22], [E-67].
- See [error-guide.md](error-guide.md).

### Verify

Run the whole flow, through the token request, in a sandbox first: verifier and missing-PKCE mistakes pass the consent screen and fail only at the token step [E-23], [E-24]. Then, with the refresh token in `NS_REFRESH_TOKEN` and the secret in `NS_CLIENT_SECRET`:

```sh
node "${CLAUDE_SKILL_DIR}/scripts/refresh-check.mjs" --account "$NS_ACCOUNT_ID"
```

## Design D: authorization code + PKCE, public client

Design C, with these differences.

### Integration record

- Mark the client public. Refresh token validity defaults to two days, settable from 1 to 720 hours [E-27], [E-28].
- Set the Maximum time for token rotation. It counts from the first authorization (`oit`), whatever the newest refresh token's own expiry says [E-40]. Its ceiling was not measured [E-35].
- PKCE is mandatory in practice: a public client without it failed at the token step, after consent [E-24].

### Refresh rules

Every refresh returns a new refresh token, and `oit` stays the same [E-36]. Reusing a refresh token that was already rotated fails with `invalid_grant` [E-37], and it kills the whole chain: the newest token fails too [E-38]. So:

- Never retry a refresh with a token you have already sent [E-39].
- Persist the new refresh token before using the new access token.
- Serialize refreshes so two processes never refresh at once.
- Past the maximum rotation time, refresh fails with `invalid_request`, not `invalid_grant` [E-40]. Prompt the user to authorize again before then.

### Verify

Don't test refresh casually: `refresh-check --public` uses up the chain, because the script doesn't save the new refresh token [E-36]. Run it only after the account-change rule in SKILL.md, and with the user ready to authorize again.
