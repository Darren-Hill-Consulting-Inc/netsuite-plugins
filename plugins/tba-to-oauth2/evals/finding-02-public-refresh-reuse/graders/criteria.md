---
type: llm
---

PASS only if all of these hold:
1. It says reusing an already-rotated refresh token on a public client kills (invalidates) the whole refresh chain, so even the newest refresh token then fails and the user must authorize again.
2. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it says only the old token is rejected while the newest one keeps working, if it hedges that the outcome is unknown, or if it has no citation or measured/Oracle label.
