# netsuite-plugins

Claude Code plugins for NetSuite developers, from Darren Hill Consulting Inc. This repository is a plugin marketplace named `darren-hill-consulting`.

Independent work by Darren Hill Consulting Inc. Not affiliated with or endorsed by Oracle. NetSuite is a trademark of Oracle, used here descriptively.

## Plugins

| Plugin | What it does |
|---|---|
| [tba-to-oauth2](plugins/tba-to-oauth2/README.md) | Finds every TBA, NLAuth and SOAP passport call in a repo and writes the plan to move them to OAuth 2.0. It also guides new OAuth 2.0 integrations, answers questions with measured results and Oracle quotes, and verifies a setup with local scripts. |

## Install

```text
/plugin marketplace add Darren-Hill-Consulting-Inc/netsuite-plugins
/plugin install tba-to-oauth2@darren-hill-consulting
```

## Repository layout

- `plugins/`: the plugins. Each has its own README, LICENSE and evals.
- `test-repos/`: synthetic repositories with answer keys that score the scanner. They contain no real credentials.
- `tools/`: maintainer tooling (evidence checker, eval runner, leak scan). Not part of any plugin.

## Development

```bash
npm test                                   # unit tests, Node.js 20.12 or later (22 LTS recommended)
node tools/check-evidence.mjs              # every [E-nn] citation resolves
claude plugin validate --strict ./plugins/tba-to-oauth2
```

## License

Apache-2.0. See [LICENSE](LICENSE).
