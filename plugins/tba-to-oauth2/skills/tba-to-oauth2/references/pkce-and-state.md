# PKCE and state

For the authorization code grant. For client credentials, see [certificates-and-assertions.md](certificates-and-assertions.md).

## When PKCE is required

- Oracle: "As of NetSuite 2027.1, PKCE parameters will be required for all new integrations that use the OAuth 2.0 authorization code grant flow. Existing integrations without PKCE will remain functional." [E-07]
- Before 2027.1, a confidential client completed the authorization code grant without PKCE [E-18].
- A public client that sent no PKCE parameters failed at the token step [E-24].

Use PKCE with S256 on every new authorization code integration, confidential or public [E-07].

## Rules that were measured

| Request | Result | Fails at | Evidence |
|---|---|---|---|
| `code_challenge_method=plain` | Redirect with `error=invalid_request`, no consent screen, no `error_description` | Authorize step | [E-19] |
| `code_challenge` without `code_challenge_method` | `error=invalid_request`; no S256 default | Authorize step | [E-20] |
| `state` of 16 characters | `error=invalid_request`, before consent | Authorize step | [E-21] |
| Wrong `code_verifier` | HTTP 400 `{"error":"invalid_grant"}` | Token step | [E-22] |
| `code_verifier` of 42 or 129 characters | HTTP 400 `{"error":"invalid_request"}` | Token step, after consent | [E-23] |
| Public client, no PKCE | HTTP 400 `{"error":"invalid_grant"}` | Token step, after consent | [E-24] |

## What to send

- Send `code_challenge_method=S256` explicitly; NetSuite doesn't default to it [E-20].
- Generate a `code_verifier` of 43 to 128 characters; one character either side failed [E-23].
- Use a long random `state`; 16 characters was rejected [E-21]. The minimum accepted length was not measured, so we recommend 32 or more characters.
- Keep the verifier with the `state` it was created for, so the token request sends the matching one [E-22].

## Errors that surface after consent

Verifier-length and missing-PKCE mistakes get through the consent screen and fail only at the token endpoint [E-23], [E-24]. The user sees a successful consent and the integration still has no token [E-23], [E-24]. Test the full flow, through the token request, in a sandbox before handing it to users.

The token-step errors don't name PKCE: a wrong verifier and a public client without PKCE both return a bare `invalid_grant` [E-22], [E-24].

## Login Audit Trail

The authorize-step rejections show a cause in the trail's Detail column: `PkceFailed` for the plain method and for a challenge without a method, and `InvalidState` for the 16-character state [E-66]. The token-step rejections (wrong verifier, wrong verifier length, public client without PKCE) weren't in the trail at all [E-67]. Log the full error body of every failed token request in the integration itself [E-67]. See [error-guide.md](error-guide.md).
