# Login Audit Trail

Use the trail to find what still runs on TBA, to watch a migration move to OAuth 2.0, and to read the cause behind a bare API error.

## Find TBA integrations

- Oracle's preparation guide uses this Login Audit Trail saved search criterion: "Token-based Access Token Name, with the value is not empty." [E-63]

Build the inventory as a saved search in the UI. SuiteQL on `LoginAudit` returned only date, detail, emailaddress, ipaddress, requesturi, role, status, user and useragent, with no token application or access token name [E-69]. `ROWNUM <= 3` worked, and the other WHERE clauses tried (user, date, SYSDATE) were rejected with "Invalid or unsupported search" [E-69].

### The recipe that was measured

An ad hoc search, run without saving it, listed the day's rows with these columns and exported them to CSV [E-85]:

1. Open the Login Audit Trail as an advanced search in the UI.
2. Criteria: Date within today [E-85]. A wider date range was not measured; we recommend widening it to cover a full cycle of your scheduled jobs.
3. Result columns: add Detail, Request URI, Token-based Access Token Name, Token-based Application Name and User Agent [E-85].
4. Run it without saving, and export the results to CSV [E-85].
5. Read the export. Oracle's criterion for TBA is a non-empty Token-based Access Token Name [E-63]; OAuth 2.0 rows had the application name and a blank access token name [E-64].

If the export also has user, email or IP address columns, summarise it by application and access token name, and don't copy those columns anywhere.

## Track OAuth 2.0 use

Every OAuth 2.0 row the trail recorded had the integration record's name in Token-based Application Name and a blank Token-based Access Token Name [E-64]. That covered the authorization code grant, refresh, client credentials, the rotation endpoint and SuiteQL [E-64]. Oracle's criterion lists TBA only [E-63], [E-64].

To see how far a migration has got, group the trail by Token-based Application Name: TBA rows have an access token name and OAuth 2.0 rows don't [E-63], [E-64], [E-65]. Treat an integration as migrated when none of its recent rows has an access token name.

## Read the Detail column

Where the API returned only `invalid_request` or `invalid_grant`, the Detail column named the cause [E-66]:

| Detail | Cause | Evidence |
|---|---|---|
| `PkceFailed` | `plain` method; challenge without a method | [E-66] |
| `InvalidState` | 16-character `state` | [E-66] |
| `UnsupportedAlgo` | RS256 assertion | [E-66] |
| `SignatureValidation` | Algorithm or key mismatch; wrong `kid` | [E-66] |
| `TokenBlocked` | Public refresh token reuse, and the chain it killed | [E-66] |

## What the trail doesn't show

**Some rejections never reach it.** These token-endpoint rejections were not in the trail at all [E-67]:

- Assertion `exp` over 120 minutes
- Verifier of the wrong length
- Wrong `code_verifier`
- Public client without PKCE
- A request signed with a revoked certificate

Log the full error body of every failed token request in the integration itself [E-67].

**It records authentication, not the API outcome.** Requests that authenticated and then failed were logged as Success: certificate POSTs that returned 500 and SuiteQL calls that returned 400 [E-68]. A Success row means the credentials worked, not that the call did [E-68].

See [error-guide.md](error-guide.md) for each API error with its Detail value.
