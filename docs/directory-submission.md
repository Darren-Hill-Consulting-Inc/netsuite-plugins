# Anthropic plugin directory submission: tba-to-oauth2

The owner submits this through the developer portal at [claude.ai/directory/manage](https://claude.ai/directory/manage). Submitting needs a Pro, Max, Ultra, Team or Enterprise plan; on Team or Enterprise, it also needs the Owner role. The listing belongs to the claude.ai organization it's submitted from, so submit from the Darren Hill Consulting organization.

Sources, read 2026-11-11:

- [Submit your plugin](https://claude.com/docs/plugins/submit)
- [Plugin pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)
- [Publish to the directory](https://claude.com/docs/directory/publish)
- [Track your directory submission](https://claude.com/docs/directory/submission-status)
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [Plugin manifest reference, directory listing fields](https://code.claude.com/docs/en/plugins/manifest-reference#directory-listing-fields)

## Before opening the portal

- [ ] The release commit is merged to `main`, so `plugin.json` has `version` 0.1.1 and the listing URLs.
- [ ] `https://darrenhillconsulting.ca/tools/tba-to-oauth2#data-handling` is live, because it's the privacy policy link.
- [ ] GitHub is connected on claude.ai *in the organization you submit from*, using an account that can push to `Darren-Hill-Consulting-Inc/netsuite-plugins`. A connection made in another Claude organization doesn't count. The repository is public, so it doesn't need the Claude GitHub App.

## Click-path and values

1. Portal → **Submit new** → **Plugin bundle**.
2. **Source**:
   - **Repository:** `Darren-Hill-Consulting-Inc/netsuite-plugins`
   - **Plugin path:** `plugins/tba-to-oauth2`
   - **Branch or tag:** `main`

   Select **Validate**, and fix any finding marked **Blocking** before going on. A validation result covers one commit, so validate again after any push.
3. **Listing details:** the portal reads these from the repository; nothing is typed here. Check that they show:
   - name `tba-to-oauth2`;
   - the short description from `plugin.json`;
   - the README as the long description;
   - the icon `logo.png`;
   - documentation, support and privacy links to the tool page, GitHub issues and the tool page's data-handling section.

   To change any of these, edit `plugin.json` or the README, merge, and validate again.
4. **Data handling:** the answers are in the next section.
5. **Compliance:** check that the contact email is the owner's business address, then select all four acknowledgements.
6. **Review and submit**:
   - **How new versions reach the directory:** **GitHub push webhook**. After submitting, select **Set up push updates**; this needs admin access to the repository.
   - **Auto-publish passing versions:** off. Each version is published by selecting **Publish**.
   - Select **Submit for review**.

## Data handling answers

| Question | Answer |
|---|---|
| Does the plugin read or store personal data? | It reads, and stores nothing. The skill reads files in the user's repository, and can read a Login Audit Trail CSV that the user exports and points it at. That CSV holds NetSuite user names, emails and IP addresses. All of this is processed in the user's own Claude session. The plan and inventory it writes record credential key names and file locations, never values. Nothing goes to the publisher. |
| Does it send data to services other than its declared connectors? | Yes, to the user's own NetSuite account only, and only when the user runs a script. `m2m-check`, `refresh-check`, `rotate-cert` and `verify` call that account's REST token, SuiteQL and certificate endpoints, using credentials from environment variables the user sets. The README section "What the scripts send, and where" lists every path and what is sent. There are no other network calls, no telemetry and no publisher servers. |
| How long does it keep data? | The publisher keeps nothing. The plan, inventory and any report are files on the user's machine, and the user decides how long to keep them. |
| Is it intended for people under 18? | No. It's for developers who maintain NetSuite integrations. |

## Points a reviewer may raise

A version can be held for a reviewer. A hold isn't a rejection. If one comes up, reply through the plugin's **Get help** menu with the matching note.

- **The scripts read credentials from the user's environment and send them to a server** (checklist: "Uses a credential from the user's machine"). The credentials go only to the token endpoint of the NetSuite account the user names with `--account`, which must equal `NS_ACCOUNT_ID`. That account is the user's own. `userConfig` values don't reach scripts that Claude runs through Bash, so the scripts can't use it. The README discloses this.
- **Endpoint ownership** (policy 3F). The only endpoints the scripts call are the user's own NetSuite account, which the user controls. The publisher runs no endpoint.
- **Privacy policy** (policy 3A). The privacy link points to the tool page's data-handling section, which covers collection (none by the publisher), use and retention.
- **Testing account with sample data** (policy 3D). A NetSuite account can't be shared. Ten synthetic fixture repositories with answer keys are in [`test-repos/tba-to-oauth2/`](../test-repos/tba-to-oauth2). The scan, plan and reference modes need no account, and `tools/run-scanner-evals.mjs` scores the scanner against those fixtures.
- **Example prompts** (policy 3E). The README's "What it does" table gives one prompt for each of the four modes.
- **Name.** `tba-to-oauth2` is descriptive. It contains no Oracle mark, and the independence note is in the README, SKILL.md and NOTICE.

## After submitting

The status shows on the plugin's page under **Submissions**:

| Status | Meaning | Who acts |
|---|---|---|
| Draft | Not sent yet | Owner: **Continue submission** |
| Scanning | Validation and security scan running; retries on its own | Anthropic |
| Needs changes | The newest version didn't pass; the page names the fix | Owner |
| In review | A reviewer is reading the listing; a hold names its category | Anthropic |
| Approved | Passed, not live yet; the card says who publishes | As named |
| Published | Live and installable | Nobody |
| Not live yet | Marked published, waiting for the directory team | Anthropic |

For **Needs changes**:

1. Fix on a branch and run the gates below.
2. Merge to `main`.
3. Select **Check for new commits**. For a rejected submission, select **Resubmit for review** on the **Review** tab instead.

If a submission is stuck, use **Get help** or **Contact Anthropic** in the plugin's menu.

## Releasing a new version

The directory follows `main` and scans its newest commit.

1. Raise `version` in `plugin.json` and `metadata.version` in SKILL.md for every change to the plugin folder. `version` pins installed users until it changes.
2. Tag the release (`vX.Y.Z`).
3. Run the gates below before merging.

Auto-publish is off, so each version that passes waits for **Publish**.

## Gates (run before every submission or release)

| Check | Command | Result on 2026-11-11, branch `release/0.1.1` |
|---|---|---|
| Plugin manifest and directory subset | `claude plugin validate --strict ./plugins/tba-to-oauth2` | Pass, nothing to report (CLI 2.1.322) |
| Marketplace manifest | `claude plugin validate --strict .` | Pass |
| Unit tests | `npm test` | 163 of 163 pass |
| Evidence | `node tools/check-evidence.mjs --require-cache` | 0 errors, 0 warnings |
| Leak scan | `node tools/leak-scan.mjs --deny tools/.denylist --history` | 0 findings over the tree and full history (34-entry deny-list) |
| Plugin folder files | at most 512 files; non-image files under 256 KiB; only text, PNG, JPEG, GIF, WebP and fonts | 96 files; largest `evidence.md` at 43 KB; text and one PNG |
| System files, symlinks, submodules, LFS | none in the plugin folder | None |
| `.gitattributes` | no `export-ignore`, `export-subst` or `filter` | One `-text` rule under `test-repos/` |
| Repository size | under 50 MiB archived, under 10,000 files | 162 KB, 223 files |
| README | at least 40 words outside code blocks | Over 1,000 |
| License | `LICENSE` in the plugin folder or `license` in `plugin.json` | Both (Apache-2.0) |
| Icon | `icon` in `plugin.json`; fixed on first submission | `./logo.png`, 180×180 PNG |
