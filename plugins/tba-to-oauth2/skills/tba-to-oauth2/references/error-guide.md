# Error guide

NetSuite's OAuth 2.0 errors are terse. The same `invalid_grant` covers a key that doesn't match the algorithm or the `kid`, an unsupported algorithm and a dead refresh chain [E-45], [E-52], [E-44], [E-38]. Use this page to narrow the cause, then check the Login Audit Trail's Detail column where the table gives one.

Every cause in the tables below is measured unless the row says it is Oracle-documented. "Not in the trail" means the rejection left no Login Audit Trail row [E-67]. "Not measured" means the probes didn't check the trail for that cause.

## `invalid_grant`

| Cause | Step | Login Audit Trail Detail | Evidence |
|---|---|---|---|
| RS256 assertion | Client credentials token | `UnsupportedAlgo` | [E-44], [E-66] |
| Algorithm doesn't match the key's curve (ES384 with a P-256 key) | Client credentials token | `SignatureValidation` | [E-45], [E-66] |
| Assertion `kid` belongs to a different mapped certificate | Client credentials token | `SignatureValidation` | [E-52], [E-66] |
| Wrong `code_verifier` | Authorization code token | Not in the trail | [E-22], [E-67] |
| Public client sent no PKCE | Authorization code token, after consent | Not in the trail | [E-24], [E-67] |
| Reused a public refresh token that was already rotated | Refresh | `TokenBlocked` | [E-37], [E-66] |
| Newest token in a public chain after a reuse | Refresh | `TokenBlocked` | [E-38], [E-66] |
| Expired refresh token (Oracle-documented, not measured) | Refresh | Not measured | [E-70] |

**Fix.** For client credentials, check `alg` against Oracle's list and the key, then the `kid` [E-42], [E-45], [E-52]. For an expired refresh token, a person has to authorize again [E-70]. After a public chain is killed, we infer the same: no token in the chain refreshes any more [E-38], [E-39].

## `invalid_request`

| Cause | Step | Login Audit Trail Detail | Evidence |
|---|---|---|---|
| `code_challenge_method=plain` | Authorize redirect | `PkceFailed` | [E-19], [E-66] |
| `code_challenge` without `code_challenge_method` | Authorize redirect | `PkceFailed` | [E-20], [E-66] |
| `state` of 16 characters | Authorize redirect | `InvalidState` | [E-21], [E-66] |
| `code_verifier` of 42 or 129 characters | Authorization code token, after consent | Not in the trail | [E-23], [E-67] |
| Assertion `exp − iat` over 120 minutes | Client credentials token | Not in the trail | [E-54], [E-67] |
| Public refresh past Maximum time for token rotation, counted from `oit` | Refresh | Not measured | [E-40] |

At the authorize step the error arrives as `error=invalid_request` on the redirect [E-19], [E-20], [E-21]. For the plain method, the redirect carried no `error_description` [E-19]. A public refresh past the rotation cap returns `invalid_request`, not `invalid_grant` [E-40]; we infer that a person has to authorize again, since the cap counts from the first authorization [E-40].

## `invalid_client`

| Cause | Step | Login Audit Trail Detail | Evidence |
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
| SuiteQL on `LoginAudit` | "Invalid or unsupported search" | The other WHERE clauses tried (user, date, SYSDATE); only `ROWNUM <= 3` worked | [E-69] |

## Logging advice

- Log the HTTP status and full error body of every failed token request; several causes leave nothing in the trail [E-67].
- Don't read a Success row in the trail as a successful call; it means only that authentication worked [E-68].
- Never log tokens, private keys or client secrets alongside the error.
