# Security

## Reporting a problem

Report security problems privately through GitHub: on this repository's **Security** tab, choose **Report a vulnerability**. Please don't open a public issue for them.

Report anything that could expose a secret or change an account without consent, for example:

- a script that prints, logs or writes a client secret, private key, refresh or access token, or an unmasked client or certificate ID;
- a way to add or revoke a certificate, or use up a public-client refresh chain, without the confirmation flag and the typed account ID;
- a scan that copies a credential value into the plan, the inventory or the chat;
- anything account-specific committed to this repository.

A wrong statement about NetSuite or Oracle isn't a security problem, but it does matter. Open a regular issue that names the `[E-nn]` entry involved.

## Supported versions

Fixes go into the latest release only. Update with `/plugin marketplace update darren-hill-consulting`.
