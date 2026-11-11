---
name: tba-to-oauth2
description: Migrate NetSuite integrations from Token-Based Authentication (TBA), OAuth 1.0a, NLAuth or SOAP TokenPassport to OAuth 2.0. Use when asked to scan a repo or codebase for NetSuite authentication or TBA calls, plan a NetSuite TBA to OAuth 2.0 migration, or design a new NetSuite OAuth 2.0 integration (client credentials / machine-to-machine with a certificate and JWT assertion, or authorization code with PKCE). Also use for NetSuite OAuth 2.0 questions about refresh tokens, token lifetimes, PKCE, state, certificates, key sizes, certificate rotation, roles or the Login Audit Trail; for errors such as invalid_grant, invalid_request or invalid_client from the NetSuite token endpoint; and to test or verify a NetSuite OAuth 2.0 setup, refresh token or certificate. Answers cite measured NetSuite 2026.2 results and Oracle quotes. Not for OAuth with other services (Xero, Salesforce, Google, Twitter and the like), generic OAuth questions, or SuiteScript work unrelated to authentication.
license: Apache-2.0
metadata:
  author: "Darren Hill Consulting Inc."
  version: "0.1.0"
  measured-on: "NetSuite 2026.2"
---

# TBA to OAuth 2.0 for NetSuite

Independent work by Darren Hill Consulting Inc. Not affiliated with or endorsed by Oracle. NetSuite is a trademark of Oracle, used here descriptively.

The user is usually a developer who owns a NetSuite integration, often an inherited one, and has to move it off TBA. They know their code, not NetSuite authentication. Success means two things: the scan found every TBA, NLAuth and SOAP passport call in the repo, and the plan works the first time it is followed.

This skill's folder is `${CLAUDE_SKILL_DIR}`. The reference files write it as a CLAUDE_SKILL_DIR variable in commands; use this folder there. When handing a command to the user, write the full path.

## Rules for every mode

### 1. Evidence

- Every statement about NetSuite or Oracle cites an entry in [references/evidence.md](references/evidence.md) as `[E-nn]`. Entries are Measured (NetSuite 2026.2, test account, November 2026, with probe IDs), Oracle quote (exact, linked, dated) or Inference.
- If no entry covers it, say "not measured" or "not documented". Don't fill the gap from memory or general OAuth knowledge.
- Label inferences as inferences. Where a measurement went past a documented limit (entries tagged Observed, not guaranteed), give the documented limit as the rule.
- The scripts build hosts by lower-casing the account ID and replacing `_` with `-` (`1234567_SB1` becomes `1234567-sb1`). Present that as what the scripts do, never as a NetSuite rule: no evidence entry covers it.

### 2. Secrets

- Never ask the user to paste a secret, private key, token, password or consumer key into the chat or into Script Debugger code.
- Scripts read credentials from `NS_*` environment variables (listed in [references/routes.md](references/routes.md)). Tell the user which variables to set in their own shell or secrets manager.
- If the user pastes one anyway, say plainly that secrets don't belong in the chat. Don't repeat it, quote it or write it to any file, even when it looks like a placeholder. Tell them to rotate it if it is live, then carry on with the environment variables.
- When reading a repo, report credential key names and locations only, never values. That covers chat, the plan and the inventory.

### 3. Account changes

`rotate-cert.mjs add`, `rotate-cert.mjs revoke` and `refresh-check.mjs --public` change the account or use up a refresh chain. When the user asks for one of these changes, say steps 1 and 2 in your first reply, even if you still need details from them. Before running or handing over any of them:

1. Say that it is a change to their NetSuite account (or ends a refresh chain), and explain in a line or two what will change ([references/routes.md](references/routes.md), "Before an account change").
2. Say that the command needs `--confirm` (`--i-understand-this-ends-the-chain` for the public refresh) and that the script will stop and ask them to type the account ID.
3. Wait for an explicit yes in chat. Until then, don't run the command or show it with `--confirm` or `--i-understand-this-ends-the-chain`; never pass those flags on the user's behalf.

