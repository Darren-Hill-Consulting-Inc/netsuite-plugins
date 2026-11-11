# Evidence register

Every factual statement in this skill cites an entry here as `[E-nn]`. Each entry has one of three types:

- **Measured**: observed in a NetSuite 2026.2 test account in November 2026, with the probe IDs that produced it. Measured findings describe what the account did, not what Oracle promises.
- **Oracle quote**: a short, exact quote from the Oracle NetSuite Help Center, with the page and the date it was fetched.
- **Inference**: a conclusion drawn from other entries, worded as an inference.

`Tag: Observed, not guaranteed` marks behaviour beyond a documented limit. Stay within the documented limit; the measured value may change in any release.

`node tools/check-evidence.mjs --require-cache` checks that every citation resolves and every Oracle quote still appears on its page.

## Index

| ID | Finding |
|---|---|
| E-01 | From 2027.1, no new TBA integrations, including IssueToken and the three-step flow |
| E-02 | TBA end of support is "tentatively planned for the 2028.2 release" |
| E-03 | Existing TBA integrations keep working until the final end of support |
| E-04 | End of support for existing TBA is tentatively 2028.2 and excludes SuiteAnalytics Connect |
| E-05 | NLAuth integrations stop working in 2027.1 |
| E-06 | The NLAuth end of support excludes existing IssueToken integrations |
| E-07 | PKCE is required for new authorization code integrations from 2027.1 |
| E-08 | OAuth 2.0 is not supported for SOAP web services |
| E-09 | TBA is required for SOAP, so no new SOAP integrations from 2027.1 |
| E-10 | New integrations should use REST with OAuth 2.0 from 2026.1 |
| E-11 | 2025.2 is the last planned SOAP endpoint |
| E-12 | From 2027.2 only the last SOAP endpoint is supported |
| E-13 | SOAP endpoints are disabled in 2028.2 |
| E-14 | Existing SOAP/TBA integration records stay editable until SOAP is removed |
| E-15 | Oracle publishes a SOAP to REST upgrade guide |
| E-16 | OAuth 2.0 access needs the Log in Using OAuth 2.0 Access Tokens permission |
| E-17 | An Administrator-role mapping was accepted for client credentials (not recommended) |
| E-18 | A confidential client got tokens without PKCE (before 2027.1) |
| E-19 | `code_challenge_method=plain` is rejected at the authorize step |
| E-20 | A `code_challenge` without a method is rejected; no S256 default |
| E-21 | A 16-character `state` is rejected at the authorize step |
| E-22 | A wrong `code_verifier` fails with `invalid_grant` |
| E-23 | Verifier length is enforced only at the token step, after consent |
| E-24 | A public client without PKCE fails only at the token step, after consent |
| E-25 | Oracle: access token valid for 60 minutes |
| E-26 | Oracle: refresh token valid for seven days |
| E-27 | Oracle: public-client refresh token two days by default, one-time use |
| E-28 | Oracle: accepted refresh validity is 1 to 720 hours (in the public-client note) |
| E-29 | Confidential client defaults: 3,600 s access, 604,800 s refresh |
| E-30 | Confidential refresh validity is editable, default 168, range 1 to 720 h |
| E-31 | At 720 h, a confidential refresh token carried a 30-day expiry |
| E-32 | A confidential refresh returns an access token only |
| E-33 | Re-authorizing doesn't revoke earlier refresh tokens |
| E-34 | Re-consent under Always Ask is one Continue click |
| E-35 | No confidential-client refresh setting gives a refresh token past a 30-day expiry |
| E-71 | An attended confidential integration needs re-authorizing at least every 30 days |
| E-36 | A public-client refresh returns a new refresh token; `oit` stays constant |
| E-37 | Reusing a rotated public refresh token fails with `invalid_grant` |
| E-38 | One reuse kills the whole public refresh chain |
| E-39 | One retry bug that replays a refresh token ends the integration's access |
| E-40 | Maximum rotation time counts from `oit` and fails with `invalid_request` |
| E-41 | Client credentials: no refresh token, 60-minute access token |
| E-42 | Oracle: assertion algorithms PS256 to ES512 |
| E-43 | PS256, PS512 and ES256 assertions each returned an access token |
| E-44 | An RS256 assertion fails with a bare `invalid_grant` |
| E-45 | The signature algorithm must match the key's curve |
| E-46 | Oracle: RSA keys must be 3072 or 4096 bits |
| E-47 | An RSA 2048 certificate is rejected at upload |
| E-48 | An EC P-256 certificate was accepted and worked |
| E-49 | Oracle: certificates longer than two years are shortened |
| E-50 | The two-year shortening is silent |
| E-51 | Five active certificates per mapping; RSA and EC count together |
| E-52 | The assertion `kid` must match the signing key |
| E-53 | Oracle: assertion `exp` must be less than 60 minutes after `iat` |
| E-54 | Assertion lifetimes up to 120 minutes were accepted |
| E-55 | Oracle: the rotation endpoint offers list, add and revoke |
| E-56 | Oracle: rotation requests need a REST web services token |
| E-57 | Rotation endpoint paths that worked |
| E-58 | The add-certificate request body that worked, and the ones that failed |
| E-59 | A certificate added by the endpoint signs tokens straight away |
| E-60 | Revoke returns "Successfully revoked"; a revoked certificate gets `invalid_client` |
| E-61 | Revoking a certificate didn't end an access token already issued |
| E-62 | Adding a sixth active certificate through the endpoint would fail |
| E-63 | Oracle: find TBA via Login Audit Trail "Token-based Access Token Name" not empty |
| E-64 | OAuth 2.0 rows show the application name and a blank access token name |
| E-65 | Track OAuth 2.0 use by Token-based Application Name |
| E-66 | The trail's Detail column names the real failure cause |
| E-67 | Some token-endpoint rejections never reach the trail |
| E-68 | The trail records authentication, not the API outcome |
| E-69 | SuiteQL on LoginAudit is too limited for a TBA inventory |
| E-70 | Oracle: an expired refresh token returns `invalid_grant`; restart at Step One |

