# Plan template

The scan writes two files in the user's repo, unless they named other paths:

- `docs/tba-to-oauth2-plan.md`: the plan, for people. Use the skeleton below.
- `docs/tba-to-oauth2-inventory.json`: the same findings as data. It must validate against [inventory-schema.json](inventory-schema.json).

Write both from the same findings, so every integration, site, credential location and exclusion appears in both. Never write a credential value in either: key names and locations only.

## How to fill it in

- **Citations.** Every fact in the plan carries its `[E-nn]`, as in this skill. The user's repo doesn't have `evidence.md`, so the plan ends with an Evidence section: for each ID cited, copy the entry's title and its Type line (Measured with the release, date and probe IDs; Oracle quote with the quote, link and fetched date; or Inference). Where nothing was measured or documented, write "not measured" or "not documented".
- **Inference is labelled.** Attended or unattended, the role a call needs, and the effort are judgements from reading the code. Say so where they appear.
- **Line numbers** follow [detection-patterns.md](detection-patterns.md) section 6: the signing line for a signer, the constructor for a library or passport, the first line of each call, the header line for NLAuth.
- **Account IDs** in the plan are written as `<account>`. Don't copy a real account ID, email, client ID, certificate ID or token from the repo.

### Ordering

Order the work by the date that bites first:

| Wave | What | Why | Evidence |
|---|---|---|---|
| 1 | NLAuth, anywhere | NLAuth integrations stop working as of 2027.1 | [E-05] |
| 1 | Anything that would have to be set up again as a new TBA integration (a new account, a re-created integration record); we infer it can't be copied as TBA after 2027.1 | No new TBA integrations from 2027.1, including IssueToken and the three-step flow | [E-01] |
| 2 | SOAP (`rewrite-rest`) | From 2027.2 only the last SOAP endpoint is supported; all SOAP endpoints are disabled in 2028.2 | [E-12], [E-13] |
| 3 | Remaining TBA, including existing IssueToken integrations | End of TBA support tentatively 2028.2; existing integrations work until then | [E-02], [E-03], [E-06] |
| — | `already-oauth2` | Verify with the scripts; no migration | — |

Within a wave, put the integrations with the most risk first. We recommend starting any SOAP rewrite in parallel with wave 1 rather than after it, since it changes the API as well as the authentication [E-08]. If a SOAP integration must stay on SOAP while it is rewritten, we recommend moving it to the 2025.2 endpoint, the last planned one [E-11].

The 2028.2 TBA date is tentative and the SOAP date is not [E-02], [E-13]. Plan against 2028.2 for both.

### Effort

S, M or L, with the reasons. No hours. These are the skill's rules of thumb, not measurements:

- **S**: unattended, one signer or one library constructor, few call sites, credentials already in env vars or a secrets manager. Swap the signer for a client credentials token, add a certificate.
- **M**: several call sites or signers, credentials spread across files, an attended flow (authorization code + PKCE, re-authorization path), or an NLAuth script whose credentials are a person's login.
- **L**: any SOAP rewrite (default) [E-08], [E-15]; per-user tokens stored in a database; several integrations sharing one signer that can't move together.

### Risks

Pick the ones that apply to each integration:

| Situation | Risk | Evidence |
|---|---|---|
| Client credentials | RS256 fails with a bare `invalid_grant`; set `alg` to PS256 or ES256 | [E-44] |
| Client credentials | Algorithm must match the key's curve | [E-45] |
| Client credentials | Certificates over two years are shortened silently; track the mapping's Valid Until | [E-49], [E-50] |
| Client credentials | Five active certificates per mapping, RSA and EC together; keep a slot free for rotation | [E-51] |
| Client credentials | RSA 2048 is rejected; use 3072 or 4096, or EC P-256 | [E-46], [E-47] |
| Attended, confidential | No new refresh token on refresh; re-authorization likely needed at least every 30 days (inference) | [E-32], [E-71] |
| Attended, public | One replayed refresh token kills the whole chain | [E-38], [E-39] |
| Attended, public | Rotation cap counts from the first authorization and fails with `invalid_request` | [E-40] |
| Attended, any | Verifier-length and missing-PKCE mistakes pass consent and fail only at the token step | [E-23], [E-24] |
| Any | Some token-endpoint rejections leave no Login Audit Trail row; log every failed token response | [E-67] |
| Any | A Success row in the trail means authentication worked, not the call | [E-68] |
| SOAP | OAuth 2.0 isn't supported for SOAP; the API has to change too | [E-08] |
| Role | Which permissions each call needs was not measured; test in a sandbox | [E-16] |

## Skeleton

~~~markdown
# NetSuite TBA to OAuth 2.0 migration plan

