# tba-to-oauth2 v0.1.0: verification report

Checked on 2026-11-11 against commit `7863ce2`, the last commit before this report.

## Summary

| Gate | Result |
|---|---|
| Unit tests (`npm test`, Node 26) | 163 of 163 pass |
| Evidence check (`node tools/check-evidence.mjs --require-cache`) | 0 errors, 0 warnings. Every `[E-nn]` resolves, and every Oracle quote matches the page fetched on 2026-11-11 |
| Plugin validation (`claude plugin validate --strict`) | Pass |
| Leak scan (`node tools/leak-scan.mjs --deny tools/.denylist --history`) | 0 findings, over the working tree and every commit, against a 34-entry deny-list built from the private probe kit |
| Plugin evals (24 cases) | 24 of 24 pass on the final skill, one run per case |
| Scanner recall (10 fixture repos) | Every fixture has a run with 100% recall and no false positives (details below) |
| Live checks in the test account | Scripts pass end to end; the Script Debugger route is partly confirmed (details below) |

## Evidence register

`plugins/tba-to-oauth2/skills/tba-to-oauth2/references/evidence.md` has 87 entries:

- **43 Measured.** NetSuite 2026.2, test account, November 2026, each with a probe ID.
- **40 Oracle quotes.** Exact, short, linked, fetched 2026-11-11.
- **4 Inferences**, labelled as such.

Two measurements went past a documented limit. Both are tagged "Observed, not guaranteed", and the skill gives the documented limit as the rule.

A final review audited every shipped Markdown file sentence by sentence. Uncited NetSuite facts were cited, or relabelled as detection heuristics or inference. Citations that overstated their entry were narrowed.

## Plugin evals

Run with `npm run eval:plugin`: Sonnet as judge, no ablation, one run per case, on the DHC account.

| Group | Cases | Result |
|---|---|---|
| Triggers on NetSuite TBA/OAuth 2.0 prompts | 5 | 5 of 5 |
| Stays quiet on near-misses (Xero OAuth 1.0a, SuiteScript governance, Salesforce JWT, Google OAuth) | 4 | 4 of 4 |
| Key findings answered correctly, with citation | 10 | 10 of 10 |
| Plan correctness (SOAP rewrite, NLAuth first) | 2 | 2 of 2 |
| Safety (pasted token not echoed, public refresh chain warning, certificate add needs confirmation) | 3 | 3 of 3 |

An earlier full pass at three runs per case also scored 24 of 24, before the last wording changes.

## Scanner recall

The score is computed by `tools/score-inventory.mjs`. A run passes when every keyed call site and credential is found within ±2 lines, no decoy is flagged, and every integration's outcome matches the answer key.

| Fixture | Runs | Passed | Recall | Notes |
|---|---|---|---|---|
| ci-nlauth | 3 | 3 | 100% | |
| dotnet-soap-tba | 3 | 3 | 100% | |
| java-soap-passport | 3 | 3 | 100% | |
| mixed-monorepo | 3 on the final skill | 2 | 100%, 100%, 96% | Run 3 found the client-credentials call but reported it at the `.sign()` line, 6 lines below the key's line |
| node-hand-signed | 1 | 1 | 100% | |
| node-netsuite-rest-lib | 1 | 1 | 100% | |
| php-netsuite-lib | 1 | 1 | 100% | |
| python-oauthlib-suiteql | 1 | 1 | 100% | |
| python-zeep-soap | 1 | 1 | 100% | |
| vendored-noise | 1 | 1 | 100% | |

These results come with limits:

- Most fixtures have one run, because eval spend was cut to one run per fixture. They show recall at 100% on a run, not that it repeats.
- Only mixed-monorepo was re-run after the last skill edits. The other fixtures' runs come from just before those edits, which were wording changes and heuristic labels in the reference files.
- The `.env` files were readable in these runs. The "not inspected" path, which lists files the user's Claude permissions block, is covered by scorer unit tests only.

## Live checks (test account, NetSuite 2026.2)

| Check | Result |
|---|---|
| `verify.mjs` against a client-credentials integration (RSA 3072, PS256) | 9 pass, 0 fail, 1 warning (all five certificate slots in use), 2 skipped. Token HTTP 200, lifetime 3600 s, REST SuiteQL `SELECT 1` HTTP 200 |
| `rotate-cert.mjs list` | Listed 6 certificates (5 active, 1 revoked), IDs masked |
| Script Debugger runs ad hoc SuiteScript 2.1 | Yes (E-86) |
| Login Audit Trail through `N/search` | No: `INVALID_RCRD_TYPE` (E-87). The skill uses the measured UI search and CSV export instead |

No certificate was added or revoked, and nothing new was created in the account.

## Not covered in v0.1.0

- Least-privilege role permissions. Role advice uses Oracle's documentation; a probe is planned for v1.1.
- NetSuite MCP lookups.
- SuiteQL through `N/query` against `LoginAudit`.
- Behaviour on NetSuite 2027.1. Re-probe on the Release Preview.
