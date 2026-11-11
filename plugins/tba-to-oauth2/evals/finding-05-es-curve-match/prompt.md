---
runs: 3
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
tags: [finding]
---

We have a P-256 EC key for NetSuite client credentials. Can we sign the JWT assertion with ES384 instead of ES256?
