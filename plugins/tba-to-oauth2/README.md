# tba-to-oauth2

A Claude Code plugin for developers who own a NetSuite integration that still signs requests with Token-Based Authentication (TBA), and need to move it to OAuth 2.0.

Independent work by Darren Hill Consulting Inc. Not affiliated with or endorsed by Oracle. NetSuite is a trademark of Oracle, used here descriptively.

## Why now

Oracle has announced that from NetSuite 2027.1 no new integrations can use TBA [E-01], and that NLAuth integrations stop working [E-05], except existing IssueToken integrations [E-06]. End of support for existing TBA integrations is "tentatively planned for the 2028.2 release" [E-02]. The exact quotes are in [references/dates-and-soap.md](skills/tba-to-oauth2/references/dates-and-soap.md).

## What it does

The skill has four modes. Claude picks one from what you ask.

| Mode | Ask something like | You get |
|---|---|---|
| Scan and plan | "Scan this repo for NetSuite authentication and write the TBA migration plan" | `docs/tba-to-oauth2-plan.md` and `docs/tba-to-oauth2-inventory.json` in your repo. They list every TBA, NLAuth, SOAP passport and REST call site and where its credentials live. Each integration gets a recommended grant, an effort estimate, and an order against Oracle's dates |
| New implementation | "Help me set up client credentials for a nightly NetSuite sync" | A short multiple-choice interview, then one recommended design: integration record settings, certificate commands, JWT assertion, token handling, rotation and error logging |
| Reference | "How long does a NetSuite OAuth 2.0 refresh token last?" | An answer that cites measured results and Oracle quotes |
| Verify | "Check my NetSuite OAuth 2.0 setup" | Local Node scripts that test your certificate, assertion, token, refresh and certificate list, with a pass/fail report |

## Evidence

Every statement the skill makes about NetSuite cites an entry in [references/evidence.md](skills/tba-to-oauth2/references/evidence.md). Each entry is one of:

- **Measured**: observed in a NetSuite 2026.2 test account in November 2026, with a probe ID.
- **Oracle quote**: an exact, short quote with a link and the date it was fetched.
- **Inference**: labelled as such.

Where a measurement went past a documented limit, the skill gives the documented limit as the rule and marks the measurement "observed, not guaranteed". NetSuite releases can change this behaviour, so re-check after 2027.1.

## Install

In Claude Code:

```text
/plugin marketplace add Darren-Hill-Consulting-Inc/netsuite-plugins
/plugin install tba-to-oauth2@darren-hill-consulting
```

Or from a shell:

```bash
claude plugin marketplace add Darren-Hill-Consulting-Inc/netsuite-plugins
claude plugin install tba-to-oauth2@darren-hill-consulting
```

Requirements: Claude Code, and Node.js 20.12 or later (22 LTS recommended) for the scripts. The scripts have no npm dependencies.

On claude.ai or the API, the skill still answers and plans, but it gives you the scripts to run yourself. They need network access to your NetSuite account.

## Data handling

- Nothing is sent to Darren Hill Consulting. The plugin has no telemetry and no servers.
- The scripts talk only to the NetSuite account you name. They refuse to run unless `--account` matches `NS_ACCOUNT_ID`.
- Credentials are read from `NS_*` environment variables and file paths you set. The skill never asks you to paste a secret, key or token into the chat.
- Scripts never print or write secrets, private keys or tokens. Client and certificate IDs are masked as `abcd…wxyz`. The one exception: `rotate-cert add` prints the new certificate ID once, to your terminal only, because you need it as the new `kid`. The report file keeps it masked.
- When the scan finds credentials in your repo, it records the key name and line, never the value.
- If your Claude Code permissions block a file (for example `.env`), the plan lists it under "Not inspected" so you can check it yourself.

## Account changes

Some commands change your account: adding or revoking a certificate, and testing a refresh on a public client, which uses up the refresh-token chain. These commands need an explicit flag: `--confirm`, or `--i-understand-this-ends-the-chain` for the public refresh. They then ask you to type the account ID, and they refuse when stdin is not a terminal. The skill explains the change and waits for your yes before it suggests the flag.

## Script exit codes

| Code | Meaning |
|---|---|
| 0 | Every check passed, warned or was skipped |
| 1 | At least one check failed |
| 2 | Refused: configuration error, missing flag, no terminal, or the account ID was typed wrong |

## Limits

- It finds only what is in the repo. iPaaS connectors and vendor-hosted integrations are listed as things to check in the Login Audit Trail.
- Role advice uses Oracle's documented permissions. Least-privilege roles were not measured.
- From SuiteScript, `N/search` has no Login Audit Trail search type [E-87], and SuiteQL's `LoginAudit` lacks the token columns [E-69], so finding integrations outside the repo uses a search you run in the NetSuite UI and export to CSV [E-85].
- Measured on NetSuite 2026.2. Re-check after 2027.1.

## Help with a bigger migration

If the scan turns up more than you expected, the [NetSuite Account Audit](https://darrenhillconsulting.ca/services/netsuite-account-audit) covers integrations along with the rest of the account. More at [darrenhillconsulting.ca](https://darrenhillconsulting.ca).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
