# Error guide

NetSuite's OAuth 2.0 errors are terse. The same `invalid_grant` covers a wrong key, the wrong algorithm and a dead refresh chain [E-44], [E-38]. Use this page to narrow the cause, then check the Login Audit Trail's Detail column where the table gives one.

"Not in the trail" means the rejection left no Login Audit Trail row [E-67]. "Not measured" means the probes didn't check the trail for that cause.

## `invalid_grant`

| Measured cause | Step | Login Audit Trail Detail | Evidence |
|---|---|---|---|
| RS256 assertion | Client credentials token | `UnsupportedAlgo` | [E-44], [E-66] |
| Algorithm doesn't match the key's curve (ES384 with a P-256 key) | Client credentials token | `SignatureValidation` | [E-45], [E-66] |
| Assertion `kid` belongs to a different mapped certificate | Client credentials token | `SignatureValidation` | [E-52], [E-66] |
| Wrong `code_verifier` | Authorization code token | Not in the trail | [E-22], [E-67] |
| Public client sent no PKCE | Authorization code token, after consent | Not in the trail | [E-24], [E-67] |
| Reused a public refresh token that was already rotated | Refresh | `TokenBlocked` | [E-37], [E-66] |
| Newest token in a public chain after a reuse | Refresh | `TokenBlocked` | [E-38], [E-66] |
| Expired refresh token (Oracle-documented) | Refresh | Not measured | [E-70] |

**Fix.** For client credentials, check `alg` against Oracle's list and the key, then the `kid` [E-42], [E-45], [E-52]. For a refresh, a person has to authorize again [E-39], [E-70].

## `invalid_request`

| Measured cause | Step | Login Audit Trail Detail | Evidence |
|---|---|---|---|
| `code_challenge_method=plain` | Authorize redirect | `PkceFailed` | [E-19], [E-66] |
| `code_challenge` without `code_challenge_method` | Authorize redirect | `PkceFailed` | [E-20], [E-66] |
| `state` of 16 characters | Authorize redirect | `InvalidState` | [E-21], [E-66] |
| `code_verifier` of 42 or 129 characters | Authorization code token, after consent | Not in the trail | [E-23], [E-67] |
| Assertion `exp − iat` over 120 minutes | Client credentials token | Not in the trail | [E-54], [E-67] |
| Public refresh past Maximum time for token rotation, counted from `oit` | Refresh | Not measured | [E-40] |

At the authorize step the error arrives as `error=invalid_request` on the redirect, with no `error_description` [E-19]. A public refresh past the rotation cap returns `invalid_request`, not `invalid_grant` [E-40]; a person has to authorize again.

## `invalid_client`

| Measured cause | Step | Login Audit Trail Detail | Evidence |
|---|---|---|---|
| Assertion signed with a revoked certificate | Client credentials token | Not in the trail | [E-60], [E-67] |

**Fix.** List the certificates and switch to an active one [E-57], [E-60].

## Messages outside the token endpoint

| Where | Message or result | Cause | Evidence |
|---|---|---|---|
| Certificate upload | "Provided x509 certificate has an invalid bit length." | RSA 2048 key | [E-47] |
| Certificate upload | "Maximum number of active certificates exceeded." | Sixth active certificate | [E-51] |
| Integration record save | "oauth2refreshvalidity: Invalid number (must be between 1 and 720)." | Refresh validity out of range | [E-30] |
| Rotation endpoint add | HTTP 500 | Wrong body; see [rotation-endpoint.md](rotation-endpoint.md) | [E-58] |
| SuiteQL on `LoginAudit` | "Invalid or unsupported search" | Any WHERE clause other than `ROWNUM` | [E-69] |

## Logging advice

- Log the HTTP status and full error body of every failed token request; several causes leave nothing in the trail [E-67].
- Don't read a Success row in the trail as a successful call; it means only that authentication worked [E-68].
- Never log tokens, private keys or client secrets alongside the error.
