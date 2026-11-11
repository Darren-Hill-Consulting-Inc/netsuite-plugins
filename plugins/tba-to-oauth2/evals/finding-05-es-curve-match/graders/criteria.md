---
type: llm
---

PASS only if all of these hold:
1. It says no: the ES algorithm must match the key's curve, so a P-256 key needs ES256, and ES384 with a P-256 key is rejected (with `invalid_grant`).
2. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it says ES384 with a P-256 key works, or has no citation or measured/Oracle label.