## Timeline: TBA and NLAuth

## E-01 No new TBA integrations from 2027.1
- Type: Oracle quote — "As of NetSuite 2027.1, you won't be able to create new integrations that use TBA for authentication. This includes both the IssueToken endpoint, and the three-step TBA authorization flow." — [Authentication release notices (2027.1)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158921905537.html), fetched 2026-11-11
- Finding: The 2027.1 change blocks creating new TBA integrations by either route.

## E-02 TBA end of support is tentatively 2028.2
- Type: Oracle quote — "This limitation is in preparation for the end of support for the TBA feature, tentatively planned for the 2028.2 release." — [Authentication release notices (2027.1)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158921905537.html), fetched 2026-11-11
- Finding: The 2028.2 date is hedged as tentative.

## E-03 Existing TBA integrations keep working until the end of support
- Type: Oracle quote — "Existing integrations will continue to work until the final end of support of the TBA feature." — [Authentication release notices (2027.1)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158921905537.html), fetched 2026-11-11
- Finding: 2027.1 doesn't break existing TBA integrations; it stops new ones.

## E-04 End of support excludes SuiteAnalytics Connect
- Type: Oracle quote — "Later, (tentatively NetSuite 2028.2) the support will end for existing integrations, excluding the SuiteAnalytics Connect (ODBC/JDBC)." — [Preparing for Token-based Authentication (TBA) End of Support](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0525020842.html), fetched 2026-11-11
- Finding: The preparation guide carries the same hedge and excludes SuiteAnalytics Connect.

## E-05 NLAuth stops working in 2027.1
- Type: Oracle quote — "As of 2027.1, all integrations that use NLAuth as an authentication method will stop working." — [Authentication release notices (2027.1)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158921905537.html), fetched 2026-11-11
- Finding: Unlike TBA, NLAuth is a hard stop in 2027.1, not a ban on new integrations.

## E-06 The NLAuth end of support excludes existing IssueToken integrations
- Type: Oracle quote — "This end of support doesn't include the existing integrations that use the IssueToken endpoint." — [Authentication release notices (2027.1)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158921905537.html), fetched 2026-11-11
- Finding: Oracle's note under the NLAuth notice exempts existing integrations that use the IssueToken endpoint.

