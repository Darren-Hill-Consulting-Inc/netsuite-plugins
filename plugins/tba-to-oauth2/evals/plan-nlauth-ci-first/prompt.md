---
runs: 3
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
tags: [plan]
---

We have three NetSuite integrations to move to OAuth 2.0: a GitLab CI deploy job that calls a RESTlet with an NLAuth Authorization header, a nightly Python job that uses TBA against SuiteQL, and a .NET SOAP sync that uses TokenPassport. In what order should we migrate them, and why?
