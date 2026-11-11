# Routes

How the skill touches the code, the user's machine and the NetSuite account. Use the first route that can do the job.

| Route | Used for | Status |
|---|---|---|
| Local, no account | Reading the repo; `scan-hints.mjs`; `check-cert.mjs`; `check-assertion.mjs`; reading a Login Audit Trail CSV the user exported | Available |
| Local Node script, with the integration's own credentials | `m2m-check.mjs`, `refresh-check.mjs`, `rotate-cert.mjs`, `verify.mjs` | Available |
| NetSuite MCP | Nothing in v1 | Not used |
| Script Debugger | No snippets in v1; runs ad hoc 2.1 [E-86]. The Login Audit Trail can't be searched from SuiteScript [E-87] | Available, unused |

Script paths below are under `${CLAUDE_SKILL_DIR}/scripts/`. Every script prints its usage when run with no arguments.

## Local, no account

- **The repo.** Read code, config, CI and deploy files directly. `scan-hints.mjs <repo root>` prints locations only, never matched text, so its output can't carry a secret. Treat each hit as a lead; [detection-patterns.md](detection-patterns.md) says how to confirm it.
- **Certificates.** `check-cert.mjs --account <id> [--cert <file>]` checks key size, curve, algorithm fit, validity and the two-year cap, and that the private key matches when `NS_PRIVATE_KEY_PATH` is set. No network.
- **Assertions.** `check-assertion.mjs --account <id> --assertion <file> [--kid <certificate id>]` decodes a saved assertion and checks its header and claims. It doesn't verify the signature. No network.
- **Login Audit Trail CSV.** When the user exports the trail with the recipe in [login-audit-trail.md](login-audit-trail.md) [E-85], read the file locally. Report counts by Token-based Application Name and by whether Token-based Access Token Name is filled in [E-63], [E-64]. Don't copy user, email or IP address columns into the chat, the plan or the inventory.

## Local Node script, with the integration's own credentials

Run these where the integration runs, with its own key and client ID. They read configuration from environment variables only:

| Variable | Holds | Used by |
|---|---|---|
| `NS_ACCOUNT_ID` | Account ID; must equal `--account` | All |
| `NS_CLIENT_ID` | Integration client ID | All |
| `NS_CERT_ID` | Certificate ID from the mapping, used as `kid` | `m2m-check`, `rotate-cert`, `verify`; default `--kid` for `check-assertion` |
| `NS_PRIVATE_KEY_PATH` | Path to the private key file | `check-cert`, `m2m-check`, `rotate-cert`, `verify` |
| `NS_CERT_PATH` | Path to the certificate file | `check-cert`, `verify` |
| `NS_ALG` | `PS256` (default), `PS384`, `PS512`, `ES256`, `ES384` or `ES512` | Signing scripts |
| `NS_SCOPES` | Default `rest_webservices` | Signing scripts |
| `NS_CLIENT_SECRET` | Confidential client secret | `refresh-check` |
| `NS_REFRESH_TOKEN` | The refresh token to test | `refresh-check`, `verify` |

The user sets them in their own shell or secrets manager. Never ask for the values in chat.

What the scripts guarantee: they refuse to run unless `--account` equals `NS_ACCOUNT_ID`; they never print or write secrets, private keys or tokens; client and certificate IDs are masked as `abcd…wxyz`. The one exception is `rotate-cert add`, which prints the new certificate ID once to the terminal (not to `--out`), because the user needs it as the new `kid`.

The base URL comes from the account ID: the scripts lower-case it and replace `_` with `-` (so `1234567_SB1` becomes `1234567-sb1.suitetalk.api.netsuite.com`). That is what the scripts do, not a documented NetSuite rule. If a call fails to reach the host, compare it with the host the integration already calls.

| Script | Changes the account? | Notes |
|---|---|---|
| `m2m-check.mjs` | No | Mints a client credentials token, checks its lifetime, runs SuiteQL `SELECT 1`, lists the certificates |
| `refresh-check.mjs` | No, for a confidential client | Refreshes once; a confidential refresh returns no new refresh token [E-32] |
| `refresh-check.mjs --public` | Uses up the refresh chain | The new refresh token isn't saved, so the app must authorize again [E-36]. Needs `--i-understand-this-ends-the-chain` and the account ID typed at a prompt |
| `rotate-cert.mjs list` | No | Lists certificates with masked IDs [E-57] |
| `rotate-cert.mjs add` / `revoke` | **Yes** | Needs `--confirm` and the account ID typed at a prompt |
| `verify.mjs` | No | Runs `check-cert`, `m2m-check` and, when `NS_REFRESH_TOKEN` is set, the confidential refresh check; never the public one |

Exit codes: 0 all checks passed, 1 a check failed, 2 a configuration error or a safety refusal.

### Before an account change

Before suggesting `rotate-cert add`, `rotate-cert revoke` or `refresh-check --public`:

1. Say in one or two lines exactly what will change. For `add`: a new active certificate on the integration, one of five slots [E-51]. For `revoke`: new token requests signed with that certificate fail with `invalid_client` [E-60]; tokens already issued may run out their 60 minutes [E-61]. For `--public`: the app's refresh chain ends and someone must authorize again [E-36], [E-38].
2. Say that the script will stop and ask them to type the account ID before it sends anything.
3. Wait for an explicit yes in chat. Only then give or run the command with `--confirm` (or `--i-understand-this-ends-the-chain`). Never add those flags on the user's behalf without that yes.

The prompt needs an interactive terminal. When Claude can't provide one, hand the command to the user to run themselves.

## NetSuite MCP

v1 makes no MCP lookups. Which account data a NetSuite MCP connection can reach for this purpose (integration records, roles, the Login Audit Trail) has not been tested. If one is connected, you may mention that it exists, but ask the user for the facts the plan needs (integration record names, roles, which grant each record allows) instead of querying it.

## Script Debugger

The debugger runs ad hoc SuiteScript 2.1 [E-86], but v1 has no snippet that needs it. The Login Audit Trail, the main candidate, can't be searched from SuiteScript [E-87]; use the UI search and CSV export [E-85]. If you write a snippet for another read, follow the rules in [debugger-snippets.md](debugger-snippets.md).

## When the scripts can't run here

Outside Claude Code, or when Bash or the network isn't available, hand the user the exact commands to run in their own terminal, with the variables above, and ask them to paste back the Markdown report (it contains no secrets). Read the report and continue.