## E-07 PKCE required for new authorization code integrations from 2027.1
- Type: Oracle quote — "As of NetSuite 2027.1, PKCE parameters will be required for all new integrations that use the OAuth 2.0 authorization code grant flow. Existing integrations without PKCE will remain functional." — [Authentication release notices (2027.1)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158921905537.html), fetched 2026-11-11
- Finding: A TBA replacement built on the authorization code grant must use PKCE.

## Timeline: SOAP

## E-08 OAuth 2.0 is not supported for SOAP
- Type: Oracle quote — "The OAuth 2.0 feature is for use with RESTlets, REST web services, and SuiteAnalytics Connect. It isn't supported for SOAP web services." — [OAuth 2.0](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_157769826287.html), fetched 2026-11-11
- Finding: A SOAP integration can't move to OAuth 2.0 in place; it has to move to REST web services or RESTlets.

## E-09 No new SOAP integrations from 2027.1
- Type: Oracle quote — "With the 2027.1 release, you will not be able to build any new integrations using Token Based Authentication (TBA), which is required for SOAP web services. Accordingly, with the 2027.1 release, you will no longer be able to build new integrations using SOAP web services." — [SOAP Removal Plans FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2104046421.html), fetched 2026-11-11
- Finding: The TBA ban is also the SOAP ban for new integrations.

## E-10 New integrations should use REST with OAuth 2.0 from 2026.1
- Type: Oracle quote — "Starting with the 2026.1 NetSuite release, all newly built integrations should use REST web services with OAuth 2.0." — [SOAP Removal Plans FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2104046421.html), fetched 2026-11-11
- Finding: Oracle's recommendation already applies, ahead of the 2027.1 ban.

## E-11 2025.2 is the last planned SOAP endpoint
- Type: Oracle quote — "The 2025.2 SOAP endpoint is the last planned SOAP endpoint and any later SOAP endpoints would be released only as necessary to meet business, technical, or other significant requirements." — [SOAP Removal Plans FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2104046421.html), fetched 2026-11-11
- Finding: Integrations staying on SOAP until removal should target the 2025.2 endpoint.

## E-12 From 2027.2 only the last SOAP endpoint is supported
- Type: Oracle quote — "Starting with the 2027.2 NetSuite release, only the last endpoint will be supported and have any potential bugs fixed. Older endpoints will still be available, but no longer supported, until the final removal of SOAP web services with the 2028.2 NetSuite release." — [SOAP Removal Plans FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2104046421.html), fetched 2026-11-11
- Finding: Older SOAP endpoints keep working after 2027.2 but get no fixes.

## E-13 SOAP endpoints are disabled in 2028.2
- Type: Oracle quote — "With the 2028.2 NetSuite release, all endpoints will be disabled, and SOAP-based integrations will stop working." — [SOAP Removal Plans FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2104046421.html), fetched 2026-11-11
- Finding: The SOAP removal date is stated without a hedge, unlike the TBA date in [E-02].

## E-14 Existing SOAP/TBA integration records stay editable
- Type: Oracle quote — "existing Integration Records for integrations using SOAP web services and TBA may still be updated or modified until SOAP web services are fully removed." — [SOAP Removal Plans FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2104046421.html), fetched 2026-11-11
- Finding: Maintenance on an existing SOAP integration record isn't blocked by 2027.1.

## E-15 Oracle publishes a SOAP to REST upgrade guide
- Type: Oracle quote — "This guide provides you with the resources to help you upgrade your SOAP web services integration to REST web services." — [SOAP Web Services to REST Web Services Upgrade Guide](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_2095713813.html), fetched 2026-11-11
- Finding: Oracle's guide is the reference for mapping SOAP operations to REST.

## Roles and permissions

## E-16 OAuth 2.0 access needs the Log in Using OAuth 2.0 Access Tokens permission
- Type: Oracle quote — "To use OAuth 2.0 for access, the user must be assigned a role with the Log in Using OAuth 2.0 Access Tokens permission." — [Set Up OAuth 2.0 Roles](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_157771510070.html), fetched 2026-11-11
- Finding: The integration's role needs this permission, whichever grant it uses.

## E-17 An Administrator-role mapping was accepted for client credentials
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p21a
- Finding: A client credentials mapping to an employee with the Administrator role issued a working access token. Recorded as measured, not recommended: map client credentials to a dedicated role with only the permissions the integration needs.

