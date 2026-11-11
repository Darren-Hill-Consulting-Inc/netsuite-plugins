import logging

from .session import netsuite_session

log = logging.getLogger(__name__)


def run_suiteql(query: str):
    """Yield every row of a SuiteQL query, following hasMore."""
    s = netsuite_session()
    offset = 0
    while True:
        resp = s.post(
            f"https://{s.ns_host}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql",
            params={"limit": s.ns_page_size, "offset": offset},
            json={"q": query},
            headers={"Prefer": "transient"},
            timeout=120,
        )
        if resp.status_code != 200:
            log.error("SuiteQL failed: %s %s", resp.status_code, resp.text[:500])
            resp.raise_for_status()
        data = resp.json()
        yield from data.get("items", [])
        if not data.get("hasMore"):
            break
        offset += s.ns_page_size