Repo: <repo name>. Scanned: <date>. Written by the tba-to-oauth2 skill. Independent work by Darren Hill Consulting Inc. Not affiliated with or endorsed by Oracle. NetSuite is a trademark of Oracle, used here descriptively.

Facts carry an evidence ID; the Evidence section at the end says whether each was measured (NetSuite 2026.2, November 2026), quoted from Oracle, or inferred.

## Summary

<One paragraph: how many integrations, which outcomes, what has to happen first and by when.>

## Inventory

| ID | Integration | Auth today | Attended | Outcome | Effort | Wave |
|---|---|---|---|---|---|---|
| <id> | <name> | <TBA / NLAuth / SOAP TokenPassport / SOAP Passport / IssueToken / OAuth 2.0> | <yes/no> | <auth-code-pkce / m2m / rewrite-rest / already-oauth2> | <S/M/L> | <1/2/3/—> |

## Integrations

### <id>: <name>

- **What it is:** <job, service or app; how it runs (cron, worker, CI, web app)>
- **Attended:** <yes/no>, because <who is present when it runs> (inference from the code)
- **Auth today:** <method>, signed at <file:line>
- **Endpoints:** <RESTlets, REST record, SuiteQL, SOAP port and version>
- **Sites:**

  | File | Line | Kind |
  |---|---|---|
  | <file> | <line> | <kind> |

- **Credentials** (names and locations only):

  | File | Line | Name |
  |---|---|---|
  | <file> | <line> | <NAME> |

- **Outcome:** <outcome>, because <reason with evidence>
- **Role:** a dedicated role with the Log in Using OAuth 2.0 Access Tokens permission [E-16], plus what its calls need (not measured; derive from the endpoints above and test in a sandbox)
- **Effort:** <S/M/L>: <reasons>
- **Risks:** <from the risk table, with evidence>
- **Steps:**
  1. <integration record and mapping settings for the outcome>
  2. <certificate generation, or PKCE and state>
  3. <code change: replace the signer at file:line, update each call site>
  4. <credential change: remove the TBA keys at file:line, add the new variable names>
  5. <verify: the script and the expected result>
  6. <cut over, then revoke the TBA token in NetSuite and remove its credentials>

## Order of work

<The waves, with the integrations in each and the date that drives it.>

## Integrations that may exist outside this repo

The scan sees only this repo. We infer that other things may also authenticate to the same account with TBA: an iPaaS flow, a vendor-hosted connector, another team's code, someone's script. The repo can't show them.

Clues found in this repo: <list from inventory outsideRepo, or "none">.

To find them, run a Login Audit Trail search in the NetSuite UI. This recipe was measured [E-85]:

1. Open the Login Audit Trail as an advanced search.
2. Criteria: Date within today [E-85]. A wider range was not measured; widen it to cover a full cycle of every scheduled job.
3. Add the result columns Detail, Request URI, Token-based Access Token Name, Token-based Application Name and User Agent [E-85].
4. Run it without saving, and export the results to CSV [E-85].
5. Rows with a Token-based Access Token Name are TBA; this is Oracle's own criterion [E-63]. Each distinct application and access token name is an integration to account for.

What it won't show:

- OAuth 2.0 rows have the application name but a blank access token name, so Oracle's "not empty" criterion lists TBA only [E-63], [E-64]. Group by Token-based Application Name to watch the migration move [E-65].
- Some token-endpoint rejections never reach the trail: an assertion `exp` over 120 minutes, a wrong-length or wrong verifier, a public client without PKCE, a revoked certificate [E-67].
- A Success row means authentication worked, not that the API call did [E-68].
- SuiteQL can't do this search: `LoginAudit` there has no token columns [E-69].

## Not scanned

<Files the scan skipped as binary, too large or unreadable, and vendored or generated folders it didn't read, with the reason. "None" if none.>

## Validation checklist

Set the variables in your own shell or secrets manager; never paste values into a chat. Scripts are in the skill's `scripts/` folder.

- [ ] `check-cert.mjs --account <account>`: key size, curve, algorithm, two-year validity, key matches certificate.
- [ ] `check-assertion.mjs --account <account> --assertion <file>`: a saved assertion's header and claims.
- [ ] `m2m-check.mjs --account <account>`: token, lifetime, SuiteQL `SELECT 1`, certificate list. Read-only.
- [ ] `refresh-check.mjs --account <account>`: confidential refresh. A public client's refresh check ends the refresh chain [E-36], [E-38]; run it only when ready to authorize again.
- [ ] `rotate-cert.mjs --account <account> list`: free slots and `valid_until` [E-51], [E-57].
- [ ] `verify.mjs --account <account>`: all of the above that apply, in one report.
- [ ] Login Audit Trail: the integration's recent rows show its application name and no access token name [E-64], [E-65].

## Evidence

<For each ID cited above: ID, title, and the Type line from the skill's evidence register.>
~~~