## Authorization code grant and PKCE

## E-18 A confidential client got tokens without PKCE
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p01
- Finding: Before 2027.1, a confidential client completed the authorization code grant without PKCE. New integrations will need it from 2027.1 [E-07].

## E-19 `plain` is rejected at the authorize step
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p03
- Finding: `code_challenge_method=plain` redirected to the callback with `error=invalid_request`, no consent screen and no `error_description`. Use S256.

## E-20 A challenge without a method is rejected
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p05
- Finding: A `code_challenge` sent without `code_challenge_method` failed at the authorize step with `error=invalid_request`. NetSuite doesn't default to S256; send the method explicitly.

## E-21 A 16-character state is rejected
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p09
- Finding: A `state` of 16 characters failed at the authorize step with `error=invalid_request`, before any consent screen.

## E-22 A wrong verifier fails with `invalid_grant`
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p04
- Finding: A token request with the wrong `code_verifier` returned HTTP 400 `{"error":"invalid_grant"}`.

## E-23 Verifier length is enforced only at the token step
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p06a, p06b
- Finding: Verifiers of 42 and 129 characters both got through the authorize step and the consent screen, then failed at the token endpoint with HTTP 400 `{"error":"invalid_request"}`. Both lengths are one character outside the 43 to 128 range, and the error surfaced only after the user had consented.

## E-24 A public client without PKCE fails only after consent
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p07
- Finding: A public client that sent no PKCE parameters got the consent screen and an authorization code, then the token endpoint returned HTTP 400 `{"error":"invalid_grant"}`, a generic error that doesn't name PKCE.

## Token lifetimes

## E-25 Access token valid for 60 minutes
- Type: Oracle quote — "The access token is valid for 60 minutes." — [OAuth 2.0 Authorization Code Grant Flow: Step Two POST Request to the Token Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158081952044.html), fetched 2026-11-11
- Finding: Oracle's documented access token lifetime.

## E-26 Refresh token valid for seven days
- Type: Oracle quote — "The refresh token is valid for seven days." — [OAuth 2.0 Authorization Code Grant Flow: Step Two POST Request to the Token Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158081952044.html), fetched 2026-11-11
- Finding: Oracle states this without qualification. For a confidential client it is the default, not a fixed value [E-30].

## E-27 Public-client refresh tokens: two days by default, one-time use
- Type: Oracle quote — "If you use public clients for OAuth 2.0, the refresh token is only valid for two days by default and is for one-time use only. You can change this value on the integration record." — [OAuth 2.0 Authorization Code Grant Flow: Step Two POST Request to the Token Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158081952044.html), fetched 2026-11-11
- Finding: Oracle describes a configurable refresh validity only in the context of public clients.

## E-28 Accepted refresh validity is 1 to 720 hours
- Type: Oracle quote — "The accepted values are between one hour and 720 hours (thirty days in hours)." — [Refresh Token POST Request to the Token Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158082518856.html), fetched 2026-11-11
- Finding: Oracle's stated range for the refresh token validity field. On the page, this sentence sits inside the "If you use public clients…" note, so Oracle documents the range only for public clients.

## E-29 Confidential client default lifetimes
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p02
- Finding: With the default validity of 168 hours, the access token's `exp − iat` was 3,600 s and the refresh token's 604,800 s (seven days). Both tokens were JWTs signed with RS256.

## E-30 Confidential refresh validity is editable, range 1 to 720 hours
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p41
- Finding: On a confidential integration record the Refresh token validity (in hours) field defaulted to 168 and was editable. Saving 8,760 failed with "oauth2refreshvalidity: Invalid number (must be between 1 and 720)." Oracle describes this field and its range only for public clients [E-27], [E-28]; the confidential-client behaviour is measured, not documented.
- Oracle says: [E-26]

## E-31 At 720 hours, a confidential refresh token carried a 30-day expiry
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p13b, p14c
- Finding: After setting the validity to 720 and authorizing again, the issued refresh token's `exp − iat` was 2,592,000 s (30 days), and it refreshed successfully. The token was not tested to expiry.

