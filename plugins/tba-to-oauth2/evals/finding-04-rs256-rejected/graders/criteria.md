---
type: llm
---

PASS only if all of these hold:
1. It says RS256 is not accepted for the NetSuite client credentials assertion.
2. It says the token endpoint rejects an RS256 assertion with `invalid_grant` (a bare error that doesn't name the algorithm as the cause).
3. It points to a supported algorithm instead, such as PS256 or ES256.
4. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it says RS256 works, names a different error than `invalid_grant`, or has no citation or measured/Oracle label.
