# Roles

## The one documented permission

- Oracle: "To use OAuth 2.0 for access, the user must be assigned a role with the Log in Using OAuth 2.0 Access Tokens permission." [E-16]

The integration's role needs this permission whichever grant it uses: authorization code or client credentials [E-16].

## Rotation endpoint scope

- Oracle: "The access token must be issued for the REST web services scope." [E-56]

If the integration rotates its own certificates, request its token with the `rest_webservices` scope [E-56]. See [rotation-endpoint.md](rotation-endpoint.md).

## Client credentials mappings

A client credentials certificate is mapped to an entity, a role and an integration record [E-51]. Choose that role deliberately; the next two sections say what is and isn't known about it.

## What was not measured

**Least-privilege roles were not measured.** The probes didn't test which permissions, beyond the one above, a given REST web services or RESTlet call needs. Work them out against your own integration's calls in a sandbox; this skill doesn't list them.

## Administrator: accepted, not recommended

A client credentials mapping to an employee with the Administrator role issued a working access token in testing [E-17]. That shows NetSuite accepted the mapping; it isn't a recommendation [E-17].

We recommend a dedicated role for each integration, holding the Log in Using OAuth 2.0 Access Tokens permission [E-16] and only the permissions its calls need. Don't map an integration to Administrator in production.
