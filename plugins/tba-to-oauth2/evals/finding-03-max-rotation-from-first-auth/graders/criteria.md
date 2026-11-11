---
type: llm
---

PASS only if all of these hold:
1. It says the chain cannot go on forever: the maximum rotation time is counted from the first authorization (the original authorization time, e.g. `oit`), not from the latest refresh, so refreshing early doesn't extend it.
2. It says that once the maximum rotation time is reached, the refresh fails with the error `invalid_request` (not `invalid_grant`).
3. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it says the error is `invalid_grant`, says the clock restarts on each refresh, or has no citation or measured/Oracle label.
