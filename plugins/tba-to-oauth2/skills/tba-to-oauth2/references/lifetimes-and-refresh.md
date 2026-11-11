# Token lifetimes and refresh

## At a glance

| Token | Documented | Measured | Evidence |
|---|---|---|---|
| Access token | 60 minutes | `exp − iat` 3,600 s | [E-25], [E-29], [E-41] |
| Refresh token, confidential client | Seven days | 604,800 s at the default 168 h; 30 days at 720 h | [E-26], [E-29], [E-31] |
| Refresh token, public client | Two days by default, one-time use | New refresh token on every refresh | [E-27], [E-36] |
| Client credentials | — | No refresh token | [E-41] |

## Access tokens

- Oracle: "The access token is valid for 60 minutes." [E-25]
- Measured access tokens had `exp − iat` of 3,600 s, for both a confidential client and client credentials [E-29], [E-41].

## Confidential clients

- Oracle: "The refresh token is valid for seven days." [E-26]
- With the default validity of 168 hours, the refresh token's `exp − iat` was 604,800 s [E-29].
- The integration record's Refresh token validity (in hours) field defaulted to 168, was editable, and rejected 8,760 with "oauth2refreshvalidity: Invalid number (must be between 1 and 720)." [E-30]
- Oracle describes this field and its 1 to 720 hour range only for public clients; the confidential-client behaviour is measured, not documented [E-28], [E-30].
- At 720 hours, a newly issued refresh token carried a 30-day expiry and refreshed successfully; it wasn't tested to expiry [E-31].
- A refresh returned `access_token`, `expires_in` and `token_type`, with no new `refresh_token` [E-32].
- No setting gave a confidential refresh token an expiry past 30 days [E-35].

**What that means.** An attended confidential integration likely needs a person to authorize it again at least every 30 days, because the refresh token isn't replaced [E-71]. That is an inference from the measurements, not something Oracle states [E-71]. If nobody attends the integration, use client credentials instead [E-71].

**Changing the validity.** The 30-day expiry appeared on a refresh token issued after the change and a new authorization, while a seven-day refresh token issued before the change still refreshed afterwards [E-31], [E-33]. Authorize again after changing the field.

**Re-authorizing.**

- Authorizing again didn't revoke earlier refresh tokens, so several can be live at once [E-33].
- With the consent policy set to Always Ask, a repeat authorization was one Continue click, not the full consent screen [E-34].

Store only the newest refresh token, and treat old ones as secrets until they expire [E-33].

## Public clients

- Oracle: "If you use public clients for OAuth 2.0, the refresh token is only valid for two days by default and is for one-time use only. You can change this value on the integration record." [E-27]
- Oracle: "The accepted values are between one hour and 720 hours (thirty days in hours)." [E-28]
- Every refresh returned a new `refresh_token`, and the `oit` (original issue time) claim stayed the same across the chain [E-36].

### Rotation rules

| Event | Result | Evidence |
|---|---|---|
| Reuse a refresh token that was already rotated | HTTP 400 `invalid_grant` | [E-37] |
| Then refresh with the newest token in the chain | HTTP 400 `invalid_grant`; the whole chain is dead | [E-38] |
| Three consecutive refreshes, no reuse | All succeeded | [E-38] |
| Refresh past Maximum time for token rotation, counted from `oit` | HTTP 400 `{"error":"invalid_request"}` | [E-40] |

- Oracle doesn't document the chain kill [E-38].
- The maximum rotation time counts from the first authorization, whatever the newest refresh token's own `exp` says [E-40].
- The ceiling of Maximum time for token rotation was not measured [E-35].

**One replayed token ends access.** A single retry bug that sends a used refresh token again ends the whole chain, and the integration stays cut off until a person authorizes it again [E-39]. We recommend:

- Never retry a refresh with a token you have already sent [E-39].
- Persist the new refresh token before using the new access token.
- Serialize refreshes so two workers never refresh at once.
- Schedule re-authorization before the maximum rotation time runs out, since that cap counts from `oit` [E-40].

## Client credentials

A client credentials token request returned `access_token`, `expires_in` and `token_type`, with no refresh token [E-41]. Request a new token with a new signed assertion when the access token expires [E-41]. See [certificates-and-assertions.md](certificates-and-assertions.md).

## When a refresh fails

- Oracle: "When the refresh token expires, the token endpoint returns an invalid_grant error. The application must go back to Step One of the OAuth 2.0 authorization code grant flow to restart the process." [E-70]

`invalid_grant` on refresh also came from public-chain reuse [E-37], [E-38]. Either way, a person must authorize again [E-39], [E-70]. See [error-guide.md](error-guide.md).