## E-32 A confidential refresh returns an access token only
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p14, p14c
- Finding: Refreshing on a confidential client returned `access_token`, `expires_in` and `token_type`, with no new `refresh_token`. See [E-71] for what that means for re-authorization.

## E-33 Re-authorizing doesn't revoke earlier refresh tokens
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p42
- Finding: A seven-day refresh token issued before a second authorization, and before the validity was changed to 720 hours, still refreshed successfully afterwards. Several refresh tokens can be live for one integration at once.

## E-34 Re-consent under Always Ask is one click
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p13b
- Finding: With the consent policy set to Always Ask, second and later authorizations showed when the user had authorized the application before, with Continue and Go Back, instead of the full consent screen.

## E-35 No confidential-client refresh setting gets past a 30-day expiry
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p41, p13b
- Finding: On a confidential client, the validity field's ceiling is 720 hours, and a refresh token issued at 720 carried a 30-day expiry (`exp − iat`; not tested to expiry). Public-client chains are bounded instead by Maximum time for token rotation [E-40], whose ceiling was not measured.

## E-71 An attended confidential integration needs re-authorizing every 30 days
- Type: Inference — from [E-30], [E-31], [E-32]
- Finding: A confidential refresh doesn't return a new refresh token [E-32], and the longest refresh token carried a 30-day expiry [E-30], [E-31]. So an authorization code integration on a confidential client likely needs a person to authorize it again at least every 30 days, and an integration nobody attends belongs on client credentials. This doesn't cover public clients: their rotation ceiling was not measured.

## Public clients: refresh token rotation

## E-36 A public-client refresh returns a new refresh token
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p16
- Finding: On a public client with PKCE S256, every refresh returned `access_token`, `refresh_token`, `expires_in` and `token_type`. The `oit` (original issue time) claim stayed the same across the chain.

## E-37 Reusing a rotated refresh token fails
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p16c
- Finding: Refreshing with a refresh token that had already been rotated returned HTTP 400 `invalid_grant`, matching Oracle's one-time use [E-27].

## E-38 One reuse kills the whole chain
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p16d, p16e
- Finding: After the reuse attempt in [E-37], refreshing with the newest refresh token in the chain also returned HTTP 400 `invalid_grant`. A control chain with three consecutive refreshes and no reuse succeeded every time, so the reuse caused it. Oracle doesn't document this.

## E-39 One replayed refresh token ends the integration's access
- Type: Inference — from [E-38]
- Finding: On a public client, one retry bug that replays a refresh token ends the whole chain, and the integration stays cut off until a person authorizes it again. Never retry a refresh with a token that has already been sent.

## E-40 Maximum rotation time counts from `oit`
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p16f
- Finding: On a public client with a 1-hour refresh validity and a 2-hour maximum rotation time, refreshes 55 and 110 minutes after `oit` succeeded, the second returning a refresh token whose own `exp` was past the 2-hour mark. The refresh 125 minutes after `oit` failed with HTTP 400 `{"error":"invalid_request"}`, not `invalid_grant`. The cap counts from the first authorization, whatever the newest refresh token's expiry says.

## Client credentials (machine-to-machine)

## E-41 No refresh token, 60-minute access token
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p21a
- Finding: A client credentials token request returned `access_token`, `expires_in` and `token_type`, with no refresh token. The access token's `exp − iat` was 3,600 s. The integration requests a new token with a new signed assertion instead of refreshing.

## E-42 Oracle's assertion algorithms
- Type: Oracle quote — "The value of the alg parameter is PS256, PS384, PS512, ES256, ES384, or ES512." — [Request Token (JWT) Structure](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_162790605110.html), fetched 2026-11-11
- Finding: RS256 is not on the list.

## E-43 PS256, PS512 and ES256 assertions each returned an access token
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p21a, p25b, p25c
- Finding: Assertions signed with PS256 and PS512 (RSA 3072 key) and ES256 (EC P-256 key) each returned an access token (HTTP 200). The PS256 token also ran a REST SuiteQL query.

## E-44 RS256 fails with a bare `invalid_grant`
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p25a
- Finding: An RS256 assertion signed with a valid, mapped RSA key returned HTTP 400 `{"error":"invalid_grant"}`, with nothing to say the algorithm was the cause. It looks the same as a wrong key.
- Oracle says: [E-42]