Every other script is read-only.

### 4. The user's code

Write the plan, the inventory and example code. Don't edit the user's integration code to do the migration unless they ask for that change, step by step.

## Pick the mode

| The user wants | Mode | Read |
|---|---|---|
| "Scan this repo", "what uses TBA here", "plan our migration" | 1. Scan and plan | [detection-patterns.md](references/detection-patterns.md), [plan-template.md](references/plan-template.md), [inventory-schema.json](references/inventory-schema.json) |
| "We're building a new integration", "how should we set up OAuth 2.0" | 2. Interview | [interview.md](references/interview.md) |
| A question or an error message | 3. Reference answer | The topic file in the table under Mode 3 |
| "Check our setup", "does our certificate work" | 4. Verify | [routes.md](references/routes.md) |

Modes chain: a scan often ends with the interview for one integration, and every design ends with verify.

## Mode 1: Scan and plan

Work through the whole repo without stopping to ask questions; record anything you couldn't settle as an open question in the plan. Read [references/detection-patterns.md](references/detection-patterns.md) in full first.

1. **Locate.** On a large repo, run the locator first:

   ```sh
   node "${CLAUDE_SKILL_DIR}/scripts/scan-hints.mjs" .
   ```

   It prints JSON with locations only, never matched text. Its hits are leads, not findings. Work through `skipped` as detection-patterns section 1 says. If the locator can't run (the `node` call is denied, for example), say so in the plan's "Not inspected" section, list any file you then can't read under `notInspected`, and search with the regexes in `${CLAUDE_SKILL_DIR}/scripts/scan-patterns.json` instead. On a small repo, read the code directly and use the locator as a cross-check.
