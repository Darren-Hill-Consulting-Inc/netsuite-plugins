---
runs: 3
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
tags: [finding]
---

Our NetSuite public client has a maximum rotation time set. If we always refresh before each refresh token expires, can the chain go on forever? What error do we get when it stops?