## E-45 The algorithm must match the key's curve
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p25d
- Finding: An ES384 signature made with a P-256 key returned HTTP 400 `invalid_grant`. Only ES256 with a P-256 key was tested as a working pair.

## E-46 Oracle: RSA keys must be 3072 or 4096 bits
- Type: Oracle quote — "The length of the RSA key must be 3072 bits, or 4096 bits. The length of EC key must 256 bits, 384 bits, or 521 bits." — [Certificate Conditions](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/subsect_162755332391.html), fetched 2026-11-11
- Finding: Oracle's key-size rule for client credentials certificates.

## E-47 An RSA 2048 certificate is rejected at upload
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p18
- Finding: Uploading an RSA 2048 certificate to a client credentials mapping failed with "Provided x509 certificate has an invalid bit length."

## E-48 An EC P-256 certificate worked
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p25c
- Finding: An EC P-256 certificate uploaded without error, was listed with Algorithm "EC", and signed working ES256 assertions.

## E-49 Oracle: certificates longer than two years are shortened
- Type: Oracle quote — "The maximum certificate validity is two years. If the certificate is valid for a longer time period, the system automatically shortens the validity to two years." — [Certificate Conditions](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/subsect_162755332391.html), fetched 2026-11-11
- Finding: NetSuite caps the mapping's validity, whatever the certificate says.

## E-50 The two-year shortening is silent
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p19, p19b
- Finding: An RSA 3072 certificate valid for five years was accepted with no warning. The mapping showed Valid Until two years after Valid From, and the certificate signed working assertions. Track the mapping's Valid Until date, not the certificate's.
- Oracle says: [E-49]

## E-51 Five active certificates; RSA and EC count together
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p20
- Finding: With four RSA and one EC certificate active on the same entity, role and integration record, each signed a working token. A sixth upload failed with "Maximum number of active certificates exceeded." Keep a slot free for rotation.

## E-52 The `kid` must match the signing key
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p20b
- Finding: An assertion signed with one mapped key but carrying the `kid` (certificate ID) of another mapped certificate returned HTTP 400 `invalid_grant`.

## E-53 Oracle: assertion lifetime under 60 minutes
- Type: Oracle quote — "The value must be less than 60 minutes greater than the value of the iat parameter." — [Request Token (JWT) Structure](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_162790605110.html), fetched 2026-11-11
- Finding: The documented limit on the assertion's `exp`. Stay within it.

## E-54 Assertion lifetimes up to 120 minutes were accepted
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p24
- Tag: Observed, not guaranteed
- Finding: Assertions with `exp − iat` of 61, 90 and 120 minutes were accepted. From 121 minutes up, the token endpoint returned HTTP 400 `{"error":"invalid_request"}`. The measured ceiling was 120 minutes inclusive, double the documented limit; keep assertions under 60 minutes [E-53].

## Certificate rotation endpoint

## E-55 Oracle: list, add and revoke
- Type: Oracle quote — "You can set up three different requests: GET request that returns the list of certificates associated with the given integration record. POST request that lets you set up a new certificate for a given integration record. POST request that lets you revoke any active certificate." — [OAuth 2.0 Client Credentials Certificate Rotation Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_92130837826.html), fetched 2026-11-11
- Finding: Oracle names the three operations but not their paths or the add request's body.

## E-56 Oracle: rotation requests need a REST web services token
- Type: Oracle quote — "The access token must be issued for the REST web services scope." — [OAuth 2.0 Client Credentials Certificate Rotation Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_92130837826.html), fetched 2026-11-11
- Finding: The token used to call the endpoint must carry the `rest_webservices` scope.

## E-57 Rotation endpoint paths that worked
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p21a, p21f, p22
- Finding: With a client credentials token for the REST web services scope, these worked: `GET /services/rest/auth/oauth2/v1/clients/{clientId}/certificates` (list), `POST /services/rest/auth/oauth2/v1/clients/{clientId}/certificates` (add) and `POST /services/rest/auth/oauth2/v1/clients/{clientId}/certificates/{certificateId}/revoke` (revoke). The list returns, per certificate, the application, entity, role, created, valid_from, valid_until, revoked, algorithm and certificate_id.

