---
type: llm
---

PASS only if all of these hold:
1. It says the integration can't simply switch its SOAP calls to OAuth 2.0 in place: OAuth 2.0 isn't supported for SOAP web services, so the calls must be rewritten to REST web services or RESTlets (then use OAuth 2.0 there, e.g. client credentials for an unattended worker).
2. It quotes or closely paraphrases Oracle's statement that OAuth 2.0 "isn't supported for SOAP web services", attributed to Oracle with a citation or link.
FAIL if it recommends keeping SOAP and adding an OAuth 2.0 bearer token to the SOAP calls, or if the SOAP restriction has no Oracle attribution.
