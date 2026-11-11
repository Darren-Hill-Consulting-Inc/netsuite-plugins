---
type: llm
---

PASS only if all of these hold:
1. It says a confidential client's refresh token is valid for 7 days (168 hours) by default.
2. It says the validity can be changed on the integration record, up to 720 hours (30 days); a stated range of 1 to 720 hours also satisfies this.
3. The answer supports it with evidence: a citation such as [E-26] (any [E-nn] form), or an explicit label that the fact was measured or tested on NetSuite, or a quote attributed to Oracle's documentation.
FAIL if it gives a different default or maximum, says the confidential lifetime is fixed and can't be changed, or gives the facts with no citation or measured/Oracle label.
