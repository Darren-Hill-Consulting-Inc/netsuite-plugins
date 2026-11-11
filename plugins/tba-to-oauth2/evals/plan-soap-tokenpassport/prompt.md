---
runs: 3
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
tags: [plan]
---

Our .NET worker syncs fulfillments by calling NetSuite SOAP web services (SuiteTalk) with a TokenPassport header, i.e. TBA. We need to get off TBA. What is the migration plan to OAuth 2.0?
