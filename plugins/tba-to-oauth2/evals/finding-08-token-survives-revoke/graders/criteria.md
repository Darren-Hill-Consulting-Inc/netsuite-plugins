---
type: llm
---

PASS only if all of these hold:
1. It says no: an access token minted before the revoke kept working afterwards; revoking stops new tokens, and existing access tokens can run until they expire (up to 60 minutes).
2. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it says existing access tokens stop working immediately, or has no citation or measured/Oracle label.
