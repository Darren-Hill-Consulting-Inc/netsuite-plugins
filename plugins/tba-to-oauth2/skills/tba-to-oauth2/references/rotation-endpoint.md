# Certificate rotation endpoint

Rotate client credentials certificates by API instead of the UI.

## What Oracle documents

- Oracle: "You can set up three different requests: GET request that returns the list of certificates associated with the given integration record. POST request that lets you set up a new certificate for a given integration record. POST request that lets you revoke any active certificate." [E-55]
- Oracle: "The access token must be issued for the REST web services scope." [E-56]

Oracle names the three operations but not their paths or the add request's body [E-55]. The rest of this page is measured.

## Paths that worked

All three worked with a client credentials token for the REST web services scope [E-57].

| Operation | Request | Evidence |
|---|---|---|
| List | `GET /services/rest/auth/oauth2/v1/clients/{clientId}/certificates` | [E-57] |
| Add | `POST /services/rest/auth/oauth2/v1/clients/{clientId}/certificates` | [E-57] |
| Revoke | `POST /services/rest/auth/oauth2/v1/clients/{clientId}/certificates/{certificateId}/revoke` | [E-57] |

The list returns, per certificate, the application, entity, role, created, valid_from, valid_until, revoked, algorithm and certificate_id [E-57].

## The add request body

The body that worked was JSON with `fileName`, `fileContent` (the PEM text), `entity` and `role` (internal IDs) [E-58]. The integration record came from the path, and the response carried the new certificate ID [E-58].

```json
{
  "fileName": "integration-2027.pem",
  "fileContent": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n",
  "entity": "<entity internal ID>",
  "role": "<role internal ID>"
}
```

The values above are placeholders. Whether `entity` and `role` must be strings or numbers was not measured.

These failed with HTTP 500: an empty JSON object, a raw PEM body, and `{"certificate": …}` [E-58]. The last error listed the known fields `application, validUntil, entity, validFrom, fileName, fileContent, role` [E-58].

## Revoke

The revoke request returned "Successfully revoked", and the list then showed the certificate as revoked [E-60]. A new assertion signed with the revoked certificate returned HTTP 400 `{"error":"invalid_client"}`, not `invalid_grant` [E-60].

An access token minted with a certificate just before it was revoked still ran a query afterwards [E-61]. That was a single test, within minutes [E-61]. Treat revocation as stopping new tokens only; tokens already issued may run out their 60 minutes [E-61].

## A full rotation

A certificate added through the endpoint signed a working token straight away, using its new certificate ID as `kid` [E-59]. We recommend this order:

1. **List** and check for a free slot. Five active certificates is the limit [E-51]. The endpoint was not tested at the limit; an add is likely to fail the same way the UI did, so check first [E-62].
2. **Add** the new certificate and record the certificate ID in the response [E-58].
3. **Switch** the integration to the new key and its `kid` [E-59].
4. **Revoke** the old certificate once the new one is working [E-60].

## Things to watch

- Whether the endpoint applies the two-year validity cap [E-49] to an added certificate was not measured. Check `valid_until` in the list response after every add [E-57]. Key-size and algorithm rules are in [certificates-and-assertions.md](certificates-and-assertions.md).
- Failed add requests (HTTP 500) were logged as Success in the Login Audit Trail, because the request authenticated [E-68]. Check the API response, not the trail.