## E-58 The add request body
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p21c, p21d, p21e, p21f
- Finding: An empty JSON object, a raw PEM body and `{"certificate": …}` each failed with HTTP 500; the last error listed the known fields `application, validUntil, entity, validFrom, fileName, fileContent, role`. The body that worked was JSON with `fileName`, `fileContent` (the PEM text), `entity` and `role` (internal IDs). The integration record came from the path, and the response carried the new certificate ID.

## E-59 A new certificate signs tokens straight away
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p21g
- Finding: An assertion signed with the certificate just added through the endpoint, using its new certificate ID as `kid`, returned a token at once. Add new, switch `kid`, revoke old is a full rotation without the UI.

## E-60 Revoke, and a revoked certificate's error
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p22, p22b
- Finding: The revoke request returned "Successfully revoked" and the list then showed the certificate as revoked. A new assertion signed with the revoked certificate returned HTTP 400 `{"error":"invalid_client"}`, not `invalid_grant`.

## E-61 Revoking a certificate didn't end an issued token
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p23
- Finding: An access token minted with a certificate just before it was revoked still ran a query afterwards. Single test, within minutes. Revocation stops new tokens; tokens already issued may run out their 60 minutes.

## E-62 A sixth active certificate through the endpoint would fail
- Type: Inference — from [E-51]; not re-tested through the endpoint
- Finding: The five-active limit was measured through the UI. The add request is likely to fail the same way when five certificates are active, so a rotation script should check for a free slot first.

## Login Audit Trail

## E-63 Oracle's TBA search
- Type: Oracle quote — "Token-based Access Token Name, with the value is not empty." — [What to Do to Prepare for the End of Support](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0525022007.html), fetched 2026-11-11
- Finding: Oracle's preparation guide finds TBA integrations with this Login Audit Trail saved search criterion.

## E-64 OAuth 2.0 rows in the trail
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p31c
- Finding: Every OAuth 2.0 row the trail recorded (authorization code, refresh, client credentials, rotation endpoint, SuiteQL) had the integration record's name in Token-based Application Name and Token-based Access Token Name blank. Oracle's criterion [E-63] lists TBA only.

## E-65 Track OAuth 2.0 use by application name
- Type: Inference — from [E-63], [E-64]
- Finding: To see how far a migration has got, group the trail by Token-based Application Name: TBA rows have an access token name and OAuth 2.0 rows don't.

## E-66 The Detail column names the cause
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p31e
- Finding: Where the API returned only `invalid_request` or `invalid_grant`, the trail's Detail column said `PkceFailed` (plain method; challenge without method), `InvalidState` (16-character state), `UnsupportedAlgo` (RS256 assertion), `SignatureValidation` (algorithm or key mismatch, wrong `kid`) or `TokenBlocked` (public refresh token reuse and the chain it killed).

## E-67 Some rejections never reach the trail
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p31f
- Finding: These token-endpoint rejections were not in the trail at all: assertion `exp` over 120 minutes, verifier of the wrong length, wrong `code_verifier`, public client without PKCE, and a request signed with a revoked certificate. Log the full error body of every failed token request in the integration itself.

## E-68 The trail records authentication, not the API outcome
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p31d
- Finding: Requests that authenticated and then failed (certificate POSTs that returned 500, SuiteQL calls that returned 400) were logged as Success.

## E-69 SuiteQL on LoginAudit is too limited
- Type: Measured — NetSuite 2026.2, test account, November 2026 — p31a, p31b
- Finding: `SELECT * FROM LoginAudit WHERE ROWNUM <= 3` returned only date, detail, emailaddress, ipaddress, requesturi, role, status, user and useragent, with no token application or access token name. Any other WHERE clause returned "Invalid or unsupported search". Build the TBA inventory with a saved search in the UI.

## Refresh errors

## E-70 An expired refresh token returns `invalid_grant`
- Type: Oracle quote — "When the refresh token expires, the token endpoint returns an invalid_grant error. The application must go back to Step One of the OAuth 2.0 authorization code grant flow to restart the process." — [Refresh Token POST Request to the Token Endpoint](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_158082518856.html), fetched 2026-11-11
- Finding: `invalid_grant` on refresh means a person must authorize the integration again.