2. **Read the code** with the Read, Grep and Glob tools rather than shell commands. Open every file with a hit, and always read the entry points: CI files, scripts folders, cron and scheduler definitions, Dockerfiles, Compose files, Helm charts, Terraform and Kubernetes manifests (section 1).
3. **Follow every signer.** For each signer, passport builder or client constructor, find every caller and the host each one reaches (section 2). A shared signer counts only through callers that send to a NetSuite host. If the host comes from config, follow it to the value; if it can't be resolved, report the site with "host unconfirmed".
4. **Report each site on the right line**, per section 6: the HMAC line for a signer; the constructor for a library, TokenPassport or Passport; each of the three TBA steps; the `NLAuth` header line; the first line of every call to NetSuite; for existing OAuth 2.0, the assertion signing, the token request and each bearer call. A URL constant that no call uses goes under `endpoints`, not `sites`.
5. **Record credentials** by key name and line, in every file type section 5 lists. Code that only reads a credential is part of its site. If a file can't be read (a permission or policy rule blocks `.env`, for example), don't guess its keys or record a location in another file: add it to the inventory's `notInspected` with the reason, and to the plan's "Not inspected" section. Never skip one silently.
6. **Exclude look-alikes** with a reason, per section 8: OAuth 1.0a to non-NetSuite hosts, generic spec helpers, vendored and generated code, SuiteScript that runs inside NetSuite.
7. **Group and decide**, per section 7: one integration per set of credentials that runs as one thing; attended or unattended; outcome `auth-code-pkce`, `m2m`, `rewrite-rest` or `already-oauth2`. IssueToken gets `m2m` or `auth-code-pkce` like other TBA.
8. **List what may sit outside the repo** in `outsideRepo`, with the clue that suggests it (an iPaaS config, a vendor connector's name in docs or config, a RESTlet script in the repo with no caller here). The plan gives the Login Audit Trail recipe to confirm them [E-85].
9. **Write both files**, from [references/plan-template.md](references/plan-template.md):
   - `docs/tba-to-oauth2-plan.md`
   - `docs/tba-to-oauth2-inventory.json`, which must validate against [references/inventory-schema.json](references/inventory-schema.json): `credentialLocations` (not `credentials`), `notInspected` (an empty list if every file was read), the four outcome values only, site kinds from the schema's list, repo-relative paths, no extra fields.

   Use other paths only if the user asked. Never put a credential value in either file.
10. **Self-check before finishing.** Every locator hit is either a site, a credential, an exclusion or explained as noise. Every signer has its callers. Every `skipped` file is read or listed under "Not scanned". Every file you couldn't read is in `notInspected` and the plan's "Not inspected" section. The inventory matches the plan.
11. **Check the inventory mechanically.** From the repo root, run this. It parses the file with `JSON.parse` and checks required fields, types, enums, formats and unexpected fields against the schema. Fix every line it prints and run it again until it prints `inventory OK`:

   ```sh
   node -e '
   const fs=require("fs"),[s,f]=process.argv.slice(1),S=JSON.parse(fs.readFileSync(s,"utf8")),d=JSON.parse(fs.readFileSync(f,"utf8")),E=[];
   const t=v=>Array.isArray(v)?"array":v===null?"null":Number.isInteger(v)?"integer":typeof v;
   const c=(x,v,p)=>{if(x.$ref)x=x.$ref.split("/").slice(1).reduce((o,k)=>o[k],S);
   if(x.type&&t(v)!==x.type&&!(x.type==="number"&&t(v)==="integer"))return E.push(p+": expected "+x.type);
   if(x.enum&&!x.enum.includes(v))E.push(p+": not one of "+x.enum.join(", "));
   if(x.pattern&&!new RegExp(x.pattern).test(v))E.push(p+": bad format");
   if(x.minLength&&v.length<x.minLength)E.push(p+": empty");if(x.minimum&&v<x.minimum)E.push(p+": below "+x.minimum);
   if(x.minItems&&v.length<x.minItems)E.push(p+": needs "+x.minItems+"+ items");
   if(x.items)v.forEach((e,i)=>c(x.items,e,p+"["+i+"]"));
   if(x.properties){for(const k of x.required||[])if(!(k in v))E.push(p+": missing "+k);
   for(const k in v)x.properties[k]?c(x.properties[k],v[k],p+"."+k):x.additionalProperties===false&&E.push(p+": unexpected "+k)}};
   c(S,d,"inventory");console.log(E.length?E.join("\n"):"inventory OK");process.exitCode=E.length?1:0' "${CLAUDE_SKILL_DIR}/references/inventory-schema.json" docs/tba-to-oauth2-inventory.json
   ```

   If Bash is unavailable, make the same checks by reading the file against the schema.

Then summarise in chat: the integrations, their outcomes, what comes first and why [E-05], [E-01], and the file paths. Offer the interview (Mode 2) for any integration that needs a design.

## Mode 2: New-implementation interview

Follow [references/interview.md](references/interview.md): one question at a time, multiple-choice options, stop as soon as the decision table settles on a design. Then give that design's steps: integration record settings, certificate commands, assertion structure, token handling and refresh rules, rotation with `rotate-cert.mjs`, error logging with [references/error-guide.md](references/error-guide.md), and the verify command.

Default recommendations, each from the interview's decision table:

- Unattended: client credentials with PS256 on RSA 3072, or ES256 on P-256 [E-43], [E-46].
- Attended: authorization code with PKCE S256 [E-07].
- SOAP: rewrite to REST web services or RESTlets first, since OAuth 2.0 isn't supported for SOAP [E-08].

## Mode 3: Reference answers

Answer from the topic file, citing its entries. Lead with the answer, then the evidence, then what to do.

| Topic | File |
|---|---|
| Access and refresh token lifetimes, confidential and public refresh rules, rotation chains | [lifetimes-and-refresh.md](references/lifetimes-and-refresh.md) |
| PKCE, `state`, the authorize endpoint | [pkce-and-state.md](references/pkce-and-state.md) |
| Client credentials: assertion, algorithms, key sizes, `kid`, certificate validity and limits | [certificates-and-assertions.md](references/certificates-and-assertions.md) |
| Certificate rotation endpoint | [rotation-endpoint.md](references/rotation-endpoint.md) |
| Login Audit Trail: finding TBA, Detail values, blind spots | [login-audit-trail.md](references/login-audit-trail.md) |
| Oracle's dates for TBA, NLAuth, PKCE and SOAP | [dates-and-soap.md](references/dates-and-soap.md) |
| Roles and permissions | [roles.md](references/roles.md) |
| `invalid_grant`, `invalid_request`, `invalid_client` and other messages | [error-guide.md](references/error-guide.md) |
| Everything, by ID | [evidence.md](references/evidence.md) |

For an error, ask for the HTTP status, the error body with any tokens removed, and which grant and step it came from, then narrow with [references/error-guide.md](references/error-guide.md). Check the Login Audit Trail Detail where the guide gives one, and say plainly when the cause leaves no trail row [E-67].

The findings people most often get wrong:

- A confidential refresh token defaults to seven days, settable from 1 to 720 hours [E-26], [E-30]; at 720 it carried a 30-day expiry [E-31].
- Reusing a rotated public-client refresh token kills the whole chain [E-38].
- The public-client maximum rotation time counts from the first authorization, and fails with `invalid_request` [E-40].
- RS256 fails with a bare `invalid_grant` [E-44]; the algorithm must match the key's curve [E-45].
- Five active certificates per mapping, RSA and EC together [E-51].
- Certificates over two years are shortened to two years without warning [E-49], [E-50].
- An access token minted before a revoke kept working afterwards [E-61].
- Assertion `exp` must be under 60 minutes after `iat` [E-53]; up to 120 was accepted, but that is observed, not guaranteed [E-54].
- Oracle's Login Audit Trail criterion lists TBA only, and some rejections never reach the trail [E-63], [E-64], [E-67].

## Mode 4: Verify

Use the scripts in `${CLAUDE_SKILL_DIR}/scripts/`. Each prints its usage with no arguments, runs only against the account named by `--account` (which must equal `NS_ACCOUNT_ID`), never prints secrets, and masks IDs.

| Check | Command |
|---|---|
| Certificate and key | `node "${CLAUDE_SKILL_DIR}/scripts/check-cert.mjs" --account <id>` |
| A saved assertion | `node "${CLAUDE_SKILL_DIR}/scripts/check-assertion.mjs" --account <id> --assertion <file>` |
| Client credentials end to end | `node "${CLAUDE_SKILL_DIR}/scripts/m2m-check.mjs" --account <id>` |
| Confidential refresh | `node "${CLAUDE_SKILL_DIR}/scripts/refresh-check.mjs" --account <id>` |
| Certificates and free slots | `node "${CLAUDE_SKILL_DIR}/scripts/rotate-cert.mjs" --account <id> list` |
| All that apply, one report | `node "${CLAUDE_SKILL_DIR}/scripts/verify.mjs" --account <id>` |

The environment variables, exit codes and the account-changing commands are in [references/routes.md](references/routes.md). Read the report back to the user check by check, with its evidence.

## Routes

Summary; details in [references/routes.md](references/routes.md).

- **Local, no account:** the repo, `scan-hints`, `check-cert`, `check-assertion`, and a Login Audit Trail CSV the user exported [E-85].
- **Local Node scripts with the integration's own credentials:** `m2m-check`, `refresh-check`, `rotate-cert`, `verify`.
- **NetSuite MCP:** not used in v1. If one is connected you may mention it, but ask the user for the facts instead of querying it.
- **Script Debugger:** a read-only Login Audit Trail snippet in [references/debugger-snippets.md](references/debugger-snippets.md), **pending verification**. Offer the measured UI search and CSV export first [E-85].

## Without Bash or network access

On claude.ai or anywhere the scripts can't run here, don't try to run them. Give the user the exact commands and the environment variables to set, ask them to run the commands where the integration runs, and read back the Markdown report they paste (it holds no secrets). For a scan without file access, ask for the files the locator would point at, or for the locator's JSON output.
