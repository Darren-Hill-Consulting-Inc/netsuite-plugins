# Dates and SOAP

What changes when, in Oracle's own words. Every quote below is exact; follow the link in [evidence.md](evidence.md) to read it in context.

## Already in effect

- Oracle: "Starting with the 2026.1 NetSuite release, all newly built integrations should use REST web services with OAuth 2.0." [E-10]
- Oracle: "The 2025.2 SOAP endpoint is the last planned SOAP endpoint and any later SOAP endpoints would be released only as necessary to meet business, technical, or other significant requirements." [E-11]

If an integration has to stay on SOAP until you can replace it, we recommend moving it to the 2025.2 endpoint.

## 2027.1

**TBA: no new integrations.**

- Oracle: "As of NetSuite 2027.1, you won't be able to create new integrations that use TBA for authentication. This includes both the IssueToken endpoint, and the three-step TBA authorization flow." [E-01]
- Oracle: "Existing integrations will continue to work until the final end of support of the TBA feature." [E-03]

**SOAP: no new integrations.**

- Oracle: "With the 2027.1 release, you will not be able to build any new integrations using Token Based Authentication (TBA), which is required for SOAP web services. Accordingly, with the 2027.1 release, you will no longer be able to build new integrations using SOAP web services." [E-09]
- Oracle: "existing Integration Records for integrations using SOAP web services and TBA may still be updated or modified until SOAP web services are fully removed." [E-14]

**NLAuth: stops working.**

- Oracle: "As of 2027.1, all integrations that use NLAuth as an authentication method will stop working." [E-05]
- Oracle: "This end of support doesn't include the existing integrations that use the IssueToken endpoint." [E-06]

NLAuth is a hard stop in 2027.1, while TBA in 2027.1 only blocks new integrations [E-01], [E-05]. Migrate anything on NLAuth first.

**PKCE: required for new authorization code integrations.**

- Oracle: "As of NetSuite 2027.1, PKCE parameters will be required for all new integrations that use the OAuth 2.0 authorization code grant flow. Existing integrations without PKCE will remain functional." [E-07]

Build every replacement with PKCE S256 now, whatever its client type. See [pkce-and-state.md](pkce-and-state.md).

## 2027.2

- Oracle: "Starting with the 2027.2 NetSuite release, only the last endpoint will be supported and have any potential bugs fixed. Older endpoints will still be available, but no longer supported, until the final removal of SOAP web services with the 2028.2 NetSuite release." [E-12]

## 2028.2

**TBA: end of support, tentatively.**

- Oracle: "This limitation is in preparation for the end of support for the TBA feature, tentatively planned for the 2028.2 release." [E-02]
- Oracle: "Later, (tentatively NetSuite 2028.2) the support will end for existing integrations, excluding the SuiteAnalytics Connect (ODBC/JDBC)." [E-04]

**SOAP: removed.**

- Oracle: "With the 2028.2 NetSuite release, all endpoints will be disabled, and SOAP-based integrations will stop working." [E-13]

Oracle hedges the TBA date with "tentatively" and states the SOAP date without a hedge [E-02], [E-13]. Plan against 2028.2 for both; don't count on the TBA date slipping.

## SOAP integrations can't switch to OAuth 2.0 in place

- Oracle: "The OAuth 2.0 feature is for use with RESTlets, REST web services, and SuiteAnalytics Connect. It isn't supported for SOAP web services." [E-08]
- Oracle: "This guide provides you with the resources to help you upgrade your SOAP web services integration to REST web services." [E-15]

A SOAP integration on TBA has to move to REST web services or RESTlets as well as to OAuth 2.0 [E-08]. Use Oracle's upgrade guide to map SOAP operations to REST [E-15], and budget for an API rewrite, not only an authentication change.
