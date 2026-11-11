---
type: llm
---

PASS only if all of these hold:
1. It tells the user to keep `exp` less than 60 minutes after `iat`, as the documented limit.
2. It says longer lifetimes (up to 120 minutes) were observed to be accepted, but that this is not guaranteed and shouldn't be relied on.
3. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it recommends a lifetime of 60 minutes or more, presents 120 minutes as the supported limit, omits the observed-but-not-guaranteed 120-minute result, or has no citation or measured/Oracle label.
