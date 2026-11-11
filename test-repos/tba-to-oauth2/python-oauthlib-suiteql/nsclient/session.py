"""Signed requests session for NetSuite (token-based auth)."""
from pathlib import Path

import yaml
from oauthlib.oauth1 import SIGNATURE_HMAC_SHA256
from requests_oauthlib import OAuth1Session

_SETTINGS = Path(__file__).resolve().parent.parent / "settings.yaml"


def _load():
    with _SETTINGS.open() as fh:
        return yaml.safe_load(fh)["netsuite"]


def account_host(account_id: str) -> str:
    # 1234567_SB1 -> 1234567-sb1
    return account_id.lower().replace("_", "-")


def netsuite_session():
    cfg = _load()
    session = OAuth1Session(
        client_key=cfg["consumer_key"],
        client_secret=cfg["consumer_secret"],
        resource_owner_key=cfg["token_id"],
        resource_owner_secret=cfg["token_secret"],
        realm=cfg["account_id"],
        signature_method=SIGNATURE_HMAC_SHA256,
    )
    session.headers.update({"Content-Type": "application/json"})
    session.ns_host = account_host(cfg["account_id"])
    session.ns_page_size = cfg.get("page_size", 1000)
    return session
