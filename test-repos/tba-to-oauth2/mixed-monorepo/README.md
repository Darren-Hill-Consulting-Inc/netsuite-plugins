# acme-platform

| Path | What |
|---|---|
| `apps/portal` | Customer-service portal. Reps connect their own NetSuite login once, then work cases. |
| `services/inventory-sync` | Hourly warehouse stock push into NetSuite (Python, runs in k8s). |
| `services/billing-export` | Nightly billing export from NetSuite to the data lake. |
| `packages/xero-legacy` | Old Xero client for the UK entity, still used for the quarterly VAT pull. |
| `packages/oauth-utils` | Shared OAuth 1.0a signing helpers and their specs. |
