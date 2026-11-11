# Certificates and assertions

For the client credentials grant: the integration signs a JWT assertion with its private key, and NetSuite checks it against an uploaded certificate.

## The assertion and token request

What worked [E-84]:

| Part | Field | Value | Oracle |
|---|---|---|---|
| Header | `typ` | `JWT` | [E-77] |
| Header | `alg` | `PS256` (see the algorithm table below) | [E-42] |
| Header | `kid` | The Certificate ID from the client credentials mapping | [E-78] |
| Payload | `iss` | The integration's client ID | [E-79] |
| Payload | `scope` | `["rest_webservices"]` | [E-80] |
| Payload | `aud` | The token endpoint URL | [E-81] |
| Payload | `iat` | Issue time, Unix seconds | [E-82] |
| Payload | `exp` | Expiry, Unix seconds; under 60 minutes after `iat` | [E-83], [E-53] |

The token endpoint was `https://<account>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`, and `aud` carried the same URL [E-84], [E-81]. The assertion was POSTed form-encoded [E-84]:

```text
grant_type=client_credentials
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion=<the signed JWT>
```

Oracle describes `scope` as values "separated by a comma"; the measured assertion sent a JSON array, and a comma-separated string was not tested [E-80], [E-84]. Use the array form that was measured.

## Assertion lifetime

**Documented limit.** Oracle: "The value must be less than 60 minutes greater than the value of the iat parameter." [E-53] Keep `exp − iat` under 60 minutes [E-53].

**Observed, not guaranteed — stay under 60 min.** Assertions with `exp − iat` of 61, 90 and 120 minutes were accepted, and from 121 minutes up the token endpoint returned HTTP 400 `{"error":"invalid_request"}` [E-54]. The measured ceiling was 120 minutes inclusive, double the documented limit; it may change in any release [E-54]. Don't build on it.

We recommend an `exp` a few minutes after `iat`, with a fresh assertion for every token request.

## Signing algorithms

- Oracle: "The value of the alg parameter is PS256, PS384, PS512, ES256, ES384, or ES512." [E-42]

| Algorithm and key | Result | Evidence |
|---|---|---|
| PS256, RSA 3072 | Access token; also ran a REST SuiteQL query | [E-43] |
| PS512, RSA 3072 | Access token | [E-43] |
| ES256, EC P-256 | Access token | [E-43], [E-48] |
| RS256, valid mapped RSA key | HTTP 400 `{"error":"invalid_grant"}`, with nothing naming the algorithm | [E-44] |
| ES384, EC P-256 key | HTTP 400 `invalid_grant` | [E-45] |

RS256 is not on Oracle's list, and its failure looks the same as a wrong key [E-42], [E-44]. Set `alg` explicitly rather than relying on a library default. Match the algorithm to the key's curve; ES256 with P-256 was the only EC pair tested [E-45].

## The `kid`

Oracle: "The value of the kid parameter is the value of the Certificate ID generated during the mapping of the application." [E-78] It must belong to the mapped certificate whose key signed the assertion [E-52]. An assertion signed with one mapped key but carrying another mapped certificate's `kid` returned HTTP 400 `invalid_grant` [E-52]. When you rotate, change the key and the `kid` together.

## Key sizes

- Oracle: "The length of the RSA key must be 3072 bits, or 4096 bits. The length of EC key must 256 bits, 384 bits, or 521 bits." [E-46]
- Uploading an RSA 2048 certificate failed with "Provided x509 certificate has an invalid bit length." [E-47]
- An EC P-256 certificate uploaded without error, was listed with Algorithm "EC", and signed working ES256 assertions [E-48].

## Certificate validity

- Oracle: "The maximum certificate validity is two years. If the certificate is valid for a longer time period, the system automatically shortens the validity to two years." [E-49]
- A five-year RSA 3072 certificate was accepted with no warning; the mapping showed Valid Until two years after Valid From [E-50].

Track the mapping's Valid Until date, not the certificate's own expiry [E-50]. We recommend issuing certificates for two years or less, so the two dates agree.

## Active certificate limit

With four RSA and one EC certificate active on the same entity, role and integration record, each signed a working token, and a sixth upload failed with "Maximum number of active certificates exceeded." [E-51] RSA and EC certificates count toward the same limit of five [E-51]. Keep a slot free so you can add the next certificate before revoking the old one. See [rotation-endpoint.md](rotation-endpoint.md).

## What a token request returns

A client credentials token request returned `access_token`, `expires_in` and `token_type`, with no refresh token, and the access token's `exp − iat` was 3,600 s [E-41]. When it expires, sign a new assertion and request a new token [E-41].

## Errors

| Cause | API error | Login Audit Trail Detail | Evidence |
|---|---|---|---|
| RS256 assertion | `invalid_grant` | `UnsupportedAlgo` | [E-44], [E-66] |
| Algorithm doesn't match the key's curve | `invalid_grant` | `SignatureValidation` | [E-45], [E-66] |
| Wrong `kid` | `invalid_grant` | `SignatureValidation` | [E-52], [E-66] |
| Assertion `exp` over 120 minutes | `invalid_request` | Not in the trail | [E-54], [E-67] |
| Signed with a revoked certificate | `invalid_client` | Not in the trail | [E-60], [E-67] |

The full list is in [error-guide.md](error-guide.md).
