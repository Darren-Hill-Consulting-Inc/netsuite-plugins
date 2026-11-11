# Anthropic plugin directory submission: tba-to-oauth2

Prepared for the owner to submit through the developer portal (claude.ai/directory/manage → Submit new → Plugin bundle). Submission needs a paid plan and the owner's account.

## Before submitting

- [x] Icon: `plugins/tba-to-oauth2/logo.png` (the DHC "HD" mark, 180×180), set as `icon` in plugin.json. It is fixed on the first submission.
- [ ] Optional directory fields in plugin.json: `documentationUrl`, `supportUrl`, `privacyPolicyUrl`.
- [ ] Make the repository public, or install the Claude GitHub App for a private review.
- [ ] Re-run `claude plugin validate --strict ./plugins/tba-to-oauth2`.

## Source

- Repository: `Darren-Hill-Consulting-Inc/netsuite-plugins`
- Plugin path: `plugins/tba-to-oauth2`
- Tracked ref: tag `v0.1.0`

## Listing details

- **Name:** tba-to-oauth2
- **Short description:** Find every NetSuite TBA, NLAuth and SOAP passport call in a repo and plan the move to OAuth 2.0, with answers backed by measured results and Oracle quotes.
- **Long description:** For developers who own a NetSuite integration that still uses Token-Based Authentication. The skill:
  - scans a codebase and writes a migration plan with a recommended grant per integration, ordered against Oracle's 2027.1 and 2028.2 dates;
  - guides a new OAuth 2.0 design through a short interview;
  - answers questions about refresh tokens, PKCE, certificates and errors, citing findings measured on NetSuite 2026.2 and exact Oracle quotes;
  - verifies a setup with local Node scripts that never print secrets.

  Independent work by Darren Hill Consulting Inc. Not affiliated with or endorsed by Oracle. NetSuite is a trademark of Oracle, used descriptively.
- **Category:** Development
- **Keywords:** netsuite, oauth2, tba, migration, suitetalk

## Data handling answers

- **Data collected by the publisher:** none. No telemetry, no servers.
- **External calls:** the bundled Node scripts call only the NetSuite account the user names, and only when the user runs them. There are no other network calls.
- **Credentials:** the scripts read them from environment variables and file paths the user sets. They are never printed, logged or written; client and certificate IDs are masked in output.
- **Account changes:** adding or revoking a certificate, or testing a public-client refresh, needs an explicit flag, an interactive terminal and the account ID typed by the user.

## Pre-submission checklist (checked 2026-11-11)

| Check | Status |
|---|---|
| Name: lowercase, digits, hyphens, ≤64 chars, no reserved words | Pass |
| README ≥40 words | Pass |
| License | Apache-2.0 (LICENSE file and plugin.json) |
| No `.DS_Store`, `Thumbs.db`, `__MACOSX`, symlinks, submodules or LFS pointers in the plugin folder | Pass |
| No real credentials | Pass (leak scan clean; fixtures live outside the plugin folder and use placeholders) |
| No hooks or MCP servers | None bundled |
| SKILL.md frontmatter valid, portable fields only | Pass |
| Size: repo under 50 MiB, files under 5 MiB | Pass |
| Icon | `./logo.png` (DHC mark, 180×180 PNG) |
